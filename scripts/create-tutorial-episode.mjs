/**
 * Builds the tutorial episode ("Tutorial: Rat Problem") as its own campaign, owned by one account.
 *
 * Everything the tutorial contains (maps, characters, merchant stock, items, quest, story text)
 * lives in scripts/tutorial/episode.json; the map pictures are in scripts/tutorial/maps/.
 * Edit those and run the script again to rebuild: every document has a fixed `tutorial-` id,
 * so a re-run replaces the tutorial's own documents and never touches anything else.
 *
 * Usage:
 *   node scripts/create-tutorial-episode.mjs --owner you@example.com            # dry run (default)
 *   node scripts/create-tutorial-episode.mjs --owner you@example.com --commit   # actually write
 *
 * Writes with the admin service account (VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_CLIENT_EMAIL,
 * VITE_FIREBASE_PRIVATE_KEY, VITE_FIREBASE_STORAGE_BUCKET), the same one scripts/firestore-rules.py uses.
 * With FIRESTORE_EMULATOR_HOST (+ FIREBASE_AUTH_EMULATOR_HOST, FIREBASE_STORAGE_EMULATOR_HOST)
 * set, it talks to the local Firebase emulators instead and needs no credentials.
 *
 * What it writes:
 *   campaigns/{id} (created once; a re-run only updates its name and description) + campaignInvites/{code}
 *   rooms/{id}/maps, mobs, spells, lootBoxTemplates, quests, episodes, gameClock/current (if missing)
 *   Storage maps/tutorial-*.jpg for the map pictures (too big to keep inside Firestore)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TUTORIAL_DIR = path.join(__dirname, 'tutorial');
const COMMIT = process.argv.includes('--commit');
const ownerIdx = process.argv.indexOf('--owner');
const OWNER_EMAIL = ownerIdx !== -1 ? process.argv[ownerIdx + 1] : null;

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET;

const log = (...args) => console.log('[Tutorial]', ...args);

// ── auth ─────────────────────────────────────────────────────────────────────

async function accessToken() {
  if (EMULATOR) return 'owner';
  let key = (process.env.VITE_FIREBASE_PRIVATE_KEY || '').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  if (!key.includes('BEGIN')) {
    const body = key.replace(/\s/g, '').match(/.{1,64}/g).join('\n');
    key = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }
  const b64 = (buf) => Buffer.from(buf).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: process.env.VITE_FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const msg = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify(claims))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(msg), key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${msg}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

let TOKEN = null;

async function api(url, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Firestore REST ───────────────────────────────────────────────────────────

const FS_BASE = EMULATOR
  ? `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const docName = (p) => `projects/${PROJECT}/databases/(default)/documents/${p}`;

function toValue(v) {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  throw new Error(`Cannot store ${typeof v}`);
}

// Drops undefined values, like cleanObject() in the app
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) fields[k] = toValue(v);
  return fields;
}

function fromValue(v) {
  const [k, x] = Object.entries(v)[0];
  if (k === 'mapValue') return Object.fromEntries(Object.entries(x.fields || {}).map(([a, b]) => [a, fromValue(b)]));
  if (k === 'arrayValue') return (x.values || []).map(fromValue);
  if (k === 'integerValue') return Number(x);
  return x;
}

async function getDoc(p) {
  const d = await api(`${FS_BASE}/${p}`);
  return d ? Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromValue(v)])) : null;
}

/** Commits writes in chunks. `set` replaces the whole document (our own tutorial- docs only); `merge` updates the listed fields. */
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const chunk = writes.slice(i, i + 400).map((w) => ({
      update: { name: docName(w.path), fields: toFields(w.data) },
      ...(w.merge ? { updateMask: { fieldPaths: Object.keys(w.data).filter((k) => w.data[k] !== undefined).map((k) => `\`${k}\``) } } : {}),
      ...(w.mustNotExist ? { currentDocument: { exists: false } } : {}),
    }));
    await api(`${FS_BASE}:commit`, { method: 'POST', body: { writes: chunk } });
  }
}

// ── accounts ────────────────────────────────────────────────────────────────

