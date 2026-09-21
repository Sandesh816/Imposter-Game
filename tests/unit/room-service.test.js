import { describe, expect, test } from 'vitest';
import { applyCommand, updatePresence, settleDisconnect } from '../../functions/room-service.js';
const env = { now: 1000, nextRoundId: 'round-1', random: () => 0, catalog: { countries: { words: ['Canada','Japan','Egypt'] }, 'q:twistAndTurn': { questions: [{real:'Favorite food?',imposter:'Worst food?'}] } } };
let sequence = 0;
function command(room, uid, action, payload = {}, overrides = {}) {
  return applyCommand(room, { uid, commandId: `command-${++sequence}`, action, payload, roundId: room?.public.roundId || null, ...overrides }, env);
}
function lobby() {
  let room = command(null, 'host', 'create', {name:'Host'});
  room = command(room, 'alice', 'join', {name:'Alice'});
  room = command(room, 'bob', 'join', {name:'Bob'});
  for (const uid of ['host','alice','bob']) room = updatePresence(room, uid, true, env.now);
  room = command(room, 'alice', 'toggleReady');
  return command(room, 'bob', 'toggleReady');
}
function playing(gameType='word') {
  let room = lobby();
  if(gameType==='question') room = command(room,'host','configure',{gameType});
  return command(room,'host','start');
}
function voting() {
  let room = playing();
  for(const uid of ['host','alice','bob']) {
    room = command(room,uid,'seen'); room = command(room,uid,'ready');
  }
  return command(room,'host','startVoting');
}
describe('authoritative room transitions', () => {
  test('joining does not grant host privileges', () => {
    const room = lobby();
    expect(()=>command(room,'alice','configure',{imposterCount:2})).toThrow(/host/);
    expect(()=>command(room,'outsider','start')).toThrow(/member/);
    expect(()=>command(room,'host','start',{roles:{host:false}})).toThrow(/field/);
  });
  test('only each private view contains its permitted secret', () => {
    const room = playing();
    expect(JSON.stringify(room.public)).not.toContain('Canada');
    expect(Object.values(room.public.players).some(p=>'isImposter' in p)).toBe(false);
    expect(room.private.bob).toEqual({roundId:'round-1',isImposter:true});
    expect(room.private.alice.secretWord).toBe('Canada');
    expect(room.server.roles.bob).toBe(true);
  });
  test('question answers reveal the regular question only after everyone answers', () => {
    let room=playing('question');
    expect(room.private.bob.secretQuestion).toEqual({imposter:'Worst food?'});
    expect(room.public.secretQuestion).toBeUndefined();
    for(const uid of ['host','alice','bob']) room=command(room,uid,'answer',{answer:'Rice'});
    expect(room.public.discussionReady).toBe(true);
    expect(room.public.secretQuestion).toEqual({real:'Favorite food?'});
  });
  test('duplicate commands cannot start another round and stale votes fail', () => {
    const room=lobby(), req={uid:'host',commandId:'same-command',action:'start',payload:{},roundId:null};
    const first=applyCommand(room,req,env);
    expect(applyCommand(first,req,env)).toEqual(first);
    expect(()=>command(first,'host','vote',{target:'alice'},{roundId:'old'})).toThrow(/round/);
    expect(()=>command(first,'host','start')).toThrow(/phase/);
  });
  test('invalid/self votes fail, anonymous targets stay private, final vote awards once', () => {
    let room=lobby(); room=command(room,'host','configure',{anonymousVoting:true}); room=command(room,'host','start');
    for(const uid of ['host','alice','bob']) {room=command(room,uid,'seen');room=command(room,uid,'ready');}
    room=command(room,'host','startVoting');
    expect(()=>command(room,'host','vote',{target:'missing'})).toThrow(/target/);
    expect(()=>command(room,'host','vote',{target:'host'})).toThrow(/target/);
    room=command(room,'host','vote',{target:'bob'});
    expect(room.public.players.host.vote).toBe(true);
    room=command(room,'alice','vote',{target:'bob'});
    room=command(room,'bob','vote',{target:'host'});
    expect(room.public.status).toBe('results');
    expect(room.public.results.points).toEqual({host:1,alice:1,bob:0});
    expect(()=>command(room,'alice','vote',{target:'bob'})).toThrow(/phase/);
  });
  test('departing before results cancels without points; departing after results retains outcome', () => {
    let room=voting();
    room=command(room,'alice','leave');
    expect(room.public.status).toBe('lobby');
    expect(room.private).toEqual({});
    expect(room.public.results).toBeUndefined();
    room=voting();
    for(const uid of ['host','alice','bob']) room=command(room,uid,'vote',{target:'skip'});
    const result=room.public.results;
    room=command(room,'bob','leave');
    expect(room.public.results).toEqual(result);
    expect(room.public.players.bob).toBeUndefined();
    expect(room.public.results.players.bob).toMatchObject({name:'Bob',isImposter:true,vote:'skip'});
  });
  test('disconnect blocks progression, reconnect invalidates timeout, expiry cancels', () => {
    let room=playing();
    room=updatePresence(room,'alice',false,1000);
    const version=room.server.disconnects.alice;
    expect(room.public.paused).toBe(true);
    expect(()=>command(room,'host','startVoting')).toThrow(/reconnect/);
    room=updatePresence(room,'alice',true,59000);
    expect(settleDisconnect(room,'alice',version,61001)).toEqual(room);
    room=updatePresence(room,'alice',false,62000);
    expect(settleDisconnect(room,'alice',room.server.disconnects.alice,121999).public.status).toBe('playing');
    room=settleDisconnect(room,'alice',room.server.disconnects.alice,122001);
    expect(room.public.status).toBe('lobby');
    expect(room.members.alice).toBeUndefined();
  });
  test('host timeout closes room and reconnecting member keeps identity mid-round', () => {
    let room=playing();
    const before=room.private.alice;
    room=command(room,'alice','join',{name:'Alice'});
    expect(Object.keys(room.members)).toHaveLength(3);
    expect(room.private.alice).toEqual(before);
    room=updatePresence(room,'host',false,1000);
    expect(settleDisconnect(room,'host',room.server.disconnects.host,61000).public.status).toBe('closed');
  });
});
