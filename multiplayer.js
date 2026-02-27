// Multiplayer Module for Secret Word Imposter
// Uses Firebase Realtime Database for real-time synchronization

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    push,
    onValue,
    onDisconnect,
    remove,
    update,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
// Re-use auth-app (shared Firebase app instance)
let mpApp;
try {
    mpApp = getApp();
} catch {
    mpApp = initializeApp(firebaseConfig);
}

const db = getDatabase(mpApp);
const auth = getAuth(mpApp);

// ===============================================
// Multiplayer State
// ===============================================
const multiplayerState = {
    roomCode: null,
    playerId: null,
    playerName: null,
    isHost: false,
    unsubscribe: null,
    chatUnsubscribe: null
};

// ===============================================
// Utility Functions
// ===============================================
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0/O, 1/I
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function cryptoRandom() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xFFFFFFFF + 1);
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(cryptoRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ===============================================
// Room Management
// ===============================================
async function createRoom(playerName, imposterCount = 1, gameType = 'word') {
    const roomCode = generateRoomCode();
    const playerId = generatePlayerId();

    // Check if room code already exists (unlikely but possible)
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
        // Extremely rare: code collision, try again
        return createRoom(playerName, imposterCount, gameType);
    }

    // Create the room
    const roomData = {
        host: playerId,
        status: 'lobby',
        category: 'countries',
        gameType: gameType || 'word',
        secretWord: null,
        secretQuestion: null,
        imposterCount: imposterCount,
        anonymousVoting: false,
        lastCategory: null,
        createdAt: serverTimestamp()
    };

    await set(roomRef, roomData);

    // Add host as first player
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
    await set(playerRef, {
        name: playerName,
        isHost: true,
        isImposter: false,
        hasSeenWord: false,
        isReady: true, // Host is always ready
        vote: null,
        isConnected: true,
        joinedAt: serverTimestamp()
    });

    // Set up disconnect handler
    onDisconnect(playerRef).update({ isConnected: false });

    // Store state
    multiplayerState.roomCode = roomCode;
    multiplayerState.playerId = playerId;
    multiplayerState.playerName = playerName;
    multiplayerState.isHost = true;

    return { roomCode, playerId };
}

async function joinRoom(roomCode, playerName) {
    roomCode = roomCode.toUpperCase().trim();

    // Check if room exists
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
        throw new Error('Room not found. Check the code and try again.');
    }

    const roomData = snapshot.val();

    // Check if game already started
    if (roomData.status !== 'lobby') {
        throw new Error('Game already in progress. Cannot join.');
    }

    // Check player count (max 16 players)
    const playersSnapshot = await get(ref(db, `rooms/${roomCode}/players`));
    const playerCount = playersSnapshot.exists() ? Object.keys(playersSnapshot.val()).length : 0;

    if (playerCount >= 16) {
        throw new Error('Room is full (max 16 players).');
    }

    // Add player to room
    const playerId = generatePlayerId();
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);

    await set(playerRef, {
        name: playerName,
        isHost: false,
        isImposter: false,
        hasSeenWord: false,
        isReady: false,
        vote: null,
        isConnected: true,
        joinedAt: serverTimestamp()
    });

    // Set up disconnect handler
    onDisconnect(playerRef).update({ isConnected: false });

    // Store state
    multiplayerState.roomCode = roomCode;
    multiplayerState.playerId = playerId;
    multiplayerState.playerName = playerName;
    multiplayerState.isHost = false;

    return { roomCode, playerId };
}

async function leaveRoom() {
    if (!multiplayerState.roomCode || !multiplayerState.playerId) return;

    const { roomCode, playerId, isHost } = multiplayerState;

    // Remove player from room
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
    await remove(playerRef);

    // If host is leaving, delete the entire room
    if (isHost) {
        const roomRef = ref(db, `rooms/${roomCode}`);
        await remove(roomRef);
    }

    // Clean up subscriptions
    if (multiplayerState.unsubscribe) {
        multiplayerState.unsubscribe();
    }
    if (multiplayerState.chatUnsubscribe) {
        multiplayerState.chatUnsubscribe();
    }

    // Reset state
    multiplayerState.roomCode = null;
    multiplayerState.playerId = null;
    multiplayerState.playerName = null;
    multiplayerState.isHost = false;
    multiplayerState.unsubscribe = null;
    multiplayerState.chatUnsubscribe = null;
}

