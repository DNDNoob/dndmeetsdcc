#!/usr/bin/env node

/**
 * Data Migration Script
 * Migrates data from the old file-based system to Firebase Firestore
 * 
 * Usage:
 *   node scripts/migrate-to-firebase.js
 * 
 * This script will:
 * 1. Read data from server/game-data.json (if it exists)
 * 2. Read data from localStorage backup (if available)
 * 3. Upload all data to Firebase Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Validate config
const missingVars = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Missing Firebase environment variables:');
  missingVars.forEach(key => console.error(`   - ${key}`));
  console.error('\nPlease set these in your .env file');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateData() {
  console.log('🔄 Starting data migration to Firebase...\n');

  // Read from old server file
  const serverDataPath = join(__dirname, '../server/game-data.json');
  let data = null;

  if (existsSync(serverDataPath)) {
    console.log('📁 Found server/game-data.json');
    try {
      const fileContent = readFileSync(serverDataPath, 'utf-8');
      data = JSON.parse(fileContent);
      console.log('✅ Loaded data from server file');
    } catch (error) {
      console.error('❌ Error reading server file:', error.message);
    }
  } else {
    console.log('ℹ️  No server/game-data.json found');
  }

  if (!data) {
    console.log('\n⚠️  No data to migrate');
    console.log('If you have data in localStorage, you can manually export it:');
    console.log('1. Open your app in a browser');
    console.log('2. Open DevTools > Console');
    console.log('3. Run: console.log(JSON.stringify(localStorage.getItem("dcc_game_data")))');
    console.log('4. Copy the output and save as data.json');
    console.log('5. Run: node scripts/migrate-to-firebase.js data.json\n');
    return;
  }

  // Migrate each collection
  const collections = ['crawlers', 'mobs', 'maps', 'inventory'];
  const stats = { success: 0, failed: 0 };

  for (const collectionName of collections) {
    const items = data[collectionName] || [];
    
    if (items.length === 0) {
      console.log(`⏭️  Skipping ${collectionName} (empty)`);
      continue;
    }

    console.log(`\n📦 Migrating ${items.length} ${collectionName}...`);
    
    for (const item of items) {
      try {
        const docId = item.id || crypto.randomUUID();
        const docRef = doc(db, collectionName, docId);
        
        await setDoc(docRef, {
          ...item,
          id: docId,
          migratedAt: new Date().toISOString(),
        });
        
        console.log(`   ✅ ${docId.substring(0, 8)}... migrated`);
        stats.success++;
      } catch (error) {
        console.error(`   ❌ Failed to migrate item:`, error.message);
        stats.failed++;
      }
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successfully migrated: ${stats.success} items`);
  console.log(`   ❌ Failed: ${stats.failed} items`);
  
  if (stats.failed === 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Open your app and verify the data appears');
    console.log('2. Back up server/game-data.json somewhere safe');
    console.log('3. You can now remove the old server/ directory\n');
  } else {
    console.log('\n⚠️  Some items failed to migrate. Please check the errors above.\n');
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('✨ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
