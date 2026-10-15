/**
 * One-time script: publish a user's content (and unclaimed content in their campaigns)
 * to the community collections.
 *
 * What gets published:
 *   • Library items (inventory/__shared__) and spells created by the user, in ANY campaign
 *   • In campaigns the user OWNS (is DM of):
 *       - library items and spells with no creator → claimed by the user, then published
 *       - maps, mob types and episodes with no creator (or created by the user)
 *   Content created by other players is never touched.
 *
 * Writes go to: publicItems, publicSpells, publicMaps, publicMobs,
 *               publicEpisodes (+ publicEpisodes/{id}/maps, publicEpisodes/{id}/mobs)
 * and the source docs get createdBy / createdByUsername / isPublic stamped on them.
 *
 * Usage:
 *   node scripts/publish-my-content.mjs --user you@example.com            # dry-run (default)
 *   node scripts/publish-my-content.mjs --user YourUsername --commit      # actually write
 *
 * Requires the same .env as the app (VITE_FIREBASE_*).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  initializeFirestore, collection, doc, getDocs, updateDoc, setDoc, deleteDoc,
} from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = !process.argv.includes('--commit');
const userArgIdx = process.argv.indexOf('--user');
const USER_ARG = userArgIdx !== -1 ? process.argv[userArgIdx + 1] : null;

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

const publicDocId = (campaignId, sourceId) => `${campaignId}__${sourceId}`;
const mapImage = (m) => m.image || m.imageUrl || m.url || m.value || '';

// Must match buildEpisodeBundle in src/lib/publicContent.ts
function toMobType(mob) {
  const { createdBy, createdByUsername, isPublic, sourceId, sourceCampaignId, publishedAt, roomId, ...rest } = mob;
  return { ...rest, encountered: false };
}
function resetMapSettings(settings) {
  return { ...settings, fogOfWar: { enabled: settings.fogOfWar?.enabled ?? false, revealedAreas: [] } };
}
function buildEpisodeBundle(episode, mapDocs, mobs, lootBoxTemplates) {
  const mapIndexToBundle = new Map();
  const bundleMaps = [];
  for (const mapId of episode.mapIds || []) {
    const d = mapDocs[parseInt(mapId, 10)];
    if (!d?.image || mapIndexToBundle.has(mapId)) continue;
    mapIndexToBundle.set(mapId, String(bundleMaps.length));
    bundleMaps.push({ name: d.name || `Map ${bundleMaps.length + 1}`, image: d.image });
  }
  const firstMapId = (episode.mapIds || [])[0];
  const mobPlacements = [];
  for (const p of episode.mobPlacements || []) {
    const idx = mapIndexToBundle.get(p.mapId || firstMapId);
    if (idx === undefined || !mobs.some((m) => m.id === p.mobId)) continue;
    const { currentHP, ...rest } = p;
    mobPlacements.push({ ...rest, mapId: idx });
  }
  const used = new Set(mobPlacements.map((p) => p.mobId));
  const bundleMobs = mobs.filter((m) => used.has(m.id)).map(toMobType);
  const mapSettings = {};
  for (const [mapId, s] of Object.entries(episode.mapSettings || {})) {
    const idx = mapIndexToBundle.get(mapId);
    if (idx !== undefined && s) mapSettings[idx] = resetMapSettings(s);
  }
  const templateIds = new Set(episode.lootBoxIds || []);
  const bundleTemplates = [
    ...lootBoxTemplates.filter((t) => templateIds.has(t.id)),
    ...(episode.lootBoxes || []).filter((t) => !templateIds.has(t.id)),
  ].map(({ id, name, tier, items, gold }) => ({ id, name, tier, items: items || [], ...(gold !== undefined ? { gold } : {}) }));
  return {
    episode: {
      name: episode.name,
      description: episode.description || '',
      mapNames: bundleMaps.map((m) => m.name),
      mobNames: bundleMobs.map((m) => m.name),
      mobPlacements,
      mapSettings,
      ...(episode.defaultFogOfWar !== undefined ? { defaultFogOfWar: episode.defaultFogOfWar } : {}),
      ...(episode.startingGameTime !== undefined ? { startingGameTime: episode.startingGameTime } : {}),
      lootBoxTemplates: bundleTemplates,
    },
    assets: { maps: bundleMaps, mobs: bundleMobs },
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!USER_ARG) {
    console.error('❌ Usage: node scripts/publish-my-content.mjs --user <email|username> [--commit]');
    process.exit(1);
  }
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
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  await signInAnonymously(auth);

  const write = async (label, fn) => {
    console.log(`    ${DRY_RUN ? 'would' : '→'} ${label}`);
    if (!DRY_RUN) await fn();
  };

  // ── Find the user ──────────────────────────────────────────────────────
  const needle = USER_ARG.toLowerCase();
  const profilesSnap = await getDocs(collection(db, 'userProfiles'));
  const profileDoc = profilesSnap.docs.find((d) => {
    const p = d.data();
    return [p.email, p.username, p.displayName].some((v) => (v || '').toLowerCase() === needle);
  });
  if (!profileDoc) {
    console.error(`❌ No user profile with email/username/displayName "${USER_ARG}".`);
    process.exit(1);
  }
  const uid = profileDoc.id;
  const username = profileDoc.data().username || profileDoc.data().displayName || undefined;
  const creator = { createdBy: uid, ...(username ? { createdByUsername: username } : {}) };
  console.log(`✅ User: uid=${uid} username="${username}"`);

  const campaignsSnap = await getDocs(collection(db, 'campaigns'));
  const campaigns = campaignsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ownedIds = new Set(campaigns.filter((c) => c.ownerId === uid).map((c) => c.id));
  console.log(`📋 ${campaigns.length} campaign(s), ${ownedIds.size} owned: ${campaigns.filter((c) => ownedIds.has(c.id)).map((c) => c.name).join(', ') || '(none)'}`);
  console.log('');

  const totals = { items: 0, spells: 0, maps: 0, mobs: 0, episodes: 0 };
  const publishedItemKeys = new Set(); // dedupe identical items across campaigns

  for (const campaign of campaigns) {
    const roomId = campaign.id;
    const owned = ownedIds.has(roomId);
    const isMine = (createdBy) => createdBy === uid || (owned && !createdBy);
    console.log(`── ${campaign.name || roomId} ${owned ? '(owned)' : ''} ──`);

    // ── Library items ────────────────────────────────────────────────────
    const invSnap = await getDocs(collection(db, `rooms/${roomId}/inventory`));
    const shared = invSnap.docs.find((d) => (d.data().crawlerId || d.id) === '__shared__');
    if (shared) {
      const items = shared.data().items || [];
      let changed = false;
      const updated = [];
      for (const item of items) {
        if (!isMine(item.createdBy)) { updated.push(item); continue; }
        const next = { ...item, ...(item.createdBy ? {} : creator), isPublic: true };
        const key = `${(item.name || '').toLowerCase()}|${item.description || ''}`;
        if (!item.isPublic || !item.createdBy) changed = true;
        updated.push(next);
        if (publishedItemKeys.has(key)) continue;
        publishedItemKeys.add(key);
        totals.items++;
        await write(`item "${item.name}"`, () => setDoc(doc(db, 'publicItems', item.id), next));
      }
      if (changed) {
        await write(`update library (${roomId})`, () => updateDoc(shared.ref, { items: updated }));
      }
    }

    // ── Spells ───────────────────────────────────────────────────────────
    const spellsSnap = await getDocs(collection(db, `rooms/${roomId}/spells`));
    for (const sd of spellsSnap.docs) {
      const spell = { id: sd.id, ...sd.data() };
      if (!isMine(spell.createdBy)) continue;
      const stamp = { ...(spell.createdBy ? {} : creator), isPublic: true };
      totals.spells++;
      await write(`spell "${spell.name}"`, async () => {
        await updateDoc(sd.ref, stamp);
        await setDoc(doc(db, 'publicSpells', spell.id), { ...spell, ...stamp });
      });
    }

    if (!owned) { console.log(''); continue; }

    // ── Maps (Firestore returns docs sorted by ID = the app's map index order) ──
    const mapsSnap = await getDocs(collection(db, `rooms/${roomId}/maps`));
    const mapDocs = mapsSnap.docs
      .map((d) => ({ ref: d.ref, id: d.id, ...d.data(), image: mapImage(d.data()) }))
      .filter((m) => !!m.image);
    for (const [index, m] of mapDocs.entries()) {
      if (!isMine(m.createdBy)) continue;
      const by = m.createdBy ? { createdBy: m.createdBy, ...(m.createdByUsername ? { createdByUsername: m.createdByUsername } : {}) } : creator;
      const pub = {
        id: publicDocId(roomId, m.id), sourceId: m.id, sourceCampaignId: roomId,
        name: m.name || `Map ${index + 1}`, image: m.image, ...by, publishedAt: Date.now(),
      };
      totals.maps++;
      await write(`map "${pub.name}"`, async () => {
        await setDoc(doc(db, 'publicMaps', pub.id), pub);
        await updateDoc(m.ref, { ...by, isPublic: true, sharedImage: true });
      });
    }

    // ── Mob types ────────────────────────────────────────────────────────
    const mobsSnap = await getDocs(collection(db, `rooms/${roomId}/mobs`));
    const mobs = mobsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    for (const mob of mobs) {
      if (!isMine(mob.createdBy)) continue;
      const by = mob.createdBy ? { createdBy: mob.createdBy, ...(mob.createdByUsername ? { createdByUsername: mob.createdByUsername } : {}) } : creator;
      const { roomId: _r, ...mobData } = mob;
      const pub = {
        ...mobData, ...by, id: publicDocId(roomId, mob.id), sourceId: mob.id, sourceCampaignId: roomId,
        encountered: false, isPublic: true, publishedAt: Date.now(),
      };
      totals.mobs++;
      await write(`mob "${mob.name}"`, async () => {
        await setDoc(doc(db, 'publicMobs', pub.id), pub);
        await updateDoc(doc(db, `rooms/${roomId}/mobs`, mob.id), { ...by, isPublic: true });
      });
    }

    // ── Episodes ─────────────────────────────────────────────────────────
    const templatesSnap = await getDocs(collection(db, `rooms/${roomId}/lootBoxTemplates`));
    const templates = templatesSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const episodesSnap = await getDocs(collection(db, `rooms/${roomId}/episodes`));
    for (const ed of episodesSnap.docs) {
      const episode = { ...ed.data(), id: ed.id };
      if (!isMine(episode.createdBy)) continue;
      const bundle = buildEpisodeBundle(episode, mapDocs, mobs, templates);
      if (bundle.assets.maps.length === 0) {
        console.log(`    skip episode "${episode.name}" (no maps)`);
        continue;
      }
      const by = episode.createdBy ? { createdBy: episode.createdBy, ...(episode.createdByUsername ? { createdByUsername: episode.createdByUsername } : {}) } : creator;
      const publicId = publicDocId(roomId, episode.id);
      const pub = { ...bundle.episode, ...by, id: publicId, sourceId: episode.id, sourceCampaignId: roomId, publishedAt: Date.now() };
      totals.episodes++;
      await write(`episode "${episode.name}" (${bundle.assets.maps.length} maps, ${bundle.assets.mobs.length} mob types)`, async () => {
        for (const sub of ['maps', 'mobs']) {
          const old = await getDocs(collection(db, 'publicEpisodes', publicId, sub));
          await Promise.all(old.docs.map((d) => deleteDoc(d.ref)));
        }
        for (const [i, m] of bundle.assets.maps.entries()) {
          await setDoc(doc(db, 'publicEpisodes', publicId, 'maps', String(i)), { index: i, ...m });
        }
        for (const mob of bundle.assets.mobs) {
          await setDoc(doc(db, 'publicEpisodes', publicId, 'mobs', mob.id), mob);
        }
        await setDoc(doc(db, 'publicEpisodes', publicId), pub);
        await updateDoc(ed.ref, { ...by, isPublic: true });
      });
    }
    console.log('');
  }

  console.log('════════════════════════════════════════');
  console.log(`Items: ${totals.items}  Spells: ${totals.spells}  Maps: ${totals.maps}  Mobs: ${totals.mobs}  Episodes: ${totals.episodes}`);
  if (DRY_RUN) {
    console.log('\n👆 DRY RUN. To apply:  node scripts/publish-my-content.mjs --user ' + USER_ARG + ' --commit');
  } else {
    console.log('\n✅ Done.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
