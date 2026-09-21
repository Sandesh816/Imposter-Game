// The browser sends intentions; the trusted service owns game decisions.
import { ref, onValue, onDisconnect, push, set, remove, serverTimestamp } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { auth, database as db, functions } from './firebase-client.js';
export { calculateVoteResults } from './multiplayerLogic.js';

const invoke=httpsCallable(functions,'roomCommand');
const STORAGE_KEY='imposter-active-room-v2';
const state={roomCode:null,playerId:null,playerName:null,isHost:false,roundId:null};
let roomUnsubs=[],chatUnsub=null,connectionUnsub=null,connectionRef=null;
let publicView=null,privateView=null;
async function command(action,payload={},code=state.roomCode) {
    await auth.authStateReady();
    if(!auth.currentUser)throw new Error('Sign in before joining a room.');
    const request={commandId:crypto.randomUUID(),action,payload,roundId:state.roundId};
    if(code)request.code=code;
    // Retrying a network failure reuses the same command ID, never creates a
    // second round. Authorization and application errors are not retried.
    let result;
    try { result=await invoke(request); }
    catch(error){
        if(!['functions/unavailable','functions/deadline-exceeded'].includes(error.code))throw error;
        result=await invoke(request);
    }
    state.roundId=result.data.roundId;
    return result.data;
}
function stopSubscriptions() {
    roomUnsubs.forEach(unsub=>unsub());roomUnsubs=[];
    chatUnsub?.();chatUnsub=null;
    connectionUnsub?.();connectionUnsub=null;
}
async function connectPresence() {
    connectionUnsub?.();
    connectionRef=ref(db,`roomsV2/${state.roomCode}/connections/${state.playerId}/${crypto.randomUUID()}`);
    const target=connectionRef;
    connectionUnsub=onValue(ref(db,'.info/connected'),async snapshot=>{
        if(!snapshot.val())return;
        try {await onDisconnect(target).remove();await set(target,true);}
        catch(error){console.warn('Could not update room presence:',error.code);}
    });
}
async function enter(result,name) {
    stopSubscriptions();publicView=null;privateView=null;
    state.roomCode=result.code;state.playerId=auth.currentUser.uid;state.playerName=name;
    state.roundId=result.roundId;state.isHost=false;
    localStorage.setItem(STORAGE_KEY,JSON.stringify({code:result.code,uid:state.playerId,name}));
    await connectPresence();
    return {roomCode:state.roomCode,playerId:state.playerId};
}
export async function createRoom(name,imposterCount=1,gameType='word') {
    const result=await command('create',{name,imposterCount,gameType},null);
    const entered=await enter(result,name);state.isHost=true;return entered;
}
export async function joinRoom(code,name) {
    const result=await command('join',{name},code.trim().toUpperCase());
    return enter(result,name);
}
export async function restoreRoom() {
    if(state.roomCode)return null;
    let saved;
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY));}catch{return null;}
    if(!saved||saved.uid!==auth.currentUser?.uid)return null;
    try{return await joinRoom(saved.code,saved.name);}
    catch(error){
        if(['functions/not-found','functions/permission-denied','functions/failed-precondition'].includes(error.code))localStorage.removeItem(STORAGE_KEY);
        throw error;
    }
}
export async function leaveRoom() {
    if(!state.roomCode)return;
    await command('leave');
    stopSubscriptions();
    if(connectionRef){await onDisconnect(connectionRef).cancel().catch(()=>{});await remove(connectionRef).catch(()=>{});connectionRef=null;}
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state,{roomCode:null,playerId:null,playerName:null,isHost:false,roundId:null});
    publicView=null;privateView=null;
}
export function subscribeToRoom(callback) {
    roomUnsubs.forEach(unsub=>unsub());
    const code=state.roomCode,uid=state.playerId;
    function emit() {
        if(!publicView)return;
        if(publicView.status==='closed'){
            localStorage.removeItem(STORAGE_KEY);stopSubscriptions();state.roomCode=null;callback(null);return;
        }
        const inRound=['playing','voting'].includes(publicView.status);
        if(inRound&&privateView?.roundId!==publicView.roundId)return;
        const data=structuredClone(publicView);
        data.roomCode=code;
        state.isHost=data.host===uid;state.roundId=data.roundId||null;
        if(inRound){
            if(!data.players?.[uid])return;
            data.players[uid].isImposter=privateView.isImposter;
            if(privateView.secretWord)data.secretWord=privateView.secretWord;
            if(privateView.secretQuestion)data.secretQuestion={...privateView.secretQuestion,...data.secretQuestion};
        }
        callback(data);
    }
    const fail=error=>{
        if(error.code==='PERMISSION_DENIED'||error.code==='permission-denied'){
            stopSubscriptions();localStorage.removeItem(STORAGE_KEY);state.roomCode=null;callback(null);
        }else console.warn('Room subscription failed:',error.code);
    };
    roomUnsubs=[
        onValue(ref(db,`roomsV2/${code}/public`),snap=>{publicView=snap.val();if(!publicView){callback(null);return;}emit();},fail),
        onValue(ref(db,`roomsV2/${code}/private/${uid}`),snap=>{privateView=snap.val();emit();},fail)
    ];
    return ()=>{roomUnsubs.forEach(unsub=>unsub());roomUnsubs=[];};
}
export function subscribeToChat(callback) {
    chatUnsub?.();
    chatUnsub=onValue(ref(db,`roomsV2/${state.roomCode}/chat`),snap=>{
        callback(Object.entries(snap.val()||{}).map(([id,value])=>({id,...value})).sort((a,b)=>a.timestamp-b.timestamp));
    },error=>console.warn('Chat subscription ended:',error.code));
    return chatUnsub;
}
export async function sendChatMessage(value) {
    const text=String(value).trim().slice(0,100);if(!text)return;
    return set(push(ref(db,`roomsV2/${state.roomCode}/chat`)),{playerId:state.playerId,playerName:publicView.players[state.playerId].name,text,timestamp:serverTimestamp()});
}
// Retain UI call signatures while discarding browser-selected secrets.
export async function startGame(category,_word,imposterCount=1,gameType='word',_question=null) {
    const settings={gameType,imposterCount};
    // Configure game type before category so its default cannot overwrite it.
    await command('configure',settings);
    await command('configure',{category});
    return command('start');
}
export async function playAgain(category,word,gameType='word',question=null){return startGame(category,word,publicView?.imposterCount||1,gameType,question);}
export const startVoting=()=>command('startVoting');
export const showResults=()=>Promise.resolve(); // final ballot commits results on the service
export const newRound=()=>command('nextRound');
export const returnToLobby=newRound;
export const resetForNewGame=newRound;
export const markWordSeen=()=>command('seen');
export const submitAnswer=answer=>command('answer',{answer});
export const markReady=()=>command('ready');
export const castVote=target=>command('vote',{target:target||'skip'});
export const updateImposterCount=imposterCount=>command('configure',{imposterCount});
export const setAnonymousVoting=anonymousVoting=>command('configure',{anonymousVoting});
export const toggleLobbyReady=()=>command('toggleReady');
export const setCategory=category=>command('configure',{category});
export const setGameType=gameType=>command('configure',{gameType});
export const getState=()=>({...state});
export const isHost=()=>state.isHost;
export const getPlayerId=()=>state.playerId;
export const getRoomCode=()=>state.roomCode;
