import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, test, expect } from 'vitest';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getDatabase, connectDatabaseEmulator, ref, set, get } from 'firebase/database';
let env;
const apps=[];
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-imposter-review',database:{host:'127.0.0.1',port:9002,rules:readFileSync('database.rules.json','utf8')}})});
beforeEach(()=>env.clearDatabase());
afterAll(async()=>{await Promise.all(apps.map(deleteApp));await env?.cleanup();});
async function client() {
 const app=initializeApp({projectId:'demo-imposter-review',apiKey:'demo-key',databaseURL:'https://demo-imposter-review.firebaseio.com'},randomUUID());apps.push(app);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 const db=getDatabase(app);connectDatabaseEmulator(db,'127.0.0.1',9002);
 const f=getFunctions(app);connectFunctionsEmulator(f,'127.0.0.1',5001);
 const {user}=await signInAnonymously(auth);
 return {uid:user.uid,db,call:async(name,data)=>(await httpsCallable(f,name)(data)).data};
}
const invoke=(client,action,code,payload={},roundId=null)=>client.call('roomCommand',{commandId:randomUUID(),action,...(code?{code}:{}),payload,roundId});
async function waitFor(check) { for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out waiting for emulator trigger'); }
test('real callable lifecycle preserves secrets and recovers the same player',async()=>{
 const [host,alice,bob,outsider]=await Promise.all([client(),client(),client(),client()]);
 const created=await invoke(host,'create',null,{name:'Host'}),code=created.code;
 await invoke(alice,'join',code,{name:'Alice'});await invoke(bob,'join',code,{name:'Bob'});
 for(const person of [host,alice,bob])await set(ref(person.db,`roomsV2/${code}/connections/${person.uid}/tab1`),true);
 await waitFor(async()=>Object.values((await get(ref(host.db,`roomsV2/${code}/public/players`))).val()).every(p=>p.isConnected));
 await invoke(alice,'toggleReady',code);await invoke(bob,'toggleReady',code);
 await expect(invoke(alice,'start',code)).rejects.toThrow(/host/);
 await assertFails(get(ref(outsider.db,`roomsV2/${code}/public`)));
 const started=await invoke(host,'start',code),round=started.roundId;
 const privateViews=await Promise.all([host,alice,bob].map(p=>get(ref(p.db,`roomsV2/${code}/private/${p.uid}`)).then(s=>s.val())));
 expect(privateViews.filter(v=>v.isImposter)).toHaveLength(1);
 expect(privateViews.find(v=>v.isImposter).secretWord).toBeUndefined();
 await assertFails(get(ref(host.db,`roomsV2/${code}/private/${alice.uid}`)));
 await invoke(alice,'join',code,{name:'Alice'});
 expect((await get(ref(alice.db,`roomsV2/${code}/private/${alice.uid}`))).val()).toEqual(privateViews[1]);
 for(const p of [host,alice,bob]){await invoke(p,'seen',code,{},round);await invoke(p,'ready',code,{},round);}
 await invoke(host,'startVoting',code,{},round);
 for(const p of [host,alice,bob])await invoke(p,'vote',code,{target:'skip'},round);
 const publicResult=(await get(ref(host.db,`roomsV2/${code}/public`))).val();
 expect(publicResult.status).toBe('results');expect(publicResult.results.imposterWins).toBe(true);
 expect(Object.values(publicResult.results.points).reduce((a,b)=>a+b,0)).toBe(1);
 await invoke(host,'nextRound',code);
 const snapshot=(await get(ref(host.db,`roomsV2/${code}/public`))).val();
 expect(snapshot.secretWord).toBeUndefined();expect(snapshot.results).toBeUndefined();
},60000);
test('league join cannot elevate privileges; category votes are idempotent across requests',async()=>{
 const [owner,guest]=await Promise.all([client(),client()]);
 const league=await owner.call('leagueCommand',{commandId:randomUUID(),action:'create',payload:{name:'Friends',roster:[]}});
 await guest.call('leagueCommand',{commandId:randomUUID(),action:'join',code:league.code,payload:{}});
 const data=(await get(ref(guest.db,`leagues/${league.code}`))).val();
 expect(data.members[guest.uid]).toBe(true);expect(data.admins[guest.uid]).toBeUndefined();
 await assertFails(set(ref(guest.db,`leagues/${league.code}/admins/${guest.uid}`),true));
 const category=await owner.call('categoryCommand',{commandId:randomUUID(),action:'publish',payload:{name:'Places',words:['Canada','Japan','Egypt']}});
 const vote=()=>guest.call('categoryCommand',{commandId:randomUUID(),action:'upvote',categoryId:category.id,payload:{}});
 await vote();expect((await vote()).newCount).toBe(1);
 await assertFails(set(ref(guest.db,`communityCategories/${category.id}/name`),'Changed'));
},60000);
