// ===============================================
// League Module — Firebase-backed Multi-League System
// Each league has a unique 6-char code stored in Firebase RTDB
// localStorage tracks which leagues the user has joined
// ===============================================

import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    update,
    remove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase config (same as multiplayer.js)
import { firebaseConfig } from "./firebase-config.js";

// Re-use auth-app (shared Firebase app instance)
let leagueApp;
try {
    leagueApp = getApp();
} catch {
    leagueApp = initializeApp(firebaseConfig);
}

const db = getDatabase(leagueApp);
const auth = getAuth(leagueApp);

const JOINED_KEY = 'imposter-joined-leagues'; // kept as local fallback

// ===============================================
// Identity Helper
// ===============================================

/** Returns the current user's uid, or null if not authenticated */
function currentUid() {
    return auth.currentUser?.uid ?? null;
}

// ===============================================
// League Membership — Firebase per-user
// ===============================================

/** Save league membership both to Firebase (primary) and localStorage (fallback) */
async function saveLeagueMembership(code) {
    const uid = currentUid();
    if (uid) {
        await set(ref(db, `users/${uid}/leagues/${code}`), true);
    }
    // Also keep localStorage as a fallback/cache
    const codes = getLocalJoinedCodes();
    if (!codes.includes(code)) {
        codes.push(code);
        localStorage.setItem(JOINED_KEY, JSON.stringify(codes));
    }
}

/** Remove league membership from Firebase and localStorage */
async function removeLeagueMembership(code) {
    const uid = currentUid();
    if (uid) {
        await remove(ref(db, `users/${uid}/leagues/${code}`));
    }
    const codes = getLocalJoinedCodes().filter(c => c !== code);
    localStorage.setItem(JOINED_KEY, JSON.stringify(codes));
}

/** Get joined league codes from Firebase (with localStorage fallback) */
async function getJoinedLeagueCodes() {
    const uid = currentUid();
    if (uid) {
        try {
            const snap = await get(ref(db, `users/${uid}/leagues`));
            if (snap.exists()) {
                return Object.keys(snap.val());
            }
        } catch (e) {
            console.warn('Failed to fetch leagues from Firebase, using localStorage fallback');
        }
    }
    return getLocalJoinedCodes();
}

/** Synchronous read from localStorage (used as fallback + migration source) */
function getLocalJoinedCodes() {
    try {
        const raw = localStorage.getItem(JOINED_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// ===============================================
// Code Generation
// ===============================================
function generateLeagueCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ===============================================
// Create / Join / Leave
// ===============================================

/**
 * Create a new league with the given name.
 * Returns the league code.
 */
async function createLeague(leagueName) {
    const code = generateLeagueCode();
    const leagueRef = ref(db, `leagues/${code}`);

    const snap = await get(leagueRef);
    if (snap.exists()) return createLeague(leagueName);

    const uid = currentUid();
    await set(leagueRef, {
        name: leagueName.trim(),
        createdAt: serverTimestamp(),
        createdBy: uid || 'anonymous',
        players: {}
    });

    await saveLeagueMembership(code);
    return code;
}

/**
 * Join an existing league by code.
 * Throws if league doesn't exist.
 */
async function joinLeague(leagueCode) {
    const code = leagueCode.toUpperCase().trim();
    const leagueRef = ref(db, `leagues/${code}`);
    const snap = await get(leagueRef);

    if (!snap.exists()) {
        throw new Error('League not found. Check the code and try again.');
    }

    await saveLeagueMembership(code);
    return code;
}

/**
 * Leave a league (remove from local joined list only).
 */
async function leaveLeague(leagueCode) {
    await removeLeagueMembership(leagueCode);
}

// ===============================================
// Read League Data
// ===============================================

/**
 * Get league info (name + code) for all joined leagues.
 * Returns [{ code, name }]
 */
async function getJoinedLeagues() {
    const codes = await getJoinedLeagueCodes();
    const leagues = [];

    for (const code of codes) {
        try {
            const snap = await get(ref(db, `leagues/${code}`));
            if (snap.exists()) {
                const data = snap.val();
                leagues.push({ code, name: data.name || 'Unnamed League' });
            } else {
                await leaveLeague(code);
            }
        } catch (e) {
            console.error(`Failed to fetch league ${code}:`, e);
        }
    }

    return leagues;
}

/**
 * Get full info for a single league: name, code, sorted standings.
 */
async function getLeagueDetail(leagueCode) {
    const snap = await get(ref(db, `leagues/${leagueCode}`));
    if (!snap.exists()) return null;

    const data = snap.val();
    const players = data.players || {};

    const standings = Object.values(players)
        .map(p => ({
            name: p.displayName,
            points: p.points || 0,
            gamesPlayed: p.gamesPlayed || 0,
            wins: p.wins || 0
        }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins);

    return {
        code: leagueCode,
        name: data.name || 'Unnamed League',
        standings
    };
}

// ===============================================
// Update Points
// ===============================================

/**
 * Add points to a player in a specific league.
 */
async function addPoints(leagueCode, playerName, points, isWin = false) {
    const key = playerName.trim().toLowerCase();
    const playerRef = ref(db, `leagues/${leagueCode}/players/${key}`);

    const snap = await get(playerRef);
    let current = snap.exists() ? snap.val() : {
        displayName: playerName.trim(),
        points: 0,
        gamesPlayed: 0,
        wins: 0
    };

    current.points = (current.points || 0) + points;
    current.gamesPlayed = (current.gamesPlayed || 0) + 1;
    if (isWin) current.wins = (current.wins || 0) + 1;
    current.displayName = playerName.trim();

    await set(playerRef, current);
}

/**
 * Record a game for a player who earned 0 points.
 */
async function recordGame(leagueCode, playerName) {
    const key = playerName.trim().toLowerCase();
    const playerRef = ref(db, `leagues/${leagueCode}/players/${key}`);

    const snap = await get(playerRef);
    let current = snap.exists() ? snap.val() : {
        displayName: playerName.trim(),
        points: 0,
        gamesPlayed: 0,
        wins: 0
    };

    current.gamesPlayed = (current.gamesPlayed || 0) + 1;
    current.displayName = playerName.trim();

    await set(playerRef, current);
}

// ===============================================
// Delete / Reset
// ===============================================

/**
 * Delete a league entirely from Firebase.
 */
async function deleteLeague(leagueCode) {
    await remove(ref(db, `leagues/${leagueCode}`));
    await leaveLeague(leagueCode);
}

/**
 * Get list of member names for a league (based on who has played).
 * Returns array of display names, lowercase-keyed.
 */
async function getLeagueMembers(leagueCode) {
    const snap = await get(ref(db, `leagues/${leagueCode}/players`));
    if (!snap.exists()) return [];
    const players = snap.val();
    return Object.values(players).map(p => p.displayName);
}

export {
    createLeague,
    joinLeague,
    leaveLeague,
    getJoinedLeagues,
    getJoinedLeagueCodes,
    getLeagueDetail,
    addPoints,
    recordGame,
    deleteLeague,
    getLeagueMembers
};
