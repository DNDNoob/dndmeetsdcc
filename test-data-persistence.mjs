#!/usr/bin/env node

/**
 * Comprehensive Data Persistence Test
 * 
 * Tests that all user-created data types are being saved to Firebase:
 * - Crawlers (character profiles)
 * - Inventory items
 * - Mobs (enemies/NPCs)
 * - Maps (images)
 */

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Test data
const TEST_PREFIX = 'TEST_PERSIST_';
const testCrawler = {
  id: `${TEST_PREFIX}crawler_${Date.now()}`,
  name: 'Test Crawler',
  class: 'Warrior',
  level: 5,
  hitPoints: 50,
  maxHitPoints: 50,
  strength: 15,
  agility: 12,
  stamina: 14,
  luck: 10,
  gold: 100,
  avatar: 'data:image/png;base64,test'
};

const testInventoryItem = {
  id: testCrawler.id, // inventory document ID matches crawlerId
  crawlerId: testCrawler.id,
  items: [
    {
      id: `${TEST_PREFIX}item_${Date.now()}`,
      name: 'Test Sword',
      description: 'A mighty test sword',
      equipped: true
    }
  ]
};

const testMob = {
  id: `${TEST_PREFIX}mob_${Date.now()}`,
  name: 'Test Dragon',
  type: 'boss',
  level: 10,
  hitPoints: 200,
  maxHitPoints: 200,
  description: 'A fearsome test dragon',
  encountered: true,
  hidden: false
};

const testMap = {
  id: `${TEST_PREFIX}map_${Date.now()}`,
  url: 'data:image/png;base64,testmap',
  name: 'Test Dungeon Map'
};

// Helper functions
async function testCollection(collectionName, testData, itemName) {
  console.log(`\n📦 Testing ${collectionName}...`);
  
  try {
    // 1. CREATE - Add item
    console.log(`  ➕ Adding ${itemName}...`);
    const docRef = doc(db, collectionName, testData.id);
    await updateDoc(docRef, testData).catch(async () => {
      // If update fails (doc doesn't exist), use setDoc
      const { setDoc } = await import('firebase/firestore');
      await setDoc(docRef, testData);
    });
    console.log(`  ✅ Added ${itemName} with ID: ${testData.id}`);
    
    // 2. READ - Verify it was saved
    console.log(`  📖 Reading ${itemName}...`);
    const snapshot = await getDocs(collection(db, collectionName));
    const found = snapshot.docs.find(doc => doc.id === testData.id);
    
    if (!found) {
      throw new Error(`${itemName} was not found after creation!`);
    }
    console.log(`  ✅ ${itemName} successfully retrieved`);
    
    // 3. UPDATE - Modify the item
    console.log(`  ✏️  Updating ${itemName}...`);
    const updateData = collectionName === 'crawlers' 
      ? { level: testData.level + 1 }
      : collectionName === 'mobs'
      ? { hitPoints: testData.hitPoints - 10 }
      : collectionName === 'inventory'
      ? { items: [...testData.items, { id: 'new_item', name: 'New Item' }] }
      : { name: 'Updated Map' };
    
    await updateDoc(docRef, updateData);
    
    const updatedSnapshot = await getDocs(collection(db, collectionName));
    const updated = updatedSnapshot.docs.find(doc => doc.id === testData.id);
    
    if (!updated) {
      throw new Error(`${itemName} not found after update!`);
    }
    
    const updatedData = updated.data();
    const updateKey = Object.keys(updateData)[0];
    if (JSON.stringify(updatedData[updateKey]) !== JSON.stringify(updateData[updateKey])) {
      throw new Error(`${itemName} update did not persist correctly!`);
    }
    console.log(`  ✅ ${itemName} successfully updated`);
    
    // 4. DELETE - Clean up
    console.log(`  🗑️  Deleting ${itemName}...`);
    await deleteDoc(docRef);
    
    const finalSnapshot = await getDocs(collection(db, collectionName));
    const stillExists = finalSnapshot.docs.find(doc => doc.id === testData.id);
    
    if (stillExists) {
      throw new Error(`${itemName} still exists after deletion!`);
    }
    console.log(`  ✅ ${itemName} successfully deleted`);
    
    console.log(`\n✅ ${collectionName} - ALL TESTS PASSED\n`);
    return true;
    
  } catch (error) {
    console.error(`\n❌ ${collectionName} - TEST FAILED:`, error.message);
    
    // Cleanup on failure
    try {
      await deleteDoc(doc(db, collectionName, testData.id));
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🔥 Firebase Data Persistence Test Suite\n');
  console.log('Testing all user-created data types...\n');
  
  try {
    // Authenticate
    console.log('🔐 Authenticating...');
    await signInAnonymously(auth);
    console.log('✅ Authenticated\n');
    
    const results = {
      crawlers: false,
      inventory: false,
      mobs: false,
      maps: false
    };
    
    // Test each collection
    results.crawlers = await testCollection('crawlers', testCrawler, 'Crawler');
    results.inventory = await testCollection('inventory', testInventoryItem, 'Inventory');
    results.mobs = await testCollection('mobs', testMob, 'Mob');
    results.maps = await testCollection('maps', testMap, 'Map');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60) + '\n');
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    
    for (const [collection, passed] of Object.entries(results)) {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${collection}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${passed}/${total} tests passed\n`);
    
    if (passed === total) {
      console.log('🎉 ALL DATA TYPES ARE BEING SAVED CORRECTLY!\n');
      process.exit(0);
    } else {
      console.log('⚠️  SOME DATA TYPES ARE NOT BEING SAVED PROPERLY!\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();