// ===============================================
// Game Control (Host Only)
// ===============================================
async function startGame(category, secretWord, imposterCount = 1, gameType = 'word', secretQuestion = null) {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can start the game.');
    }

    const { roomCode } = multiplayerState;

    // Get all players
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snapshot = await get(playersRef);

    if (!snapshot.exists()) {
        throw new Error('No players in room.');
    }

    const players = snapshot.val();
    const playerIds = Object.keys(players);

    if (playerIds.length < 3) {
        throw new Error('Need at least 3 players to start.');
    }

    // Randomly select imposters
    const shuffledIds = shuffleArray(playerIds);
    const imposterIds = shuffledIds.slice(0, imposterCount);

    // Update each player's imposter status
    const updates = {};
    playerIds.forEach(pid => {
        updates[`rooms/${roomCode}/players/${pid}/isImposter`] = imposterIds.includes(pid);
        updates[`rooms/${roomCode}/players/${pid}/hasSeenWord`] = false;
        updates[`rooms/${roomCode}/players/${pid}/isReady`] = false;
        updates[`rooms/${roomCode}/players/${pid}/vote`] = null;
        updates[`rooms/${roomCode}/players/${pid}/answer`] = null;
    });

    // Update room status
    updates[`rooms/${roomCode}/status`] = 'playing';
    updates[`rooms/${roomCode}/category`] = category;
    updates[`rooms/${roomCode}/gameType`] = gameType || 'word';
    updates[`rooms/${roomCode}/secretWord`] = gameType === 'word' ? secretWord : null;
    updates[`rooms/${roomCode}/secretQuestion`] = gameType === 'question' ? secretQuestion : null;

    await update(ref(db), updates);
}

async function startVoting() {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can start voting.');
    }

    const { roomCode } = multiplayerState;
    await update(ref(db, `rooms/${roomCode}`), { status: 'voting' });
}

async function showResults() {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can show results.');
    }

    const { roomCode } = multiplayerState;

    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snapshot = await get(playersRef);
    if (!snapshot.exists()) {
        await update(ref(db, `rooms/${roomCode}`), { status: 'results' });
        return;
    }

    const players = snapshot.val();
    const results = calculateVoteResults(players);
    const imposterIdSet = new Set(results.imposterIds);

    const pointsMap = {};
    Object.keys(players).forEach(pid => {
        pointsMap[pid] = 0;
    });

    const correctVote = results.imposterIds.length > 0 && results.eliminated && imposterIdSet.has(results.eliminated) && !results.tie;

    if (correctVote) {
        Object.keys(players).forEach(pid => {
            if (!imposterIdSet.has(pid)) {
                pointsMap[pid] = 1;
            }
        });
    } else if (results.imposterWins) {
        results.imposterIds.forEach(pid => {
            pointsMap[pid] = 1;
        });
    }

    await addRoomPoints(pointsMap);
    await update(ref(db, `rooms/${roomCode}`), { status: 'results' });
}

async function newRound() {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can start a new round.');
    }

    const { roomCode } = multiplayerState;

    // Reset all player states
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snapshot = await get(playersRef);

    if (snapshot.exists()) {
        const players = snapshot.val();
        const updates = {};

        Object.keys(players).forEach(pid => {
            updates[`rooms/${roomCode}/players/${pid}/isImposter`] = false;
            updates[`rooms/${roomCode}/players/${pid}/hasSeenWord`] = false;
            // Reset ready status (Host assumes ready, others must confirm)
            updates[`rooms/${roomCode}/players/${pid}/isReady`] = pid === multiplayerState.playerId;
            updates[`rooms/${roomCode}/players/${pid}/vote`] = null;
        });

        updates[`rooms/${roomCode}/status`] = 'lobby';
        // Keep category if possible, or reset to countries if strictly needed, 
        // but typically returning to lobby preserves settings. 
        // However, user said "Change Settings" takes you out.
        // Let's keep category as is, or default to countries.
        // Actually, user wants "All players in lobby can see the category".
        // So we should NOT set category to null. We should keep it.
        // updates[`rooms/${roomCode}/category`] = null; 

        updates[`rooms/${roomCode}/secretWord`] = null;
        updates[`rooms/${roomCode}/secretQuestion`] = null;
        Object.keys(players).forEach(pid => {
            updates[`rooms/${roomCode}/players/${pid}/answer`] = null;
        });

        await update(ref(db), updates);
    }
}

async function returnToLobby() {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can return to lobby.');
    }

    await newRound();
}

// ===============================================
// Player Actions
// ===============================================
async function markWordSeen() {
    const { roomCode, playerId } = multiplayerState;
    if (!roomCode || !playerId) return;

    await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
        hasSeenWord: true
    });
}

