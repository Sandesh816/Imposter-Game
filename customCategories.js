// ===============================================
// Custom Categories Module
// Personal: Firebase RTDB users/{uid}/customCategories/
// Community: Firebase RTDB /communityCategories/
// localStorage used as cache/fallback only
// ===============================================

import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    update,
    remove,
    push
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

// Re-use auth-app (shared Firebase app instance)
let catApp;
try {
    catApp = getApp();
} catch {
    catApp = initializeApp(firebaseConfig);
}

const db = getDatabase(catApp);
const auth = getAuth(catApp);

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
    const uid = currentUid();
    const communityRef = ref(db, 'communityCategories');
    const newRef = push(communityRef);

    const payload = {
        name: category.name.trim(),
        icon: category.icon || '📝',
        words: category.words.filter(w => w.trim().length > 0),
        authorName: (authorName || 'Anonymous').trim(),
        authorUid: uid || null,
        upvotes: 0,
        importCount: 0,
        publishedAt: Date.now()
    };

    await set(newRef, payload);

    // Mark locally as published
    category.communityId = newRef.key;
    category.publishedAt = payload.publishedAt;
    await saveLocalCategory(category);

    return newRef.key;
}

/**
 * Fetch all community categories. Uses simple get() to avoid query/index issues
 * that can cause empty results. Sorts client-side by upvotes, then publishedAt.
 */
async function fetchCommunityCategories() {
    const snap = await get(ref(db, 'communityCategories'));
    if (!snap.exists()) return [];

    const results = [];
    snap.forEach(child => results.push({ id: child.key, ...child.val() }));
    results.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || (b.publishedAt || 0) - (a.publishedAt || 0));
    return results.slice(0, 100);
}

/**
 * Upvote a community category.
 * Uses Firebase upvotedBy/{uid} for deduplication (+ localStorage fallback for guests).
 * Returns { newCount, alreadyVoted }.
 */
async function upvoteCategory(communityId) {
    const uid = currentUid();
    const catRef = ref(db, `communityCategories/${communityId}`);

    // Check Firebase-based deduplication first (for authenticated users)
    if (uid) {
        const upvoteRef = ref(db, `communityCategories/${communityId}/upvotedBy/${uid}`);
        const upvoteSnap = await get(upvoteRef);
        if (upvoteSnap.exists()) {
            return { alreadyVoted: true };
        }
    } else {
        // Guest: localStorage fallback
        const upvoted = _getLocalUpvotedIds();
        if (upvoted.has(communityId)) return { alreadyVoted: true };
    }

    const snap = await get(catRef);
    if (!snap.exists()) throw new Error('Category not found.');

    const current = snap.val().upvotes || 0;
    const newCount = current + 1;

    const updates = { upvotes: newCount };
    if (uid) updates[`upvotedBy/${uid}`] = true;
    await update(catRef, updates);

    // Also track in localStorage for guests / fallback
    const localUpvoted = _getLocalUpvotedIds();
    localUpvoted.add(communityId);
    _saveLocalUpvotedIds(localUpvoted);

    return { newCount, alreadyVoted: false };
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
    await update(catRef, { importCount: (data.importCount || 0) + 1 });

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
async function hasUpvoted(communityId) {
    const uid = currentUid();
    if (uid) {
        const snap = await get(ref(db, `communityCategories/${communityId}/upvotedBy/${uid}`));
        return snap.exists();
    }
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
