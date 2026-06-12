// ===============================================
// League Module — Cloud + Local Offline
// Cloud leagues: Firebase-backed with sharable code
// Local leagues: device-only, offline-capable
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

import { firebaseConfig } from "./firebase-config.js";

let leagueApp;
try {
    leagueApp = getApp();
} catch {
    leagueApp = initializeApp(firebaseConfig);
}

const db = getDatabase(leagueApp);
const auth = getAuth(leagueApp);

const JOINED_KEY = 'imposter-joined-leagues';
const LOCAL_LEAGUES_KEY = 'imposter-local-leagues-v1';
const LOCAL_PREFIX = 'LOCAL-';

function currentUid() {
    return auth.currentUser?.uid ?? null;
}

function normalizeName(name) {
    return (name || '').trim();
}

function playerKey(name) {
    return normalizeName(name).toLowerCase();
}

function isLocalLeagueCode(leagueCode) {
    return typeof leagueCode === 'string' && leagueCode.startsWith(LOCAL_PREFIX);
}

function dedupeNames(names) {
    const unique = [];
    const seen = new Set();
    (Array.isArray(names) ? names : []).forEach((name) => {
        const trimmed = normalizeName(name);
        if (!trimmed) return;
        const key = playerKey(trimmed);
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(trimmed);
    });
    return unique;
}

function rosterMapFromNames(names) {
    const now = Date.now();
    const roster = {};
    dedupeNames(names).forEach((name) => {
        const key = playerKey(name);
        roster[key] = {
            displayName: name,
            createdAt: now,
            updatedAt: now
        };
    });
    return roster;
}

function playersMapFromRoster(roster) {
    const players = {};
    Object.entries(roster || {}).forEach(([key, member]) => {
        players[key] = {
            displayName: member.displayName,
            points: 0,
            gamesPlayed: 0,
            wins: 0
        };
    });
    return players;
}

function mergeMemberNames(data) {
    const seen = new Set();
    const names = [];
    Object.values(data?.roster || {}).forEach((member) => {
        const name = normalizeName(member?.displayName);
        if (!name) return;
        const key = playerKey(name);
        if (seen.has(key)) return;
        seen.add(key);
        names.push(name);
    });
    Object.values(data?.players || {}).forEach((player) => {
        const name = normalizeName(player?.displayName);
        if (!name) return;
        const key = playerKey(name);
        if (seen.has(key)) return;
        seen.add(key);
        names.push(name);
    });
    return names;
}

function standingsFromPlayers(players) {
    return Object.values(players || {})
        .map((player) => ({
            name: player.displayName,
            points: player.points || 0,
            gamesPlayed: player.gamesPlayed || 0,
            wins: player.wins || 0
        }))
        .sort((a, b) => (
            (b.points - a.points)
            || (b.wins - a.wins)
            || (b.gamesPlayed - a.gamesPlayed)
            || a.name.localeCompare(b.name)
        ));
}

