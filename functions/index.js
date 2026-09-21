import { readFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFunctions } from 'firebase-admin/functions';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onValueWritten } from 'firebase-functions/v2/database';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { applyCommand, updatePresence, settleDisconnect, GameError, fields, requireCondition, text } from './room-service.js';

initializeApp(process.env.FUNCTIONS_EMULATOR ? { ...JSON.parse(process.env.FIREBASE_CONFIG || '{}'), serviceAccountId: 'emulator@demo-imposter-review.iam.gserviceaccount.com' } : undefined);
const db=getDatabase();
// RTDB may invoke a retry callback asynchronously. Abort there and propagate
// domain errors through the awaited promise, never throw into its event loop.
async function transact(reference, reducer) {
    let failure;
    const result = await reference.transaction(value => {
        try { return reducer(value); }
        catch (error) { failure = error; return undefined; }
    });
    if (failure) throw failure;
    return result;
}
const catalog=JSON.parse(readFileSync(new URL('./generated/catalog.json',import.meta.url),'utf8'));
const codeValid = value => typeof value==='string' && /^[A-Z0-9]{6}$/.test(value);
const local = !!process.env.FUNCTIONS_EMULATOR;
async function limit(uid) {
    const now=Date.now();
    const result=await transact(db.ref(`rateLimits/${uid}`),current=>{
        if(!current||now-current.start>=60000)return {start:now,count:1};
        if(current.count>=120)return;
        return {...current,count:current.count+1};
    });
    if(!result.committed)throw new HttpsError('resource-exhausted','Too many requests. Please wait a minute.');
}
function callable(handler) {
    return onCall({maxInstances:10}, async request=>{
        if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.');
        await limit(request.auth.uid);
        try { return await handler(request.auth.uid,request.data); }
        catch(error){
            if(error instanceof HttpsError)throw error;
            if(error instanceof GameError)throw new HttpsError(error.code,error.message);
            // Never return database contents or hidden game state in an error.
            console.error('Command failed', error.code || error.name);
            throw new HttpsError('internal','The action could not be completed. Please retry.');
        }
    });
}
async function enqueueDisconnect(code,uid,deadline) {
    if(!deadline)return;
    await getFunctions().taskQueue('settleDisconnected').enqueue({code,uid,deadline},{scheduleDelaySeconds:Math.max(0,Math.ceil((deadline-Date.now())/1000))});
}
export async function settleDisconnectedData({code,uid,deadline},now=Date.now()) {
    requireCondition(codeValid(code)&&typeof uid==='string'&&Number.isFinite(deadline),'Invalid timeout');
    await transact(db.ref(`roomsV2/${code}`),room=>{
        if(!room)return room;
        // Check live connection children too: a presence trigger may be delayed.
        if(Object.keys(room.connections?.[uid]||{}).length)return;
        return settleDisconnect(room,uid,deadline,now);
    });
}
export const settleDisconnected=onTaskDispatched({invoker:'private',retryConfig:{maxAttempts:5,minBackoffSeconds:5},rateLimits:{maxConcurrentDispatches:10}},request=>settleDisconnectedData(request.data));
export const roomCommand=callable(async(uid,data)=>{
    fields(data,['code','commandId','roundId','action','payload']);
    if(!local)requireCondition((await db.ref('serverConfig/multiplayerEnabled').get()).val()===true,'Online play is temporarily unavailable.');
    let code=data.code;
    if(data.action==='create') {
        text(data.commandId,80,'command ID');
        code=createHash('sha256').update(uid+':'+data.commandId).digest('hex').slice(0,6).toUpperCase();
    }
    requireCondition(codeValid(code),'Invalid room code','invalid-argument');
    const roomRef=db.ref(`roomsV2/${code}`);
    const before=(await roomRef.get()).val();
    const requestedCategory=data.payload?.category||before?.public?.category;
    const choices={...catalog};
    if(['configure','start'].includes(data.action) && typeof requestedCategory==='string' && requestedCategory.startsWith('custom:')) {
        const id=requestedCategory.slice(7);
        requireCondition(/^[A-Za-z0-9_-]{1,100}$/.test(id),'Invalid category');
        const host=before?.public?.host||uid;
        requireCondition(host===uid,'Only the host can select custom categories','permission-denied');
        const custom=(await db.ref(`users/${uid}/customCategories/${id}`).get()).val();
        requireCondition(custom&&Array.isArray(custom.words)&&custom.words.length>=3&&custom.words.length<=1000,'Custom category unavailable');
        choices[requestedCategory]={words:custom.words.map(word=>text(word,100,'word'))};
    }
    const seed=randomBytes(32), nextRoundId=randomUUID(), now=Date.now();
    const result=await transact(roomRef,room=>{
        // RTDB first calls a transaction with its local cache, which may be null.
        // Returning null lets the server correct a stale empty cache and retry.
        if (!room && data.action !== 'create') return null;
        let index=0;
        // Replay the same random stream on each optimistic transaction retry.
        const random=()=>createHash('sha256').update(seed).update(String(index++)).digest().readUInt32BE(0)/4294967296;
        return applyCommand(room,{...data,uid},{now,nextRoundId,random,catalog:choices});
    });
    const room=result.snapshot.val();
    requireCondition(room,'Room unavailable','not-found');
    if(['create','join'].includes(data.action))await enqueueDisconnect(code,uid,room.server.disconnects?.[uid]);
    return {code,roundId:room.public.roundId||null,revision:room.public.revision,phase:room.public.status};
});
// Re-delivery preserves an existing deadline. A transient queue outage must
// retry scheduling instead of leaving a disconnected room paused forever.
export const roomPresence=onValueWritten({ref:'/roomsV2/{code}/connections/{uid}',retry:true},async event=>{
    const {code,uid}=event.params;
    const result=await transact(db.ref(`roomsV2/${code}`),room=>{
        if(!room)return null;
        return updatePresence(room,uid,Object.keys(room.connections?.[uid]||{}).length>0,Date.now());
    });
    if(result.committed)await enqueueDisconnect(code,uid,result.snapshot.val()?.server?.disconnects?.[uid]);
});

