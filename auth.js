// ===============================================
// Auth Module — Firebase Authentication
// Supports: Google Sign-In (redirect) + Anonymous Guest
// No account linking — each Google account is independent
// ===============================================

import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult,
    signInAnonymously,
    onAuthStateChanged,
    signOut as firebaseSignOut,
    updateProfile,
    getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    set,
    get,
    update
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

// Re-use existing Firebase app instance if available
let authApp;
try {
    authApp = getApp('auth-app');
} catch {
    authApp = initializeApp(firebaseConfig, 'auth-app');
}

const auth = getAuth(authApp);
const db = getDatabase(authApp);
const googleProvider = new GoogleAuthProvider();

// ===============================================
// Auth State
// ===============================================

function onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
}

function getCurrentUser() {
    return auth.currentUser;
}

function getCurrentUid() {
    return auth.currentUser?.uid ?? null;
}

// ===============================================
// Sign In Methods
// ===============================================

/**
 * Start Google sign-in via redirect.
 * Works for both new users (sign up) and existing users (log in).
 * Firebase/Google determines whether to create a new account or sign into existing.
 */
async function signInWithGoogle() {
    await signInWithRedirect(auth, googleProvider);
    // Page redirects — result is handled by handleRedirectResult() on return
}

/**
 * Sign in as an anonymous guest.
 */
async function signInAsGuest() {
    const result = await signInAnonymously(auth);
    await migrateLocalStorage(result.user.uid);
    return result.user;
}

/**
 * Sign out the current user.
 */
async function signOut() {
    await firebaseSignOut(auth);
}

// ===============================================
// Redirect Result Handler
// Called from index.js AFTER UI listeners are set up
// ===============================================

/**
 * Check if returning from a Google sign-in redirect and process the result.
 * Returns the signed-in user, or null if no redirect pending.
 */
async function handleRedirectResult() {
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            const isNewUser = getAdditionalUserInfo(result)?.isNewUser || false;
            await ensureProfile(result.user);
            await migrateLocalStorage(result.user.uid);
            return { user: result.user, isNewUser };
        }
    } catch (e) {
        console.error('Redirect sign-in result error:', e);
    }
    return null;
}

// ===============================================
// Profile Management
// ===============================================

/**
 * Ensure a user document exists in /users/{uid}.
 * Creates on first sign-in; updates name/photo if changed.
 */
async function ensureProfile(user) {
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);

    if (!snap.exists()) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
        await set(userRef, {
            displayName,
            photoURL: user.photoURL || null,
            isAnonymous: user.isAnonymous,
            createdAt: Date.now()
        });
    } else {
        const updates = {};
        if (user.displayName && user.displayName !== snap.val().displayName) {
            updates.displayName = user.displayName;
        }
        if (user.photoURL && user.photoURL !== snap.val().photoURL) {
            updates.photoURL = user.photoURL;
        }
        if (!user.isAnonymous && snap.val().isAnonymous) {
            updates.isAnonymous = false;
        }
        if (Object.keys(updates).length > 0) {
            await update(userRef, updates);
        }
    }
}

/**
 * Update the display name for the current user.
 */
async function updateDisplayName(name) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const trimmed = name.trim();
    await updateProfile(user, { displayName: trimmed });
    await update(ref(db, `users/${user.uid}`), { displayName: trimmed });
}

/**
 * Get the full profile object from RTDB for the current user.
 */
async function getProfile() {
    const user = auth.currentUser;
    if (!user) return null;
    const snap = await get(ref(db, `users/${user.uid}`));
    return snap.exists() ? { uid: user.uid, ...snap.val() } : null;
}

// ===============================================
// Data Migration — localStorage → Firebase
// ===============================================

async function migrateLocalStorage(uid) {
    const migrationKey = `imposter-migrated-${uid}`;
    if (localStorage.getItem(migrationKey)) return;

    const tasks = [];

    // Migrate custom categories
    try {
        const rawCats = localStorage.getItem('imposter-custom-categories');
        if (rawCats) {
            const cats = JSON.parse(rawCats);
            for (const cat of cats) {
                const catRef = ref(db, `users/${uid}/customCategories/${cat.id}`);
                const snap = await get(catRef);
                if (!snap.exists()) tasks.push(set(catRef, cat));
            }
        }
    } catch (e) {
        console.warn('Category migration failed:', e);
    }

    // Migrate league memberships
    try {
        const rawLeagues = localStorage.getItem('imposter-joined-leagues');
        if (rawLeagues) {
            const codes = JSON.parse(rawLeagues);
            for (const code of codes) {
                tasks.push(set(ref(db, `users/${uid}/leagues/${code}`), true));
            }
        }
    } catch (e) {
        console.warn('League migration failed:', e);
    }

    await Promise.allSettled(tasks);
    localStorage.setItem(migrationKey, '1');
}

export {
    onAuthChange,
    getCurrentUser,
    getCurrentUid,
    signInWithGoogle,
    signInAsGuest,
    signOut,
    ensureProfile,
    updateDisplayName,
    getProfile,
    migrateLocalStorage,
    handleRedirectResult
};