async function lookupUser(email) {
  const base = EMULATOR
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1';
  const res = await api(`${base}/projects/${PROJECT}/accounts:lookup`, { method: 'POST', body: { email: [email] } });
  const user = res?.users?.[0];
  if (!user) throw new Error(`No account signs in with ${email}`);
  return user;
}

// ── Storage ─────────────────────────────────────────────────────────────────

/** Uploads a map picture and returns a download URL like the app's getDownloadURL(). */
async function uploadMap(storagePath, file) {
  const bytes = fs.readFileSync(file);
  const token = crypto.createHash('sha256').update(`${storagePath}:${bytes.length}`).digest('hex').slice(0, 32)
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const encoded = encodeURIComponent(storagePath);
  if (EMULATOR) {
    const host = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`;
    const res = await api(`${host}/v0/b/${BUCKET}/o?name=${encoded}`, {
      method: 'POST', raw: true, body: bytes, headers: { 'Content-Type': 'image/jpeg' },
    });
    return `${host}/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${res.downloadTokens}`;
  }
  const boundary = `tutorial-${crypto.randomUUID()}`;
  const meta = { name: storagePath, contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  await api(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart`, {
    method: 'POST', raw: true, body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${token}`;
}

// ── build ───────────────────────────────────────────────────────────────────

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Library items are referenced by key in episode.json; each copy gets its own stable id. */
function makeItemFactory(items) {
  const counts = {};
  return (key, owner) => {
    const def = items[key];
    if (!def) throw new Error(`Unknown item "${key}" in episode.json`);
    counts[`${owner}:${key}`] = (counts[`${owner}:${key}`] ?? 0) + 1;
    return { id: `tutorial-item-${owner}-${slug(key)}-${counts[`${owner}:${key}`]}`, ...def };
  };
}

function inviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), (b) => chars[b % chars.length]).join('');
}

async function main() {
  if (!OWNER_EMAIL) throw new Error('Pass --owner <email of the account that will DM the tutorial>');
  if (!PROJECT) throw new Error('VITE_FIREBASE_PROJECT_ID is not set');
  if (!BUCKET) throw new Error('VITE_FIREBASE_STORAGE_BUCKET is not set');
  log(EMULATOR ? 'Using the local emulators' : `Using project ${PROJECT}`, COMMIT ? '(writing)' : '(dry run)');

  const content = JSON.parse(fs.readFileSync(path.join(TUTORIAL_DIR, 'episode.json'), 'utf8'));
  TOKEN = await accessToken();

  const owner = await lookupUser(OWNER_EMAIL);
  const ownerId = owner.localId;
  const profile = await getDoc(`userProfiles/${ownerId}`);
  const ownerName = profile?.displayName || profile?.username || owner.displayName || 'Unknown';
  const username = profile?.username || ownerName;
  log(`Owner: ${ownerName} (${ownerId})`);

  const campaignId = content.campaign.id;
  const room = `rooms/${campaignId}`;
  const now = new Date().toISOString();
  const attribution = { createdBy: ownerId, createdByUsername: username };
  const makeItem = makeItemFactory(content.items);
  const writes = [];

  // Campaign: created once, so a re-run keeps its members and invite code
  const existingCampaign = await getDoc(`campaigns/${campaignId}`);
  if (existingCampaign) {
    if (existingCampaign.ownerId !== ownerId) throw new Error(`Campaign ${campaignId} already belongs to someone else`);
    writes.push({ path: `campaigns/${campaignId}`, merge: true, data: { name: content.campaign.name, description: content.campaign.description, updatedAt: Date.now() } });
  } else {
    const code = inviteCode();
    writes.push({
      path: `campaigns/${campaignId}`, mustNotExist: true,
      data: {
        id: campaignId, name: content.campaign.name, description: content.campaign.description,
        ownerId, ownerName, memberIds: [ownerId], maxMembers: 10, inviteCode: code,
        createdAt: Date.now(), updatedAt: Date.now(),
      },
    });
    writes.push({ path: `campaignInvites/${code}`, data: { campaignId, createdAt: Date.now() } });
  }

  // Maps: doc ids sort in play order, so map index i is maps[i] in the app
  const mapIndex = {};
  const mapDocs = [];
  for (const [i, m] of content.maps.entries()) {
    mapIndex[m.key] = String(i);
    const file = path.join(TUTORIAL_DIR, 'maps', m.file);
    const storagePath = `maps/tutorial-${slug(m.key)}.jpg`;
    const image = COMMIT ? await uploadMap(storagePath, file) : `(upload ${m.file}, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB → ${storagePath})`;
    const id = `tutorial-map-${i}-${slug(m.key)}`;
    mapDocs.push({ id, name: m.name, image });
    writes.push({ path: `${room}/maps/${id}`, data: { id, name: m.name, image, roomId: campaignId, ...attribution, createdAt: now, updatedAt: now } });
  }

  for (const spell of content.spells) {
    writes.push({ path: `${room}/spells/${spell.id}`, data: { ...spell, roomId: campaignId, ...attribution } });
  }

  for (const mob of content.mobs) {
    const kind = mob.kind ?? 'creature';
    const data = {
      ...mob,
      kind,
      boss: !!mob.boss,
      type: mob.boss ? 'boss' : kind === 'character' ? 'npc' : 'normal',
      encountered: false,
      hidden: !!mob.hidden,
      defaultInventory: (mob.defaultInventory ?? []).map((key) => makeItem(key, slug(mob.name))),
      merchant: mob.merchant
        ? { ...mob.merchant, stock: mob.merchant.stock.map((s) => ({ item: makeItem(s.item, 'store'), quantity: s.quantity })) }
        : undefined,
      roomId: campaignId,
      ...attribution,
    };
    writes.push({ path: `${room}/mobs/${mob.id}`, data });
  }

  for (const box of content.lootBoxTemplates) {
    writes.push({ path: `${room}/lootBoxTemplates/${box.id}`, data: { ...box, items: box.items.map((key) => makeItem(key, slug(box.id.replace('tutorial-loot-', '')))), roomId: campaignId } });
  }

  for (const q of content.quests) {
    const data = {
      ...q,
      actionItems: q.actionItems.map((a) => ({ ...a, completedBy: [] })),
      rewards: q.rewards.map((r) => ({ ...r, item: makeItem(r.item, 'quest'), claimedBy: [] })),
      notes: [],
      roomId: campaignId,
      createdAt: now,
      updatedAt: now,
    };
    writes.push({ path: `${room}/quests/${q.id}`, data });
  }

  const letters = {};
  const mobPlacements = content.placements.map((p) => {
    if (!(p.map in mapIndex)) throw new Error(`Unknown map "${p.map}" in placements`);
    const key = `${p.mob}@${p.map}`;
    letters[key] = (letters[key] ?? -1) + 1;
    return { mobId: p.mob, mapId: mapIndex[p.map], x: p.x, y: p.y, letterIndex: letters[key], ...(p.hostile !== undefined ? { hostile: p.hostile } : {}) };
  });
  const mapSettings = Object.fromEntries(content.maps.map((m, i) => [String(i), { fogOfWar: { enabled: !!m.fogOfWar, revealedAreas: [] }, scale: 100 }]));
  const startingGameTime = Date.parse(content.startingGameTime);
  writes.push({
    path: `${room}/episodes/${content.episode.id}`,
    data: {
      ...content.episode,
      mapIds: content.maps.map((_, i) => String(i)),
      mobPlacements,
      crawlerPlacements: [],
      mapSettings,
      defaultFogOfWar: false,
      lootBoxIds: content.lootBoxTemplates.map((b) => b.id),
      questIds: content.quests.map((q) => q.id),
      startingGameTime,
      roomId: campaignId,
      ...attribution,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (!(await getDoc(`${room}/gameClock/current`))) {
    writes.push({ path: `${room}/gameClock/current`, data: { id: 'current', gameTime: startingGameTime, roomId: campaignId } });
  }

  for (const w of writes) log(`${w.merge ? 'update' : 'set   '} ${w.path}`);
  log(`${writes.length} documents, ${mapDocs.length} map pictures, ${mobPlacements.length} tokens`);
  if (!COMMIT) {
    log('Dry run: nothing written. Add --commit to write.');
    return;
  }
  await commit(writes);
  log(`Done. Campaign "${content.campaign.name}" (${campaignId}) is in ${ownerName}'s campaign list.`);
}

main().catch((err) => {
  console.error('[Tutorial] ❌', err.message);
  process.exit(1);
});
