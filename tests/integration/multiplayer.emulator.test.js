import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, push, ref, set, update } from 'firebase/database';
import { calculateRoundPoints, calculateVoteResults } from '../../multiplayerLogic.js';

const PROJECT_ID = 'imposter-sandeshg';

function getDbHostPort() {
  const raw = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9002';
  const [host, portText] = raw.split(':');
  const port = Number(portText);
  return { host, port: Number.isFinite(port) ? port : 9002 };
}

function roomSeed(hostUid) {
  return {
    host: hostUid,
    status: 'lobby',
    category: 'countries',
    gameType: 'word',
    secretWord: null,
    secretQuestion: null,
    imposterCount: 1,
    anonymousVoting: false,
    lastCategory: null,
    createdAt: Date.now(),
  };
}

let testEnv;

beforeAll(async () => {
  const { host, port } = getDbHostPort();
  const rules = readFileSync(path.resolve(process.cwd(), 'database.rules.json'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { host, port, rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearDatabase();
});

function dbFor(uid) {
  return testEnv.authenticatedContext(uid).database();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().database();
}

describe('multiplayer emulator integration', () => {
  it('enforces auth requirement for rooms read/write', async () => {
    const guestDb = unauthDb();
    await assertFails(set(ref(guestDb, 'rooms/AUTH01'), roomSeed('host1')));
    await assertFails(get(ref(guestDb, 'rooms/AUTH01')));

    const hostDb = dbFor('host1');
    await assertSucceeds(set(ref(hostDb, 'rooms/AUTH01'), roomSeed('host1')));
    const snap = await assertSucceeds(get(ref(hostDb, 'rooms/AUTH01')));
    expect(snap.exists()).toBe(true);
    expect(snap.val().status).toBe('lobby');
  });

  it('supports room lifecycle: lobby -> playing -> voting -> results with synced scores', async () => {
    const roomCode = 'ROOM01';
    const hostUid = 'host';
    const playerAUid = 'alice';
    const playerBUid = 'bob';

    const hostDb = dbFor(hostUid);
    const playerADb = dbFor(playerAUid);
    const playerBDb = dbFor(playerBUid);

    await assertSucceeds(set(ref(hostDb, `rooms/${roomCode}`), roomSeed(hostUid)));
    await assertSucceeds(set(ref(hostDb, `rooms/${roomCode}/players/${hostUid}`), {
      name: 'Host',
      isHost: true,
      isImposter: false,
      hasSeenWord: false,
      isReady: true,
      vote: null,
      isConnected: true,
      joinedAt: Date.now(),
    }));
    await assertSucceeds(set(ref(playerADb, `rooms/${roomCode}/players/${playerAUid}`), {
      name: 'Alice',
      isHost: false,
      isImposter: false,
      hasSeenWord: false,
      isReady: false,
      vote: null,
      isConnected: true,
      joinedAt: Date.now(),
    }));
    await assertSucceeds(set(ref(playerBDb, `rooms/${roomCode}/players/${playerBUid}`), {
      name: 'Bob',
      isHost: false,
      isImposter: false,
      hasSeenWord: false,
      isReady: false,
      vote: null,
      isConnected: true,
      joinedAt: Date.now(),
    }));

    const lobbySeenByPlayer = await assertSucceeds(get(ref(playerADb, `rooms/${roomCode}`)));
    expect(lobbySeenByPlayer.val().status).toBe('lobby');

    const startUpdates = {
      [`rooms/${roomCode}/status`]: 'playing',
      [`rooms/${roomCode}/category`]: 'countries',
      [`rooms/${roomCode}/gameType`]: 'word',
      [`rooms/${roomCode}/secretWord`]: 'Canada',
      [`rooms/${roomCode}/players/${hostUid}/isImposter`]: false,
      [`rooms/${roomCode}/players/${playerAUid}/isImposter`]: false,
      [`rooms/${roomCode}/players/${playerBUid}/isImposter`]: true,
      [`rooms/${roomCode}/players/${hostUid}/hasSeenWord`]: false,
      [`rooms/${roomCode}/players/${playerAUid}/hasSeenWord`]: false,
      [`rooms/${roomCode}/players/${playerBUid}/hasSeenWord`]: false,
      [`rooms/${roomCode}/players/${hostUid}/isReady`]: false,
      [`rooms/${roomCode}/players/${playerAUid}/isReady`]: false,
      [`rooms/${roomCode}/players/${playerBUid}/isReady`]: false,
      [`rooms/${roomCode}/players/${hostUid}/vote`]: null,
      [`rooms/${roomCode}/players/${playerAUid}/vote`]: null,
      [`rooms/${roomCode}/players/${playerBUid}/vote`]: null,
    };
    await assertSucceeds(update(ref(hostDb), startUpdates));

    await assertSucceeds(update(ref(hostDb, `rooms/${roomCode}/players/${hostUid}`), { hasSeenWord: true, isReady: true }));
    await assertSucceeds(update(ref(playerADb, `rooms/${roomCode}/players/${playerAUid}`), { hasSeenWord: true, isReady: true }));
    await assertSucceeds(update(ref(playerBDb, `rooms/${roomCode}/players/${playerBUid}`), { hasSeenWord: true, isReady: true }));

    await assertSucceeds(update(ref(hostDb, `rooms/${roomCode}`), { status: 'voting' }));
    await assertSucceeds(update(ref(hostDb, `rooms/${roomCode}/players/${hostUid}`), { vote: playerBUid }));
    await assertSucceeds(update(ref(playerADb, `rooms/${roomCode}/players/${playerAUid}`), { vote: playerBUid }));
    await assertSucceeds(update(ref(playerBDb, `rooms/${roomCode}/players/${playerBUid}`), { vote: hostUid }));

    const playersSnap = await assertSucceeds(get(ref(hostDb, `rooms/${roomCode}/players`)));
    const players = playersSnap.val();
    const voteResults = calculateVoteResults(players);
    const pointsMap = calculateRoundPoints(players, voteResults);

    expect(voteResults.eliminated).toBe(playerBUid);
    expect(voteResults.imposterWins).toBe(false);
    expect(pointsMap).toEqual({
      [hostUid]: 1,
      [playerAUid]: 1,
      [playerBUid]: 0,
    });

    const resultUpdates = {
      [`rooms/${roomCode}/status`]: 'results',
      [`rooms/${roomCode}/scores/${hostUid}`]: pointsMap[hostUid],
      [`rooms/${roomCode}/scores/${playerAUid}`]: pointsMap[playerAUid],
      [`rooms/${roomCode}/scores/${playerBUid}`]: pointsMap[playerBUid],
    };
    await assertSucceeds(update(ref(hostDb), resultUpdates));

    const roomFromHost = await assertSucceeds(get(ref(hostDb, `rooms/${roomCode}`)));
    const roomFromPlayer = await assertSucceeds(get(ref(playerBDb, `rooms/${roomCode}`)));

    expect(roomFromHost.val().status).toBe('results');
    expect(roomFromPlayer.val().status).toBe('results');
    expect(roomFromHost.val().scores).toEqual({
      [hostUid]: 1,
      [playerAUid]: 1,
      [playerBUid]: 0,
    });
  });

  it('synchronizes multiplayer chat messages for authenticated clients', async () => {
    const roomCode = 'CHAT01';
    const hostDb = dbFor('host');
    const playerDb = dbFor('player');

    await assertSucceeds(set(ref(hostDb, `rooms/${roomCode}`), roomSeed('host')));
    await assertSucceeds(set(ref(hostDb, `rooms/${roomCode}/players/host`), {
      name: 'Host',
      isHost: true,
      isImposter: false,
      hasSeenWord: false,
      isReady: true,
      vote: null,
      isConnected: true,
      joinedAt: Date.now(),
    }));
    await assertSucceeds(set(ref(playerDb, `rooms/${roomCode}/players/player`), {
      name: 'Player',
      isHost: false,
      isImposter: false,
      hasSeenWord: false,
      isReady: false,
      vote: null,
      isConnected: true,
      joinedAt: Date.now(),
    }));

    const chatRef = ref(hostDb, `rooms/${roomCode}/chat`);
    await assertSucceeds(push(chatRef, {
      playerId: 'host',
      playerName: 'Host',
      text: 'hello team',
      timestamp: Date.now(),
    }));
    await assertSucceeds(push(chatRef, {
      playerId: 'player',
      playerName: 'Player',
      text: 'ready',
      timestamp: Date.now() + 1,
    }));

    const chatSnap = await assertSucceeds(get(ref(playerDb, `rooms/${roomCode}/chat`)));
    const messages = Object.values(chatSnap.val() || {});
    const texts = messages.map((m) => m.text).sort();
    expect(texts).toEqual(['hello team', 'ready']);
  });
});
