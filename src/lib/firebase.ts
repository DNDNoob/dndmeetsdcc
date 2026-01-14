import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration - get these from Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if Firebase is configured
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;

if (!isFirebaseConfigured) {
  console.warn('[Firebase] ⚠️ Firebase not configured - running in offline mode. Create a .env file with Firebase credentials to enable real-time sync.');
}

// Initialize Firebase only if configured
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Initialize Firestore
export const db = app ? getFirestore(app) : null as any;

// Initialize Storage
export const storage = app ? getStorage(app) : null as any;

// Initialize Auth
export const auth = app ? getAuth(app) : null as any;

// Sign in anonymously when the app loads
let authInitialized = false;
let authPromise: Promise<void> | null = null;

export const initAuth = () => {
  // If Firebase not configured, skip auth
  if (!isFirebaseConfigured || !auth) {
    return Promise.resolve();
  }

  if (authPromise) return authPromise;
  
  authPromise = new Promise((resolve, reject) => {
    if (authInitialized) {
      resolve();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is already signed in
        authInitialized = true;
        unsubscribe();
        resolve();
      } else {
        // Sign in anonymously
        try {
          await signInAnonymously(auth);
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
    throw new Error('Firebase not configured - cannot get collection reference');
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
  where
};