async function submitAnswer(answerText) {
    const { roomCode, playerId } = multiplayerState;
    if (!roomCode || !playerId) return;

    await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
        answer: (answerText || '').trim(),
        hasSeenWord: true // Treat as "done" for question mode
    });
}

async function markReady() {
    const { roomCode, playerId } = multiplayerState;
    if (!roomCode || !playerId) return;

    await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
        isReady: true
    });
}

async function castVote(targetPlayerId) {
    const { roomCode, playerId } = multiplayerState;
    if (!roomCode || !playerId) return;

    // null means skip vote
    await update(ref(db, `rooms/${roomCode}/players/${playerId}`), {
        vote: targetPlayerId
    });
}

async function updateImposterCount(count) {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can change imposter count.');
    }

    const { roomCode } = multiplayerState;
    await update(ref(db, `rooms/${roomCode}`), { imposterCount: count });
}

// ===============================================
// Real-time Subscriptions
// ===============================================
function subscribeToRoom(callback) {
    const { roomCode } = multiplayerState;
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            callback(data);
        } else {
            // Room was deleted (host left)
            callback(null);
        }
    });

    multiplayerState.unsubscribe = unsubscribe;
    return unsubscribe;
}

function subscribeToChat(callback) {
    const { roomCode } = multiplayerState;
    if (!roomCode) return;

    const chatRef = ref(db, `rooms/${roomCode}/chat`);

    const unsubscribe = onValue(chatRef, (snapshot) => {
        if (snapshot.exists()) {
            const messages = snapshot.val();
            // Convert to array and sort by timestamp
            const msgArray = Object.entries(messages).map(([id, msg]) => ({
                id,
                ...msg
            })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            callback(msgArray);
        } else {
            callback([]);
        }
    });

    multiplayerState.chatUnsubscribe = unsubscribe;
    return unsubscribe;
}

// ===============================================
// Chat
// ===============================================
async function sendChatMessage(text) {
    const { roomCode, playerId, playerName } = multiplayerState;
    if (!roomCode || !playerId || !text.trim()) return;

    const chatRef = ref(db, `rooms/${roomCode}/chat`);
    await push(chatRef, {
        playerId,
        playerName,
        text: text.trim().substring(0, 100), // Limit to 100 chars
        timestamp: serverTimestamp()
    });
}

// ===============================================
// Getters
// ===============================================
function getState() {
    return { ...multiplayerState };
}

function isHost() {
    return multiplayerState.isHost;
}

function getPlayerId() {
    return multiplayerState.playerId;
}

function getRoomCode() {
    return multiplayerState.roomCode;
}

// ===============================================
// Vote Calculation
// ===============================================
function calculateVoteResults(players) {
    const votes = {};
    let totalVotes = 0;
    let skippedVotes = 0;

    Object.entries(players).forEach(([pid, player]) => {
        if (player.vote === 'skip') {
            skippedVotes++;
            totalVotes++;
        } else if (player.vote) {
            votes[player.vote] = (votes[player.vote] || 0) + 1;
            totalVotes++;
        }
    });

    // Find who got the most votes
    let maxVotes = 0;
    let eliminated = null;
    let tie = false;

    Object.entries(votes).forEach(([pid, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            eliminated = pid;
            tie = false;
        } else if (count === maxVotes) {
            tie = true;
        }
    });

    // Check if skip won
    if (skippedVotes > maxVotes) {
        eliminated = null;
        tie = false;
    } else if (skippedVotes === maxVotes) {
        tie = true;
    }

    // Determine winner
    const imposterIds = Object.entries(players)
        .filter(([_, p]) => p.isImposter)
        .map(([id, _]) => id);

    let imposterWins = false;

    if (tie || !eliminated) {
        // No one eliminated = imposter survives = imposter wins
        imposterWins = true;
    } else if (imposterIds.includes(eliminated)) {
        // Imposter was voted out = crew wins
        imposterWins = false;
    } else {
        // Wrong person voted out = imposter wins
        imposterWins = true;
    }

    return {
        votes,
        skippedVotes,
        totalVotes,
        eliminated,
        tie,
        imposterWins,
        imposterIds
    };
}

// ===============================================
// Lobby Ready (for post-game)
// ===============================================
async function toggleLobbyReady() {
    const { roomCode, playerId } = multiplayerState;
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);

    // Get current ready state
    const snapshot = await get(playerRef);
    if (snapshot.exists()) {
        const currentReady = snapshot.val().isReady;
        await update(playerRef, { isReady: !currentReady });
    }
}

async function setAnonymousVoting(isAnonymous) {
    if (!multiplayerState.isHost) return;

    const { roomCode } = multiplayerState;
    await update(ref(db, `rooms/${roomCode}`), { anonymousVoting: isAnonymous });
}

