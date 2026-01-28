import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
