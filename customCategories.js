import { httpsCallable } from 'firebase/functions';
// ===============================================
// Custom Categories Module
// Personal: Firebase RTDB users/{uid}/customCategories/
// Community: Firebase RTDB /communityCategories/
// localStorage used as cache/fallback only
// ===============================================

import {
    ref,
    set,
    get,
    update,
    remove,
    push
} from "firebase/database";

import { functions, database as db, auth } from './firebase-client.js';

// ---- Keys ----
const LOCAL_KEY = 'imposter-custom-categories'; // localStorage cache/fallback
const UPVOTED_KEY = 'imposter-upvoted-categories'; // localStorage upvote cache

// ===============================================
// ID & Identity Helpers
// ===============================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function currentUid() {
    return auth.currentUser?.uid ?? null;
}

// ===============================================
// PERSONAL CATEGORIES — Firebase primary, localStorage cache
// ===============================================

/**
 * SYNC version — reads from localStorage cache only. Used for immediate rendering.
 * Fast but may be slightly stale vs Firebase.
 */
function getLocalCategoriesSync() {
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

/**
 * ASYNC version — fetches from Firebase if authenticated, falls back to localStorage.
 * Updates localStorage cache as a side effect.
 */
async function getLocalCategories() {
    const uid = currentUid();
    if (uid) {
        try {
            const snap = await get(ref(db, `users/${uid}/customCategories`));
            if (snap.exists()) {
                const cats = Object.values(snap.val());
                // Sync cache
                try { localStorage.setItem(LOCAL_KEY, JSON.stringify(cats)); } catch { }
                return cats;
            }
        } catch (e) {
            console.warn('Firebase read failed, using localStorage cache:', e);
        }
    }
    // localStorage fallback
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

/**
 * Save a new or updated custom category.
 * Writes to Firebase (primary) and localStorage (cache).
 */
async function saveLocalCategory(category) {
    const now = Date.now();
    if (!category.id) {
        category.id = generateId();
        category.createdAt = now;
    }
    category.updatedAt = now;

    const uid = currentUid();
    if (uid) {
        await set(ref(db, `users/${uid}/customCategories/${category.id}`), category);
    }

    // Update local cache
    try {
        const cats = _getCachedCategories();
        const idx = cats.findIndex(c => c.id === category.id);
        if (idx >= 0) cats[idx] = category; else cats.push(category);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(cats));
    } catch { }

    return category;
}

/**
 * Delete a custom category by id.
 * Removes from Firebase and localStorage cache.
 */
async function deleteLocalCategory(id) {
    const uid = currentUid();
    if (uid) {
        await remove(ref(db, `users/${uid}/customCategories/${id}`));
    }
    try {
        const cats = _getCachedCategories().filter(c => c.id !== id);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(cats));
    } catch { }
}

/** Synchronous read from localStorage cache (internal use) */
function _getCachedCategories() {
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// ===============================================
// COMMUNITY (Firebase) Operations
// ===============================================

/**
 * Publish a personal category to the community hub.
 * Returns the new Firebase key.
 */
async function publishCategory(category, authorName = 'Anonymous') {
    const result = await httpsCallable(functions,'categoryCommand')({action:'publish',commandId:crypto.randomUUID(),payload:{name:category.name,icon:category.icon||'📝',words:category.words,authorName}});
    category.communityId=result.data.id;
    category.publishedAt=Date.now();
    await saveLocalCategory(category);
    return result.data.id;
}

/**
 * Fetch all community categories via REST API to bypass SDK auth issues.
 * Sorts by newest first.
 */
async function fetchCommunityCategories() {
    const snap=await get(ref(db,'communityCategories'));
    return Object.entries(snap.val()||{}).map(([id,value])=>({id,...value})).sort((a,b)=>(b.publishedAt||0)-(a.publishedAt||0)).slice(0,100);
}

/**
 * Upvote a community category.
 * Uses Firebase upvotedBy/{uid} for deduplication (+ localStorage fallback for guests).
 * Returns { newCount, alreadyVoted }.
 */
async function upvoteCategory(communityId) {
    const result=await httpsCallable(functions,'categoryCommand')({action:'upvote',categoryId:communityId,commandId:crypto.randomUUID(),payload:{}});
    const cached=_getLocalUpvotedIds();cached.add(communityId);_saveLocalUpvotedIds(cached);
    return result.data;
}

/**
 * Import a community category into the user's personal collection.
 * Increments the importCount on Firebase.
 */
async function importCategory(communityId) {
    const catRef = ref(db, `communityCategories/${communityId}`);
    const snap = await get(catRef);
    if (!snap.exists()) throw new Error('Category not found.');

    const data = snap.val();
    await httpsCallable(functions,'categoryCommand')({action:'import',categoryId:communityId,commandId:crypto.randomUUID(),payload:{}});

    const local = {
        name: data.name,
        icon: data.icon || '📝',
        words: data.words || [],
        importedFrom: communityId,
        importedAuthor: data.authorName || 'Anonymous'
    };

    return saveLocalCategory(local);
}

/**
 * Check whether the current user has already upvoted a community category.
 */
function hasUpvoted(communityId) {
    // Immediate UI hint only; the service is authoritative across devices.
    return _getLocalUpvotedIds().has(communityId);
}

// ---- Upvote local cache helpers ----
function _getLocalUpvotedIds() {
    try {
        const raw = localStorage.getItem(UPVOTED_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
}

function _saveLocalUpvotedIds(set) {
    try {
        localStorage.setItem(UPVOTED_KEY, JSON.stringify([...set]));
    } catch { }
}

export {
    getLocalCategoriesSync,
    getLocalCategories,
    saveLocalCategory,
    deleteLocalCategory,
    publishCategory,
    fetchCommunityCategories,
    upvoteCategory,
    importCategory,
    hasUpvoted
};
