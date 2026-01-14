#!/usr/bin/env node
/**
 * Comprehensive Firebase Connection and Data Persistence Test
 * Tests all data types: crawlers, mobs, maps, episodes, inventory
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase config from .env
const firebaseConfig = {
  apiKey: "AIzaSyDi9DX1nEPBXTHuQEuzcpc-BSYVj7DxgPA",
  authDomain: "dndmeetsdcc.firebaseapp.com",
  projectId: "dndmeetsdcc",
  storageBucket: "dndmeetsdcc.firebasestorage.app",
  messagingSenderId: "425884882250",
  appId: "1:425884882250:web:bc666f87585802ef7b5db3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let testsPassed = 0;
let testsFailed = 0;

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function pass(message) {
  testsPassed++;
  log('✅', message);
}

function fail(message, error) {
  testsFailed++;
  log('❌', message);
  if (error) console.error('   Error:', error.message);
}

async function testAuth() {
  log('🔐', 'Testing Firebase Authentication...');
  try {
    const userCredential = await signInAnonymously(auth);
    pass(`Authentication successful (UID: ${userCredential.user.uid})`);
    return true;
  } catch (error) {
    fail('Authentication failed', error);
    return false;
  }
}

async function testCrawlers() {
  log('🧙', 'Testing Crawlers Collection...');
  
  const testCrawler = {
    id: `test-crawler-${Date.now()}`,
    name: 'Test Crawler',
    level: 1,
    class: 'Warrior',
    hp: 10,
    maxHp: 10,
    ac: 12,
    gold: 100,
    luck: 10
  };

  try {
    // CREATE
    const docRef = doc(db, 'crawlers', testCrawler.id);
    await setDoc(docRef, testCrawler);
    pass('Created crawler');

    // READ
    const snapshot = await getDocs(collection(db, 'crawlers'));
    const found = snapshot.docs.find(d => d.id === testCrawler.id);
    if (found) {
      pass('Read crawler');
    } else {
      fail('Crawler not found after creation');
    }

    // UPDATE
    await updateDoc(docRef, { level: 2, gold: 200 });
    pass('Updated crawler');

    // DELETE
    await deleteDoc(docRef);
    pass('Deleted crawler');

  } catch (error) {
    fail('Crawler test failed', error);
  }
}

async function testMobs() {
  log('👹', 'Testing Mobs Collection...');
  
  const testMob = {
    id: `test-mob-${Date.now()}`,
    name: 'Test Dragon',
    hp: 50,
    ac: 15,
    damage: '2d6',
    description: 'A fearsome test dragon',
    image: null // Testing null value
  };

  try {
    const docRef = doc(db, 'mobs', testMob.id);
    await setDoc(docRef, testMob);
    pass('Created mob');

    // Test with image data
    const mobWithImage = {
      ...testMob,
      id: `test-mob-img-${Date.now()}`,
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };
    const imgDocRef = doc(db, 'mobs', mobWithImage.id);
    await setDoc(imgDocRef, mobWithImage);
    pass('Created mob with image data');

    // Cleanup
    await deleteDoc(docRef);
    await deleteDoc(imgDocRef);
    pass('Deleted test mobs');

  } catch (error) {
    fail('Mob test failed', error);
  }
}

async function testMaps() {
  log('🗺️', 'Testing Maps Collection...');
  
  const testMap = {
    id: `test-map-${Date.now()}`,
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    name: 'Test Map'
  };

  try {
    const docRef = doc(db, 'maps', testMap.id);
    await setDoc(docRef, testMap);
    pass('Created map with base64 image');

    // Test reading
    const snapshot = await getDocs(collection(db, 'maps'));
    if (snapshot.docs.length > 0) {
      pass(`Read ${snapshot.docs.length} map(s)`);
    }

    // Cleanup
    await deleteDoc(docRef);
    pass('Deleted test map');

  } catch (error) {
    fail('Map test failed', error);
  }
}

async function testEpisodes() {
  log('📺', 'Testing Episodes Collection...');
  
  const testEpisode = {
    id: `test-episode-${Date.now()}`,
    name: 'Test Episode',
    description: 'A test episode for Firebase',
    mapIds: ['0', '1'],
    mobPlacements: [
      { mobId: 'test-mob-1', x: 50, y: 50 },
      { mobId: 'test-mob-2', x: 75, y: 25 }
    ]
  };

  try {
    const docRef = doc(db, 'episodes', testEpisode.id);
    await setDoc(docRef, testEpisode);
    pass('Created episode with nested data');

    // Test array update
    await updateDoc(docRef, {
      mobPlacements: [
        ...testEpisode.mobPlacements,
        { mobId: 'test-mob-3', x: 25, y: 75 }
      ]
    });
    pass('Updated episode with array data');

    // Cleanup
    await deleteDoc(docRef);
    pass('Deleted test episode');

  } catch (error) {
    fail('Episode test failed', error);
  }
}

async function testInventory() {
  log('🎒', 'Testing Inventory Collection...');
  
  const testInventory = {
    id: `test-inventory-${Date.now()}`,
    crawlerId: 'test-crawler-123',
    items: [
      { id: 'item-1', name: 'Sword', description: 'A sharp blade', quantity: 1 },
      { id: 'item-2', name: 'Potion', description: 'Healing potion', quantity: 5 }
    ]
  };

  try {
    const docRef = doc(db, 'inventory', testInventory.id);
    await setDoc(docRef, testInventory);
    pass('Created inventory with array of items');

    // Cleanup
    await deleteDoc(docRef);
    pass('Deleted test inventory');

  } catch (error) {
    fail('Inventory test failed', error);
  }
}

async function testDataPersistence() {
  log('💾', 'Testing Data Persistence...');
  
  const testId = `persist-test-${Date.now()}`;
  const testData = {
    id: testId,
    testField: 'test value',
    numberField: 42,
    boolField: true,
    arrayField: [1, 2, 3],
    objectField: { nested: 'value' }
  };

  try {
    // Write
    const docRef = doc(db, 'crawlers', testId);
    await setDoc(docRef, testData);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Read back
    const snapshot = await getDocs(collection(db, 'crawlers'));
    const found = snapshot.docs.find(d => d.id === testId);
    
    if (found) {
      const data = found.data();
      if (data.testField === 'test value' && 
          data.numberField === 42 && 
          data.boolField === true &&
          Array.isArray(data.arrayField) &&
          data.objectField.nested === 'value') {
        pass('All data types persisted correctly');
      } else {
        fail('Data types not preserved correctly');
      }
    } else {
      fail('Data not found after write');
    }

    // Cleanup
    await deleteDoc(docRef);

  } catch (error) {
    fail('Data persistence test failed', error);
  }
}

async function testLargeImage() {
  log('🖼️', 'Testing Large Image Handling...');
  
  try {
    // Create a larger base64 image (about 10KB)
    const largeImage = 'data:image/png;base64,' + 'A'.repeat(10000);
    
    const testDoc = {
      id: `test-large-img-${Date.now()}`,
      name: 'Large Image Test',
      image: largeImage
    };

    const docRef = doc(db, 'mobs', testDoc.id);
    await setDoc(docRef, testDoc);
    pass('Large image saved successfully');

    // Cleanup
    await deleteDoc(docRef);

  } catch (error) {
    fail('Large image test failed', error);
  }
}

async function runTests() {
  console.log('\n🚀 Starting Firebase Comprehensive Test Suite\n');
  console.log('='.repeat(50));
  
  const authOk = await testAuth();
  if (!authOk) {
    console.log('\n❌ Authentication failed - cannot proceed with tests');
    return;
  }

  console.log('='.repeat(50));
  
  await testCrawlers();
  console.log('='.repeat(50));
  
  await testMobs();
  console.log('='.repeat(50));
  
  await testMaps();
  console.log('='.repeat(50));
  
  await testEpisodes();
  console.log('='.repeat(50));
  
  await testInventory();
  console.log('='.repeat(50));
  
  await testDataPersistence();
  console.log('='.repeat(50));
  
  await testLargeImage();
  console.log('='.repeat(50));

  console.log('\n📊 Test Results Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Total:  ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Firebase is working correctly.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Check errors above.\n');
  }

  process.exit(testsFailed === 0 ? 0 : 1);
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