function getLocalJoinedCodes() {
    try {
        const raw = localStorage.getItem(JOINED_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalJoinedCodes(codes) {
    localStorage.setItem(JOINED_KEY, JSON.stringify(codes));
}

function loadLocalLeaguesMap() {
    try {
        const raw = localStorage.getItem(LOCAL_LEAGUES_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveLocalLeaguesMap(map) {
    localStorage.setItem(LOCAL_LEAGUES_KEY, JSON.stringify(map));
}

function generateLeagueCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generateLocalLeagueCode(existing) {
    let next = '';
    do {
        next = `${LOCAL_PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    } while (existing[next]);
    return next;
}

function canAdminCloudLeague(data, uid) {
    if (!uid && data?.createdBy === 'anonymous') return true;
    if (!uid) return false;
    if (data?.admins && data.admins[uid]) return true;
    if (data?.createdBy && data.createdBy === uid) return true;
    if (!data?.admins && !data?.createdBy) return true;
    return false;
}

async function assertCloudAdmin(leagueCode) {
    const snap = await get(ref(db, `leagues/${leagueCode}`));
    if (!snap.exists()) {
        throw new Error('League not found.');
    }
    const data = snap.val();
    if (!canAdminCloudLeague(data, currentUid())) {
        throw new Error('Only league admins can manage this league.');
    }
    return data;
}

async function saveLeagueMembership(code) {
    const uid = currentUid();
    if (uid) {
        await set(ref(db, `users/${uid}/leagues/${code}`), true);
    }
    const codes = getLocalJoinedCodes();
    if (!codes.includes(code)) {
        codes.push(code);
        saveLocalJoinedCodes(codes);
    }
}

async function removeLeagueMembership(code) {
    const uid = currentUid();
    if (uid) {
        await remove(ref(db, `users/${uid}/leagues/${code}`));
    }
    const codes = getLocalJoinedCodes().filter((item) => item !== code);
    saveLocalJoinedCodes(codes);
}

async function getCloudJoinedLeagueCodes() {
    const uid = currentUid();
    if (uid) {
        try {
            const snap = await get(ref(db, `users/${uid}/leagues`));
            if (snap.exists()) {
                const codes = Object.keys(snap.val());
                saveLocalJoinedCodes(codes);
                return codes;
            }
        } catch {
            // Fall back to local cache.
        }
    }
    return getLocalJoinedCodes();
}

async function createLeague(leagueName, options = {}) {
    const name = normalizeName(leagueName);
    if (!name) {
        throw new Error('League name is required.');
    }

    const mode = options.mode === 'local' ? 'local' : 'cloud';
    const roster = rosterMapFromNames(options.playerNames || []);
    const players = playersMapFromRoster(roster);

    if (mode === 'local') {
        const map = loadLocalLeaguesMap();
        const localCode = generateLocalLeagueCode(map);
        const now = Date.now();
        map[localCode] = {
            code: localCode,
            name,
            isLocal: true,
            createdAt: now,
            updatedAt: now,
            createdBy: currentUid() || 'local',
            roster,
            players
        };
        saveLocalLeaguesMap(map);
        return localCode;
    }

    const uid = currentUid();
    const code = generateLeagueCode();
    const leagueRef = ref(db, `leagues/${code}`);
    const snap = await get(leagueRef);
    if (snap.exists()) {
        return createLeague(name, options);
    }

    await set(leagueRef, {
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid || 'anonymous',
        admins: uid ? { [uid]: true } : {},
        roster,
        players
    });

    await saveLeagueMembership(code);
    return code;
}

async function joinLeague(leagueCode) {
    const code = (leagueCode || '').toUpperCase().trim();
    if (!code) {
        throw new Error('League code is required.');
    }
    if (isLocalLeagueCode(code)) {
        throw new Error('Local leagues are only available on the device that created them.');
    }

    const leagueRef = ref(db, `leagues/${code}`);
    const snap = await get(leagueRef);
    if (!snap.exists()) {
        throw new Error('League not found. Check the code and try again.');
    }

    await saveLeagueMembership(code);

    const uid = currentUid();
    if (uid) {
        await set(ref(db, `leagues/${code}/admins/${uid}`), true);
    }

    return code;
}

async function leaveLeague(leagueCode) {
    if (isLocalLeagueCode(leagueCode)) {
        return;
    }
    await removeLeagueMembership(leagueCode);
}

async function getJoinedLeagueCodes() {
    const [cloudCodes, localMap] = await Promise.all([
        getCloudJoinedLeagueCodes(),
        Promise.resolve(loadLocalLeaguesMap())
    ]);
    const all = [...Object.keys(localMap), ...cloudCodes];
    return [...new Set(all)];
}

async function getJoinedLeagues() {
    const uid = currentUid();
    const cloudCodes = await getCloudJoinedLeagueCodes();
    const localMap = loadLocalLeaguesMap();
    const leagues = [];

    Object.entries(localMap).forEach(([code, data]) => {
        leagues.push({
            code,
            name: data.name || 'Unnamed Local League',
            isLocal: true,
            isAdmin: true
        });
    });

    for (const code of cloudCodes) {
        try {
            const snap = await get(ref(db, `leagues/${code}`));
            if (!snap.exists()) {
                await leaveLeague(code);
                continue;
            }
            const data = snap.val();
            leagues.push({
                code,
                name: data.name || 'Unnamed League',
                isLocal: false,
                isAdmin: canAdminCloudLeague(data, uid)
            });
        } catch {
            // Ignore broken entry and continue.
        }
    }

    return leagues.sort((a, b) => a.name.localeCompare(b.name));
}

async function getLeagueDetail(leagueCode) {
    if (isLocalLeagueCode(leagueCode)) {
        const local = loadLocalLeaguesMap()[leagueCode];
        if (!local) return null;
        return {
            code: leagueCode,
            name: local.name || 'Unnamed Local League',
            standings: standingsFromPlayers(local.players || {}),
            members: mergeMemberNames(local),
            isLocal: true,
            isAdmin: true
        };
    }

    const snap = await get(ref(db, `leagues/${leagueCode}`));
    if (!snap.exists()) return null;
    const data = snap.val();
    return {
        code: leagueCode,
        name: data.name || 'Unnamed League',
        standings: standingsFromPlayers(data.players || {}),
        members: mergeMemberNames(data),
        isLocal: false,
        isAdmin: canAdminCloudLeague(data, currentUid())
    };
}

async function upsertPlayerScore(leagueCode, playerName, deltaPoints, isWin) {
    const trimmed = normalizeName(playerName);
    if (!trimmed) return;
    const key = playerKey(trimmed);

    if (isLocalLeagueCode(leagueCode)) {
        const map = loadLocalLeaguesMap();
        const local = map[leagueCode];
        if (!local) throw new Error('Local league not found.');

        local.roster = local.roster || {};
        local.players = local.players || {};

        local.roster[key] = {
            displayName: trimmed,
            createdAt: local.roster[key]?.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        const existing = local.players[key] || {
            displayName: trimmed,
            points: 0,
            gamesPlayed: 0,
            wins: 0
        };

        existing.displayName = trimmed;
        existing.points = (existing.points || 0) + deltaPoints;
        existing.gamesPlayed = (existing.gamesPlayed || 0) + 1;
        if (isWin) existing.wins = (existing.wins || 0) + 1;
        local.players[key] = existing;
        local.updatedAt = Date.now();

        map[leagueCode] = local;
        saveLocalLeaguesMap(map);
        return;
    }

    const playerRef = ref(db, `leagues/${leagueCode}/players/${key}`);
    const snap = await get(playerRef);
    const current = snap.exists() ? snap.val() : {
        displayName: trimmed,
        points: 0,
        gamesPlayed: 0,
        wins: 0
    };

    current.displayName = trimmed;
    current.points = (current.points || 0) + deltaPoints;
    current.gamesPlayed = (current.gamesPlayed || 0) + 1;
    if (isWin) current.wins = (current.wins || 0) + 1;
    await set(playerRef, current);

    await update(ref(db, `leagues/${leagueCode}`), {
        [`roster/${key}/displayName`]: trimmed,
        [`roster/${key}/updatedAt`]: Date.now(),
        updatedAt: serverTimestamp()
    });
}

async function addPoints(leagueCode, playerName, points, isWin = false) {
    await upsertPlayerScore(leagueCode, playerName, points, isWin);
}

async function recordGame(leagueCode, playerName) {
    await upsertPlayerScore(leagueCode, playerName, 0, false);
}

async function deleteLeague(leagueCode) {
    if (isLocalLeagueCode(leagueCode)) {
        const map = loadLocalLeaguesMap();
        delete map[leagueCode];
        saveLocalLeaguesMap(map);
        return;
    }

    await assertCloudAdmin(leagueCode);
    await remove(ref(db, `leagues/${leagueCode}`));
    await leaveLeague(leagueCode);
}

async function getLeagueMembers(leagueCode) {
    if (isLocalLeagueCode(leagueCode)) {
        const local = loadLocalLeaguesMap()[leagueCode];
        if (!local) return [];
        return mergeMemberNames(local);
    }

    const snap = await get(ref(db, `leagues/${leagueCode}`));
    if (!snap.exists()) return [];
    return mergeMemberNames(snap.val());
}

async function addLeagueMember(leagueCode, playerName) {
    const trimmed = normalizeName(playerName);
    if (!trimmed) return;
    const key = playerKey(trimmed);

    if (isLocalLeagueCode(leagueCode)) {
        const map = loadLocalLeaguesMap();
        const local = map[leagueCode];
        if (!local) throw new Error('Local league not found.');
        local.roster = local.roster || {};
        local.players = local.players || {};
        local.roster[key] = {
            displayName: trimmed,
            createdAt: local.roster[key]?.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        if (!local.players[key]) {
            local.players[key] = {
                displayName: trimmed,
                points: 0,
                gamesPlayed: 0,
                wins: 0
            };
        } else {
            local.players[key].displayName = trimmed;
        }
        local.updatedAt = Date.now();
        map[leagueCode] = local;
        saveLocalLeaguesMap(map);
        return;
    }

    await assertCloudAdmin(leagueCode);
    await update(ref(db, `leagues/${leagueCode}`), {
        [`roster/${key}/displayName`]: trimmed,
        [`roster/${key}/updatedAt`]: Date.now(),
        updatedAt: serverTimestamp()
    });

    const playerRef = ref(db, `leagues/${leagueCode}/players/${key}`);
    const snap = await get(playerRef);
    if (!snap.exists()) {
        await set(playerRef, {
            displayName: trimmed,
            points: 0,
            gamesPlayed: 0,
            wins: 0
        });
    } else if ((snap.val().displayName || '') !== trimmed) {
        await update(playerRef, { displayName: trimmed });
    }
}

async function removeLeagueMember(leagueCode, playerName) {
    const key = playerKey(playerName);
    if (!key) return;

    if (isLocalLeagueCode(leagueCode)) {
        const map = loadLocalLeaguesMap();
        const local = map[leagueCode];
        if (!local) throw new Error('Local league not found.');
        delete (local.roster || {})[key];
        delete (local.players || {})[key];
        local.updatedAt = Date.now();
        map[leagueCode] = local;
        saveLocalLeaguesMap(map);
        return;
    }

    await assertCloudAdmin(leagueCode);
    await Promise.all([
        remove(ref(db, `leagues/${leagueCode}/roster/${key}`)),
        remove(ref(db, `leagues/${leagueCode}/players/${key}`)),
        update(ref(db, `leagues/${leagueCode}`), { updatedAt: serverTimestamp() })
    ]);
}

async function renameLeagueMember(leagueCode, oldName, newName) {
    const oldKey = playerKey(oldName);
    const trimmedNew = normalizeName(newName);
    const newKey = playerKey(trimmedNew);
    if (!oldKey || !newKey) {
        throw new Error('Both old and new player names are required.');
    }

    if (isLocalLeagueCode(leagueCode)) {
        const map = loadLocalLeaguesMap();
        const local = map[leagueCode];
        if (!local) throw new Error('Local league not found.');

        local.roster = local.roster || {};
        local.players = local.players || {};

        if (oldKey !== newKey) {
            const oldStats = local.players[oldKey];
            const newStats = local.players[newKey];
            if (oldStats && newStats) {
                local.players[newKey] = {
                    displayName: trimmedNew,
                    points: (newStats.points || 0) + (oldStats.points || 0),
                    gamesPlayed: (newStats.gamesPlayed || 0) + (oldStats.gamesPlayed || 0),
                    wins: (newStats.wins || 0) + (oldStats.wins || 0)
                };
            } else if (oldStats) {
                local.players[newKey] = {
                    ...oldStats,
                    displayName: trimmedNew
                };
            } else if (newStats) {
                local.players[newKey] = {
                    ...newStats,
                    displayName: trimmedNew
                };
            } else {
                local.players[newKey] = {
                    displayName: trimmedNew,
                    points: 0,
                    gamesPlayed: 0,
                    wins: 0
                };
            }
            delete local.players[oldKey];
            delete local.roster[oldKey];
        } else {
            if (local.players[newKey]) {
                local.players[newKey].displayName = trimmedNew;
            }
        }

        local.roster[newKey] = {
            displayName: trimmedNew,
            createdAt: local.roster[newKey]?.createdAt || local.roster[oldKey]?.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        local.updatedAt = Date.now();
        map[leagueCode] = local;
        saveLocalLeaguesMap(map);
        return;
    }

    await assertCloudAdmin(leagueCode);

    const oldPlayerRef = ref(db, `leagues/${leagueCode}/players/${oldKey}`);
    const newPlayerRef = ref(db, `leagues/${leagueCode}/players/${newKey}`);
    const [oldSnap, newSnap] = await Promise.all([get(oldPlayerRef), get(newPlayerRef)]);

    if (oldKey === newKey) {
        await Promise.all([
            update(ref(db, `leagues/${leagueCode}`), {
                [`roster/${newKey}/displayName`]: trimmedNew,
                [`roster/${newKey}/updatedAt`]: Date.now(),
                updatedAt: serverTimestamp()
            }),
            oldSnap.exists() ? update(oldPlayerRef, { displayName: trimmedNew }) : Promise.resolve()
        ]);
        return;
    }

    const oldStats = oldSnap.exists() ? oldSnap.val() : null;
    const newStats = newSnap.exists() ? newSnap.val() : null;

    const merged = {
        displayName: trimmedNew,
        points: (newStats?.points || 0) + (oldStats?.points || 0),
        gamesPlayed: (newStats?.gamesPlayed || 0) + (oldStats?.gamesPlayed || 0),
        wins: (newStats?.wins || 0) + (oldStats?.wins || 0)
    };

    await Promise.all([
        set(newPlayerRef, merged),
        remove(oldPlayerRef),
        update(ref(db, `leagues/${leagueCode}`), {
            [`roster/${newKey}/displayName`]: trimmedNew,
            [`roster/${newKey}/updatedAt`]: Date.now(),
            updatedAt: serverTimestamp()
        }),
        remove(ref(db, `leagues/${leagueCode}/roster/${oldKey}`))
    ]);
}

export {
    createLeague,
    joinLeague,
    leaveLeague,
    getJoinedLeagues,
    getJoinedLeagueCodes,
    getLeagueDetail,
    getLeagueMembers,
    addLeagueMember,
    removeLeagueMember,
    renameLeagueMember,
    addPoints,
    recordGame,
    deleteLeague
};
