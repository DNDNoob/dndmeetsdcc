// Firebase CRUD Test Script (Node)
// Uses Firebase client SDK to sign in anonymously and perform CRUD in Firestore

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    env[key] = value;
  }
  return env;
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const exists = fs.existsSync(envPath);
  if (!exists) {
    console.error('❌ .env file not found at', envPath);
    process.exit(1);
  }

  const env = loadEnv(envPath);
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ Missing Firebase config in .env');
    process.exit(1);
  }

  console.log('🔧 Using Firebase project:', firebaseConfig.projectId);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('🔐 Signing in anonymously...');
  await signInAnonymously(auth);
  console.log('✅ Signed in as anonymous user:', auth.currentUser?.uid);

  const testId = `crud-test-${Date.now()}`;
  const docRef = doc(db, 'mobs', testId);

  // Create
  const mob = { id: testId, name: 'Test Dragon', hp: 50, ac: 14, createdAt: new Date().toISOString() };
  console.log('➕ Creating mob:', mob);
  await setDoc(docRef, mob);
  console.log('✅ Created mob with id:', testId);

  // Read
  const snap1 = await getDoc(docRef);
  if (!snap1.exists()) {
    throw new Error('Created document not found');
  }
  console.log('📖 Read mob:', snap1.data());

  // Update
  console.log('📝 Updating mob hp to 75...');
  await updateDoc(docRef, { hp: 75 });
  const snap2 = await getDoc(docRef);
  console.log('📖 Read updated mob:', snap2.data());
  if (snap2.data().hp !== 75) {
    throw new Error('Update did not persist');
  }

  // Delete
  console.log('🗑️ Deleting mob...');
  await deleteDoc(docRef);
  const snap3 = await getDoc(docRef);
  console.log('📖 Exists after delete:', snap3.exists());
  if (snap3.exists()) {
    throw new Error('Delete did not persist');
  }

  console.log('🎉 CRUD test completed successfully');
}

main().catch((err) => {
  console.error('❌ CRUD test failed:', err);
  process.exit(1);
});
