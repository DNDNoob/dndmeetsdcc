/**
 * One-time migration script: Link unclaimed content to "Bug tester" account & publish.
 *
 * What it does:
 * 1. Finds the "Bug tester" user profile by username
 * 2. Scans all campaigns for items (in inventory) and spells without a `createdBy` field
 * 3. Updates those items/spells with the Bug tester's UID and username
 * 4. Publishes them to the root-level `publicItems` / `publicSpells` collections
 *
 * Usage:
 *   node scripts/link-content-publish.mjs              # dry-run (default)
 *   node scripts/link-content-publish.mjs --commit     # actually write to Firebase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocs, updateDoc, setDoc
} from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = !process.argv.includes('--commit');

// ── helpers ──────────────────────────────────────────────────────────────────

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load env
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
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

  console.log(`🔧 Firebase project: ${firebaseConfig.projectId}`);
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes will be made' : '🔥 COMMIT MODE — writes are live!');
  console.log('');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Sign in
  await signInAnonymously(auth);
  console.log('🔐 Signed in anonymously');

  // ── Step 1: Find "Bug tester" user profile ─────────────────────────────
  const profilesSnap = await getDocs(collection(db, 'userProfiles'));
  let bugTesterUid = null;
  let bugTesterUsername = null;

  for (const d of profilesSnap.docs) {
    const data = d.data();
    const uname = (data.username || '').toLowerCase();
    const dname = (data.displayName || '').toLowerCase();
    if (uname === 'bug tester' || dname === 'bug tester' ||
        uname === 'bugtester' || dname === 'bugtester') {
      bugTesterUid = d.id;
      bugTesterUsername = data.username || data.displayName || 'Bug tester';
      break;
    }
  }

  if (!bugTesterUid) {
    console.error('❌ Could not find a user profile with username/displayName "Bug tester".');
    console.log('   Available profiles:');
    profilesSnap.docs.forEach(d => {
      const data = d.data();
      console.log(`     - uid=${d.id}  username="${data.username}"  displayName="${data.displayName}"`);
    });
    process.exit(1);
  }

  console.log(`✅ Found Bug tester: uid=${bugTesterUid}  username="${bugTesterUsername}"`);
  console.log('');

  // ── Step 2: List all campaigns (= room IDs) ───────────────────────────
  const campaignsSnap = await getDocs(collection(db, 'campaigns'));
  const roomIds = campaignsSnap.docs.map(d => d.id);
  console.log(`📋 Found ${roomIds.length} campaign(s): ${roomIds.join(', ')}`);
  console.log('');

  let totalItemsClaimed = 0;
  let totalSpellsClaimed = 0;

  for (const roomId of roomIds) {
    console.log(`── Room: ${roomId} ──`);

    // ── Step 3a: Scan inventory for unclaimed items ──────────────────────
    const invSnap = await getDocs(collection(db, `rooms/${roomId}/inventory`));

    for (const invDoc of invSnap.docs) {
      const invData = invDoc.data();
      const items = invData.items || [];
      const crawlerId = invData.crawlerId || invDoc.id;

      let updatedItems = [];
      let changed = false;

      for (const item of items) {
        if (!item.createdBy) {
          // Claim this item
          const updated = {
            ...item,
            createdBy: bugTesterUid,
            createdByUsername: bugTesterUsername,
            isPublic: true,
          };
          updatedItems.push(updated);
          changed = true;
          totalItemsClaimed++;
          console.log(`  📦 ITEM (unclaimed): "${item.name}" [${item.id}] in inventory ${crawlerId}`);

          // Publish to publicItems
          if (!DRY_RUN) {
            await setDoc(doc(db, 'publicItems', item.id), { ...updated, isPublic: true });
          }
        } else {
          updatedItems.push(item);
        }
      }

      if (changed && !DRY_RUN) {
        await updateDoc(doc(db, `rooms/${roomId}/inventory`, invDoc.id), { items: updatedItems });
        console.log(`  ✏️  Updated inventory doc: ${invDoc.id}`);
      }
    }

    // ── Step 3b: Scan spells for unclaimed spells ────────────────────────
    const spellsSnap = await getDocs(collection(db, `rooms/${roomId}/spells`));

    for (const spellDoc of spellsSnap.docs) {
      const spell = { id: spellDoc.id, ...spellDoc.data() };

      if (!spell.createdBy) {
        totalSpellsClaimed++;
        console.log(`  🔮 SPELL (unclaimed): "${spell.name}" [${spell.id}]`);

        const updates = {
          createdBy: bugTesterUid,
          createdByUsername: bugTesterUsername,
          isPublic: true,
        };

        if (!DRY_RUN) {
          await updateDoc(doc(db, `rooms/${roomId}/spells`, spellDoc.id), updates);
          await setDoc(doc(db, 'publicSpells', spell.id), { ...spell, ...updates });
        }
      }
    }

    console.log('');
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════');
  console.log(`Total unclaimed items found:  ${totalItemsClaimed}`);
  console.log(`Total unclaimed spells found: ${totalSpellsClaimed}`);
  if (DRY_RUN) {
    console.log('');
    console.log('👆 This was a DRY RUN. To apply changes, run:');
    console.log('   node scripts/link-content-publish.mjs --commit');
  } else {
    console.log('');
    console.log('✅ All unclaimed content has been linked and published!');
  }
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
