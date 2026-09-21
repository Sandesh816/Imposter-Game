import { calculateVoteResults, calculateRoundPoints } from './game-logic.js';

export class GameError extends Error {
    constructor(message, code = 'failed-precondition') { super(message); this.code = code; }
}
export function requireCondition(condition, message, code) {
    if (!condition) throw new GameError(message, code);
}
export function text(value, limit, label) {
    requireCondition(typeof value === 'string' && value.trim().length > 0 && [...value.trim()].length <= limit, `Invalid ${label}`, 'invalid-argument');
    return value.trim();
}
export function fields(value, allowed) {
    requireCondition(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)), 'Unexpected field', 'invalid-argument');
}
const active = room => ['playing', 'voting'].includes(room.public.status);
const has = (object, key) => Object.hasOwn(object || {}, key);
function member(room, uid, name, now) {
    room.members[uid] = { joinedAt: now };
    room.public.players[uid] = { name, isHost: uid === room.public.host, isReady: uid === room.public.host, isConnected: false, joinedAt: now };
    room.server.disconnects[uid] = now + 60000;
}
function normalize(room) {
    room.members ||= {}; room.public.players ||= {}; room.private ||= {};
    room.server ||= {}; room.server.disconnects ||= {}; room.server.commands ||= {};
    return room;
}
function lobbyReset(room, reason) {
    room.public.status = 'lobby';
    room.public.discussionReady = false;
    room.public.paused = false;
    room.public.message = reason;
    delete room.public.results; delete room.public.secretWord; delete room.public.secretQuestion;
    delete room.public.roundId;
    room.private = {};
    delete room.server.roles; delete room.server.ballots; delete room.server.secretWord; delete room.server.secretQuestion;
    for (const player of Object.values(room.public.players)) {
        player.isReady = player.isHost; player.hasSeenWord = false;
        delete player.vote; delete player.answer; delete player.isImposter;
    }
}
function depart(room, uid) {
    if (uid === room.public.host) {
        room.public.status = 'closed'; room.private = {};
        return room;
    }
    if (active(room)) lobbyReset(room, 'A player left. The round was cancelled without points.');
    delete room.members[uid]; delete room.public.players[uid]; delete room.private[uid];
    delete room.server.disconnects[uid];
    if (room.connections) delete room.connections[uid];
    room.public.paused = active(room) && Object.values(room.public.players).some(p => !p.isConnected);
    return room;
}
function finish(room) {
    const players = structuredClone(room.public.players);
    for (const [uid, player] of Object.entries(players)) {
        player.isImposter = !!room.server.roles[uid];
        player.vote = room.server.ballots[uid];
    }
    const outcome = calculateVoteResults(players);
    room.public.results = { roundId: room.public.roundId, ...outcome, points: calculateRoundPoints(players, outcome), players: structuredClone(players) };
    room.public.status = 'results';
    room.public.players = players;
    for (const player of Object.values(players)) player.isReady = player.isHost;
    if (room.server.secretWord) room.public.secretWord = room.server.secretWord;
    if (room.server.secretQuestion) room.public.secretQuestion = room.server.secretQuestion;
}
const actionFields = {
    create:['name','gameType','imposterCount'], join:['name'], configure:['category','gameType','imposterCount','anonymousVoting'],
    start:[], seen:[], answer:['answer'], ready:[], toggleReady:[], vote:['target'], leave:[], nextRound:[], startVoting:[], results:[]
};
export function applyCommand(input, request, env) {
    const { uid, action, commandId, payload = {} } = request;
    requireCondition(typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid), 'Authentication required', 'unauthenticated');
    requireCondition(typeof commandId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(commandId), 'Invalid command ID', 'invalid-argument');
    requireCondition(has(actionFields,action), 'Unknown action', 'invalid-argument');
    fields(payload, actionFields[action]);
    let room = input ? normalize(structuredClone(input)) : null;
    const commandKey = uid + '_' + commandId;
    const fingerprint = JSON.stringify({action,payload,roundId:request.roundId || null});
    if (room?.server.commands[commandKey]) {
        requireCondition(room.server.commands[commandKey] === fingerprint, 'Command ID already used');
        return room;
    }
    if (action === 'create') {
        requireCondition(!room, 'Room already exists', 'already-exists');
        room = { members:{}, private:{}, server:{commands:{},disconnects:{}}, public:{ host:uid, status:'lobby', category:'countries', gameType:'word', imposterCount:1, anonymousVoting:false, createdAt:env.now, players:{}, revision:0 } };
        member(room,uid,text(payload.name,20,'name'),env.now);
    } else {
        requireCondition(room && room.public.status !== 'closed', 'Room unavailable', 'not-found');
        if (action === 'join') {
            const name=text(payload.name,20,'name');
            if (!has(room.members,uid)) {
                requireCondition(room.public.status === 'lobby' && Object.keys(room.members).length < 16, 'Room unavailable');
                member(room,uid,name,env.now);
            }
        } else {
            requireCondition(has(room.members,uid), 'Room member required', 'permission-denied');
        }
    }
    const state = room.public;
    const player = state.players[uid];
    if (['configure','start','startVoting','results','nextRound'].includes(action)) requireCondition(state.host === uid, 'Only the host can do this', 'permission-denied');
    if (['seen','answer','ready','vote','startVoting','results'].includes(action)) requireCondition(request.roundId && request.roundId === state.roundId, 'Stale round');
    if (['startVoting','results','vote','ready','answer','seen'].includes(action)) requireCondition(!state.paused, 'Waiting for a player to reconnect');
    if (action === 'configure' || action === 'create') {
        requireCondition(['lobby','results'].includes(state.status), 'Settings cannot change in this phase');
        if (payload.gameType !== undefined) {
            requireCondition(['word','question'].includes(payload.gameType), 'Invalid game type', 'invalid-argument');
            state.gameType=payload.gameType;
            state.category=state.gameType==='question'?'q:twistAndTurn':'countries';
        }
        if (payload.category !== undefined) {
            const category=text(payload.category,100,'category');
            requireCondition(has(env.catalog,category) && (state.gameType==='question' ? !!env.catalog[category].questions : !!env.catalog[category].words), 'Invalid category');
            state.category=category;
        }
        if (payload.imposterCount !== undefined) {
            requireCondition(Number.isInteger(payload.imposterCount) && payload.imposterCount >= 1 && payload.imposterCount <= 7, 'Invalid imposter count');
            state.imposterCount=payload.imposterCount;
        }
        if (payload.anonymousVoting !== undefined) {
            requireCondition(typeof payload.anonymousVoting === 'boolean', 'Invalid voting setting');
            state.anonymousVoting=payload.anonymousVoting;
        }
    }
    if (action === 'start') {
        requireCondition(['lobby','results'].includes(state.status), 'Cannot start in this phase');
        const ids=Object.keys(room.members);
        requireCondition(ids.length>=3 && ids.length<=16 && state.imposterCount<ids.length, 'Need a valid roster and imposter count');
        requireCondition(ids.every(id=>state.players[id].isReady && state.players[id].isConnected), 'Waiting for connected, ready players');
        const category=env.catalog[state.category];
        requireCondition(category, 'Category unavailable');
        const choices=state.gameType==='question'?category.questions:category.words;
        requireCondition(Array.isArray(choices) && choices.length>0,'Category is empty');
        const choice=choices[Math.floor(env.random()*choices.length)];
        // Cryptographically seeded randomness is supplied once per request so
        // transaction retries produce the same assignment for the same roster.
        const shuffled=[...ids].sort();
        for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(env.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
        const imposters=new Set(shuffled.slice(0,state.imposterCount));
        lobbyReset(room,'');
        state.status='playing';state.roundId=env.nextRoundId;state.lastCategory=state.category;
        room.server.roles={};room.server.ballots={};
        if(state.gameType==='question') room.server.secretQuestion=choice;
        else room.server.secretWord=choice;
        for(const id of ids){
            const isImposter=imposters.has(id);
            room.server.roles[id]=isImposter;
            state.players[id].isReady=false;
            room.private[id]={roundId:state.roundId,isImposter};
            if(state.gameType==='question') room.private[id].secretQuestion=isImposter?{imposter:choice.imposter}:{real:choice.real};
            else if(!isImposter) room.private[id].secretWord=choice;
        }
    }
    if (['seen','answer','ready'].includes(action)) {
        requireCondition(state.status==='playing','Wrong phase');
        if(action==='answer') {
            requireCondition(state.gameType==='question' && !player.answer,'Answer already submitted or wrong mode');
            player.answer=text(payload.answer,100,'answer');player.hasSeenWord=true;
        }
        if(action==='seen') player.hasSeenWord=true;
        if(action==='ready') {requireCondition(player.hasSeenWord,'Reveal your word first');player.isReady=true;}
        const all=Object.values(state.players).every(p=>state.gameType==='question'?p.hasSeenWord&&p.answer:p.isReady);
        state.discussionReady=!!all;
        if(all && state.gameType==='question') state.secretQuestion={real:room.server.secretQuestion.real};
    }
    if(action==='toggleReady') {
        requireCondition(['lobby','results'].includes(state.status),'Wrong phase');
        player.isReady=player.isHost?true:!player.isReady;
    }
    if(action==='startVoting') {requireCondition(state.status==='playing' && state.discussionReady,'Not ready for voting');state.status='voting';}
    if(action==='vote') {
        requireCondition(state.status==='voting','Wrong phase');
        requireCondition(!room.server.ballots?.[uid],'Already voted');
        requireCondition(payload.target==='skip'||(payload.target!==uid&&has(room.members,payload.target)),'Invalid vote target');
        room.server.ballots ||= {};
        room.server.ballots[uid]=payload.target;
        player.vote=state.anonymousVoting?true:payload.target;
        if(Object.keys(room.server.ballots).length===Object.keys(room.members).length) finish(room);
    }
    if(action==='results') requireCondition(state.status==='results','Results not ready');
    if(action==='nextRound') {requireCondition(['lobby','results'].includes(state.status),'Wrong phase');lobbyReset(room,'');}
    if(action==='leave') depart(room,uid);
    state.revision++;
    room.server.commands[commandKey]=fingerprint;
    // Commands are scoped by UID and phase/round. Bound retained retry receipts.
    const keys=Object.keys(room.server.commands);
    for(const key of keys.slice(0,Math.max(0,keys.length-256))) delete room.server.commands[key];
    return room;
}
export function updatePresence(input, uid, connected, now) {
    const room=normalize(structuredClone(input));
    if(!has(room.members,uid)||room.public.status==='closed')return room;
    const player=room.public.players[uid];
    player.isConnected=connected;
    if(connected)delete room.server.disconnects[uid];
    else if(!room.server.disconnects[uid])room.server.disconnects[uid]=now+60000;
    room.public.paused=active(room)&&Object.values(room.public.players).some(p=>!p.isConnected);
    room.public.revision++;
    return room;
}
export function settleDisconnect(input, uid, deadline, now) {
    const room=normalize(structuredClone(input));
    if(!has(room.members,uid)||room.server.disconnects[uid]!==deadline||now<deadline||room.public.players[uid].isConnected)return room;
    depart(room,uid);room.public.revision++;
    return room;
}