// Local pass-and-play league scores are explicitly owner/admin-attested.
// Online rounds are calculated separately by roomCommand; the browser cannot
// mutate their outcome or award online points.
export const leagueCommand=callable(async(uid,data)=>{
    fields(data,['code','commandId','action','payload']);
    const payload=data.payload||{};
    fields(payload,data.action==='create'?['name','roster']:data.action==='grantAdmin'?['uid']:[]);
    const code=data.action==='create'?createHash('sha256').update(uid+':league:'+text(data.commandId,80,'command ID')).digest('hex').slice(0,6).toUpperCase():data.code;
    requireCondition(codeValid(code),'Invalid league code');
    const now=Date.now();
    const leagueResult=await transact(db.ref(`leagues/${code}`),league=>{
        if(!league && data.action!=='create') return null;
        if(data.action==='create') {
            if(league){requireCondition(league.createdBy===uid,'League code unavailable');return league;}
            const names=Array.isArray(payload.roster)?payload.roster:[];
            requireCondition(names.length<=100,'Too many players');
            const roster={},players={};
            for(const value of names){const name=text(value,20,'name');requireCondition(!/[.#$\[\]/]/.test(name),'Unsupported character in roster name');const key=name.toLowerCase();requireCondition(!['__proto__','constructor','prototype'].includes(key),'Invalid name');roster[key]={displayName:name,createdAt:now,updatedAt:now};players[key]={displayName:name,points:0,gamesPlayed:0,wins:0};}
            return {version:2,name:text(payload.name,80,'league name'),createdBy:uid,createdAt:now,updatedAt:now,admins:{[uid]:true},members:{[uid]:true},roster,players};
        }
        requireCondition(league?.version===2,'League unavailable. Older leagues require owner migration.');
        if(data.action==='join'){league.members||={};league.members[uid]=true;return league;}
        if(data.action==='grantAdmin'){
            requireCondition(league.createdBy===uid,'Only the owner can grant admin','permission-denied');
            requireCondition(league.members?.[payload.uid]===true,'Admin must be a member');league.admins||={};league.admins[payload.uid]=true;return league;
        }
        throw new GameError('Unknown action','invalid-argument');
    });
    requireCondition(leagueResult.snapshot.exists(),'League unavailable','not-found');
    await db.ref(`users/${uid}/leagues/${code}`).set(true);
    return {code};
});
export const categoryCommand=callable(async(uid,data)=>{
    fields(data,['categoryId','commandId','action','payload']);
    const payload=data.payload||{};
    fields(payload,data.action==='publish'?['name','icon','words','authorName']:[]);
    const id=data.action==='publish'?createHash('sha256').update(uid+':category:'+text(data.commandId,80,'command ID')).digest('hex').slice(0,24):data.categoryId;
    requireCondition(typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id),'Invalid category');
    let alreadyVoted=false;
    const result=await transact(db.ref(`communityCategories/${id}`),category=>{
        if(!category && data.action!=='publish')return null;
        if(data.action==='publish') {
            if(category){requireCondition(category.authorUid===uid,'Category unavailable');return category;}
            requireCondition(Array.isArray(payload.words)&&payload.words.length>=3&&payload.words.length<=1000,'Use 3–1000 words');
            return {name:text(payload.name,80,'category name'),icon:text(payload.icon||'📝',20,'icon'),words:payload.words.map(word=>text(word,100,'word')),authorUid:uid,authorName:text(payload.authorName||'Anonymous',40,'author'),publishedAt:Date.now(),upvotes:0,importCount:0};
        }
        requireCondition(category,'Category not found','not-found');
        if(data.action==='upvote'){
            category.upvotedBy||={};alreadyVoted=category.upvotedBy[uid]===true;category.upvotedBy[uid]=true;category.upvotes=Object.keys(category.upvotedBy).length;return category;
        }
        if(data.action==='import'){
            category.importedBy||={};category.importedBy[uid]=true;category.importCount=Object.keys(category.importedBy).length;return category;
        }
        throw new GameError('Unknown action','invalid-argument');
    });
    requireCondition(result.snapshot.exists(),'Category not found','not-found');
    return {id,newCount:result.snapshot.val().upvotes,alreadyVoted};
});