async function playAgain(category, secretWord, gameType = 'word', secretQuestion = null) {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can start a new game.');
    }

    const { roomCode } = multiplayerState;

    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snapshot = await get(playersRef);

    if (snapshot.exists()) {
        const players = snapshot.val();
        const playerIds = Object.keys(players);
        const imposterCountRef = ref(db, `rooms/${roomCode}/imposterCount`);
        const imposterSnapshot = await get(imposterCountRef);
        const imposterCount = imposterSnapshot.exists() ? imposterSnapshot.val() : 1;

        const shuffledIds = shuffleArray(playerIds);
        const imposterIds = shuffledIds.slice(0, imposterCount);

        const updates = {};

        Object.keys(players).forEach(pid => {
            updates[`rooms/${roomCode}/players/${pid}/isImposter`] = imposterIds.includes(pid);
            updates[`rooms/${roomCode}/players/${pid}/hasSeenWord`] = false;
            updates[`rooms/${roomCode}/players/${pid}/isReady`] = false;
            updates[`rooms/${roomCode}/players/${pid}/vote`] = null;
            updates[`rooms/${roomCode}/players/${pid}/answer`] = null;
        });

        updates[`rooms/${roomCode}/status`] = 'playing';
        updates[`rooms/${roomCode}/category`] = category;
        updates[`rooms/${roomCode}/gameType`] = gameType || 'word';
        updates[`rooms/${roomCode}/secretWord`] = gameType === 'word' ? secretWord : null;
        updates[`rooms/${roomCode}/secretQuestion`] = gameType === 'question' ? secretQuestion : null;
        updates[`rooms/${roomCode}/lastCategory`] = category;

        await update(ref(db), updates);
    }
}

async function resetForNewGame() {
    if (!multiplayerState.isHost) return;

    const { roomCode, playerId } = multiplayerState;
    const playersRef = ref(db, `rooms/${roomCode}/players`);
    const snapshot = await get(playersRef);

    if (snapshot.exists()) {
        const players = snapshot.val();
        const updates = {};

        Object.keys(players).forEach(pid => {
            updates[`rooms/${roomCode}/players/${pid}/isImposter`] = false;
            updates[`rooms/${roomCode}/players/${pid}/hasSeenWord`] = false;
            updates[`rooms/${roomCode}/players/${pid}/isReady`] = pid === playerId;
            updates[`rooms/${roomCode}/players/${pid}/vote`] = null;
        });

        updates[`rooms/${roomCode}/status`] = 'lobby';
        updates[`rooms/${roomCode}/secretWord`] = null;
        updates[`rooms/${roomCode}/lastCategory`] = null;

        await update(ref(db), updates);
    }
}

async function addRoomPoints(pointsMap) {
    const { roomCode } = multiplayerState;
    if (!roomCode) return;

    const scoresRef = ref(db, `rooms/${roomCode}/scores`);
    const snapshot = await get(scoresRef);
    const currentScores = snapshot.exists() ? snapshot.val() : {};

    const updates = {};
    Object.entries(pointsMap).forEach(([pid, points]) => {
        const current = currentScores[pid] || 0;
        updates[`rooms/${roomCode}/scores/${pid}`] = current + points;
    });

    await update(ref(db), updates);
}

async function setCategory(category) {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can set the category.');
    }
    const { roomCode } = multiplayerState;
    await update(ref(db, `rooms/${roomCode}`), { category });
}

async function setGameType(gameType) {
    if (!multiplayerState.isHost) {
        throw new Error('Only the host can change game type.');
    }
    const { roomCode } = multiplayerState;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    const updates = { gameType: gameType || 'word' };
    // When switching to question, default category if current is word category
    if (gameType === 'question' && snap.exists()) {
        const cat = snap.val().category;
        if (!cat || !cat.startsWith('q:')) {
            updates.category = 'q:twistAndTurn';
        }
    }
    await update(roomRef, updates);
}

// ===============================================
// Export
// ===============================================
export {
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    startVoting,
    showResults,
    newRound,
    returnToLobby,
    markWordSeen,
    submitAnswer,
    markReady,
    castVote,
    updateImposterCount,
    setAnonymousVoting,
    toggleLobbyReady,
    playAgain,
    resetForNewGame,
    setCategory,
    setGameType,
    addRoomPoints,
    subscribeToRoom,
    subscribeToChat,
    sendChatMessage,
    getState,
    isHost,
    getPlayerId,
    getRoomCode,
    calculateVoteResults
};
