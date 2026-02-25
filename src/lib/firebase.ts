import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';

// Firebase configuration - get these from Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const configPresent = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

try {
  if (configPresent) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
  } else {
    console.warn('[Firebase] Config missing. Running in offline mode.');
  }
} catch (err) {
  console.error('[Firebase] Initialization error. Falling back to offline mode:', err);
}

// Export instances (may be null in offline mode)
export { db, storage, auth };

// Google Auth provider
const googleProvider = auth ? new GoogleAuthProvider() : null;

/**
 * Sign in with Google. Returns the signed-in user.
 * If a user is currently signed in anonymously, the Google sign-in replaces the anonymous session.
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  if (!auth || !googleProvider) {
    console.warn('[Firebase] Cannot sign in with Google — offline mode');
    return null;
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[Firebase] ✅ Google sign-in successful:', result.user.displayName);
    return result.user;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    const code = firebaseError.code ?? '';
    // Don't rethrow for user-initiated cancellations
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      console.log('[Firebase] Google sign-in popup closed by user');
      return null;
    }
    // Unauthorized domain — the current hostname isn't listed in Firebase Console
    if (code === 'auth/unauthorized-domain') {
      console.error('[Firebase] ❌ Domain not authorized for Google sign-in. Add this domain to Firebase Console → Authentication → Settings → Authorized domains.');
    }
    console.error('[Firebase] ❌ Google sign-in error:', code, firebaseError.message);
    throw error;
  }
};

/**
 * Sign out from Google and fall back to anonymous auth.
 */
export const signOutGoogle = async (): Promise<void> => {
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
    // Fall back to anonymous auth so reads still work
    await signInAnonymously(auth);
    console.log('[Firebase] ✅ Signed out from Google, now anonymous');
  } catch (error) {
    console.error('[Firebase] ❌ Sign-out error:', error);
    throw error;
  }
};

/**
 * Subscribe to auth state changes. Callback receives the current user (or null).
 * Returns an unsubscribe function.
 */
export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

/**
 * Check if the current user is signed in with Google (not anonymous).
 */
export const isGoogleUser = (user: User | null): boolean => {
  if (!user) return false;
  return user.providerData.some(p => p.providerId === 'google.com');
};

// Sign in anonymously when the app loads
let authInitialized = false;
let authPromise: Promise<void> | null = null;

export const initAuth = () => {
  if (authPromise) return authPromise;

  // In offline mode, resolve immediately
  if (!auth) {
    authInitialized = true;
    authPromise = Promise.resolve();
    return authPromise;
  }

  authPromise = new Promise((resolve, reject) => {
    if (authInitialized) {
      resolve();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth!, async (user) => {
      if (user) {
        authInitialized = true;
        unsubscribe();
        resolve();
      } else {
        try {
          await signInAnonymously(auth!);
          authInitialized = true;
          unsubscribe();
          resolve();
        } catch (error) {
          console.error('Error signing in anonymously:', error);
          unsubscribe();
          reject(error);
        }
      }
    });
  });

  return authPromise;
};

// Collection references
export const getCollectionRef = (collectionName: string, roomId?: string) => {
  if (!db) {
    throw new Error('[Firebase] Offline mode: no Firestore available');
  }
  if (roomId) {
    return collection(db, `rooms/${roomId}/${collectionName}`);
  }
  return collection(db, collectionName);
};

// Firestore helpers
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  writeBatch
};
