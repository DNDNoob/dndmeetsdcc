#!/usr/bin/env node
/**
 * NPC voices: runs on the DM's computer next to Ollama and makes NPCs talk in Show Time.
 *
 * It signs in to Firebase with its own account, watches the DM's campaigns, and while a
 * game is running it reads the chat and game state, decides when an NPC would speak,
 * asks the local model for one line, and posts it to the game chat. Players see the line
 * in the chat and as a speech bubble over the NPC on the map.
 *
 * Setup (once):   node scripts/npc-voices/index.mjs --setup --dm <your in-game username>
 * Run:            node scripts/npc-voices/index.mjs           (or: npm run npc-voices)
 *
 * Reads the app's Firebase config (VITE_FIREBASE_*) from .env and its own settings from
 * .env.npc (written by --setup). See scripts/npc-voices/README.md.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore, collection, doc, onSnapshot, query, where, getDocs, setDoc, connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  hasPersonality, distance, mentionsName, timeOfDay, hpWords,
  buildSystemPrompt, buildLinePrompt, buildShouldSpeakPrompt, buildSecretCheckPrompt,
  formatTranscript, isYes, cleanLine,
} from './brain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ── settings ─────────────────────────────────────────────────────────────────

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const NPC_ENV_FILE = path.join(ROOT, '.env.npc');
const env = { ...loadEnvFile(path.join(ROOT, '.env')), ...loadEnvFile(NPC_ENV_FILE), ...process.env };
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

const CONFIG = {
  ollamaUrl: (env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  models: { quality: env.NPC_MODEL_QUALITY || 'qwen3:14b', fast: env.NPC_MODEL_FAST || 'qwen3:8b' },
  // Free RAM needed before loading each model (GB). The 14B splits across GPU and RAM.
  minFreeGB: { quality: num(env.NPC_QUALITY_MIN_FREE_GB, 6), fast: num(env.NPC_FAST_MIN_FREE_GB, 2.5) },
  nearDistance: num(env.NPC_NEAR_DISTANCE, 12),        // map-% units
  npcCooldownMs: num(env.NPC_COOLDOWN_SECONDS, 20) * 1000,
  globalGapMs: num(env.NPC_GLOBAL_GAP_SECONDS, 4) * 1000,
  idleSilenceMs: num(env.NPC_IDLE_SECONDS, 60) * 1000,
  greetCooldownMs: 120_000,
  unloadAfterMs: num(env.NPC_UNLOAD_MINUTES, 15) * 60_000,
  jobMaxAgeMs: 60_000,
  transcriptLines: 10,
  heartbeatMs: 30_000,
};

const log = (...args) => console.log(new Date().toISOString(), ...args);
const warn = (...args) => console.warn(new Date().toISOString(), ...args);

// ── setup ────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase config. Put the VITE_FIREBASE_* values in .env at the repo root.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
const auth = getAuth(app);
// Local testing only: NPC_EMULATOR=1 talks to the Firebase emulators instead of the real project
if (env.NPC_EMULATOR === '1') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

const args = process.argv.slice(2);
const argValue = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

async function runSetup() {
  const dm = argValue('--dm') || env.NPC_DM_USERNAME;
  if (!dm) {
    console.error('Usage: node scripts/npc-voices/index.mjs --setup --dm <your in-game username>');
    process.exit(1);
  }
  let { NPC_EMAIL: email, NPC_PASSWORD: password } = loadEnvFile(NPC_ENV_FILE);
  if (!email || !password) {
    email = `npc-voices-${crypto.randomBytes(5).toString('hex')}@npc-voices.invalid`;
    password = crypto.randomBytes(24).toString('base64url');
    await createUserWithEmailAndPassword(auth, email, password);
    log('Created the NPC voices account.');
  } else {
    await signInWithEmailAndPassword(auth, email, password);
  }
  fs.writeFileSync(NPC_ENV_FILE, [
    '# NPC voices settings (keep this file private; it is git-ignored)',
    `NPC_EMAIL=${email}`,
    `NPC_PASSWORD=${password}`,
    `NPC_DM_USERNAME=${dm}`,
    '',
  ].join('\n'));
  console.log(`Saved ${path.relative(ROOT, NPC_ENV_FILE)}.`);
  console.log(`NPC voices account uid: ${auth.currentUser.uid}`);
  console.log('Firestore rules must allow this uid to write rooms/{room}/chatMessages and rooms/{room}/npcAi.');
  process.exit(0);
}

// ── Ollama ───────────────────────────────────────────────────────────────────

async function ollama(pathname, body) {
  const res = await fetch(`${CONFIG.ollamaUrl}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Ollama ${pathname} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function loadedModels() {
  try { return ((await ollama('/api/ps')).models || []).map((m) => m.name || m.model); } catch { return null; }
}

async function chat(model, system, user, { maxTokens = 80, temperature = 0.8 } = {}) {
  const res = await ollama('/api/chat', {
    model,
    stream: false,
    think: false,
    keep_alive: '30m',
    options: { num_ctx: 4096, temperature, num_predict: maxTokens },
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
  });
  return res.message?.content ?? '';
}

async function unloadAll() {
  const names = (await loadedModels()) || [];
  for (const name of names) {
    try { await ollama('/api/generate', { model: name, keep_alive: 0 }); } catch { /* already gone */ }
  }
  if (names.length) log('Unloaded', names.join(', '));
}

const freeGB = () => os.freemem() / 1024 ** 3;

/**
 * Pick the model to use: the DM's choice if it fits in memory, else the fast one.
 * Returns { model, note, busy }.
 */
async function chooseModel(choice) {
  const loaded = (await loadedModels()) ?? null;
  if (loaded === null) return { model: null, busy: true, note: "Ollama isn't running on the DM's computer" };
  const want = choice === 'fast' ? 'fast' : 'quality';
  const wantModel = CONFIG.models[want];
  if (loaded.includes(wantModel) || freeGB() >= CONFIG.minFreeGB[want]) return { model: wantModel, note: '' };
  if (want === 'quality') {
    const fast = CONFIG.models.fast;
    if (loaded.includes(fast) || freeGB() >= CONFIG.minFreeGB.fast) {
      return { model: fast, note: 'Using the Fast model: close other apps on the DM computer for Best quality' };
    }
  }
  return { model: null, busy: true, note: 'Laptop busy: not enough free memory to run a model' };
}

// ── keep the computer awake while a game runs (Windows) ──────────────────────

let keepAwakeProc = null;
function setKeepAwake(on) {
  if (process.platform !== 'win32') return;
  if (on && !keepAwakeProc) {
    const ps = [
      'Add-Type -Name W -Namespace K -MemberDefinition \'[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);\';',
      '[K.W]::SetThreadExecutionState(0x80000001) | Out-Null;',
      'while ($true) { Start-Sleep -Seconds 60 }',
    ].join(' ');
    keepAwakeProc = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { stdio: 'ignore', windowsHide: true });
    keepAwakeProc.on('exit', () => { keepAwakeProc = null; });
  } else if (!on && keepAwakeProc) {
    keepAwakeProc.kill();
    keepAwakeProc = null;
  }
}

// ── one campaign room ────────────────────────────────────────────────────────

class Room {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.path = `rooms/${id}`;
    this.live = false;
    this.showtime = null;
    this.settings = {};
    this.secrets = {};
    this.state = {
      mobs: [], crawlers: [], episode: null, combat: null, clock: null,
      crawlerPlacements: [], runtimeMobPlacements: [], chat: [], lootBoxes: [],
    };
    this.liveUnsubs = [];
    this.placementUnsubs = [];
    this.queue = [];
    this.working = false;
    this.lastNpcLineAt = 0;
    this.lastLineByNpc = new Map();
    this.lastGreet = new Map();     // `${crawlerId}:${mobId}` → ms
    this.lastActivityAt = Date.now();
    this.lastIdleMutterAt = 0;
    this.prevNear = new Set();      // `${crawlerId}:${mobId}` pairs near each other
    this.lastNpcByCrawler = new Map(); // crawlerId → mobId of the NPC they last talked with
    this.persuadeTries = new Map();    // `${crawlerId}:${mobId}` → { turn, at } of the last Persuasion try
    this.activeModel = null;
    this.note = '';
    this.busy = false;
    this.unloaded = true;

    this.baseUnsubs = [
      onSnapshot(doc(db, `${this.path}/showtime-state/current`), (snap) => this.onShowtime(snap.exists() ? snap.data() : null), (e) => warn(`[${name}] showtime listener`, e.message)),
      onSnapshot(doc(db, `${this.path}/npcAi/settings`), (snap) => { this.settings = snap.exists() ? snap.data() : {}; this.publishStatus(); }, (e) => warn(`[${name}] settings listener`, e.message)),
      onSnapshot(doc(db, `${this.path}/npcAi/secrets`), (snap) => this.onSecrets(snap.exists() ? snap.data() : {}), (e) => warn(`[${name}] secrets listener`, e.message)),
    ];
  }

  get enabled() { return this.settings.enabled !== false; }

  dispose() {
    this.stop();
    this.baseUnsubs.forEach((u) => u());
  }

  // ── lifecycle ──

  onShowtime(data) {
    this.showtime = data;
    const live = !!data && data.gameStarted === true && data.isActive === true && !!data.episodeId;
    if (live && !this.live) this.start();
    else if (!live && this.live) this.stop();
    else if (live) this.syncEpisode(); // map or episode may have changed
  }

  syncEpisode() {
    this.state.episode = (this.state.episodes || []).find((e) => e.id === this.showtime?.episodeId) || null;
    this.watchPlacements();
  }

  start() {
    this.live = true;
    this.startedAt = Date.now();
    this.lastActivityAt = Date.now();
    log(`[${this.name}] Game started: NPC voices listening`);
    const sub = (ref, onData) => onSnapshot(ref, onData, (e) => warn(`[${this.name}]`, e.message));
    this.liveUnsubs = [
      sub(collection(db, `${this.path}/mobs`), (s) => { this.state.mobs = s.docs.map((d) => ({ ...d.data(), id: d.id })); }),
      sub(collection(db, `${this.path}/crawlers`), (s) => this.onCrawlers(s.docs.map((d) => ({ ...d.data(), id: d.id })))),
      sub(collection(db, `${this.path}/episodes`), (s) => {
        this.state.episodes = s.docs.map((d) => ({ ...d.data(), id: d.id }));
        this.syncEpisode();
      }),
      sub(doc(db, `${this.path}/combatState/current`), (s) => this.onCombat(s.exists() ? s.data() : null)),
      sub(doc(db, `${this.path}/gameClock/current`), (s) => { this.state.clock = s.exists() ? s.data() : null; }),
      sub(collection(db, `${this.path}/lootBoxes`), (s) => this.onLootBoxes(s.docs.map((d) => ({ ...d.data(), id: d.id })))),
      sub(collection(db, `${this.path}/chatMessages`), (s) => this.onChat(s)),
      sub(collection(db, `${this.path}/diceRolls`), (s) => this.onDiceRolls(s)),
      sub(doc(db, `${this.path}/noncombatTurns/current`), (s) => { this.state.noncombatTurn = s.exists() ? s.data() : null; }),
    ];
    this.watchPlacements();
    this.heartbeat = setInterval(() => this.publishStatus(), CONFIG.heartbeatMs);
    this.tick = setInterval(() => this.onTick(), 5_000);
    setKeepAwake(true);
    this.publishStatus();
  }

  stop() {
    if (!this.live) return;
    this.live = false;
    log(`[${this.name}] Game ended: NPC voices idle`);
    this.liveUnsubs.forEach((u) => u());
    this.placementUnsubs.forEach((u) => u());
    this.liveUnsubs = [];
    this.placementUnsubs = [];
    clearInterval(this.heartbeat);
    clearInterval(this.tick);
    this.queue = [];
    this.state.chat = [];
    this.state.episode = null;
    this.placementKey = null;
    this.chatPrimed = this.crawlersPrimed = this.combatPrimed = this.lootPrimed = this.primedPlacements = this.rollsPrimed = false;
    this.prevNear = new Set();
    this.writeStatus({ heartbeatAt: 0, thinking: null, activeModel: null });
    onRoomsChanged();
  }

  get currentMapId() {
    const ep = this.state.episode;
    const idx = this.showtime?.currentMapIndex ?? 0;
    return ep?.mapIds?.[idx] ?? null;
  }

  /** Follow token positions for the episode's current map (re-run when the map changes). */
  watchPlacements() {
    const epId = this.showtime?.episodeId;
    const mapId = this.currentMapId;
    const key = epId && mapId !== null ? `${epId}-${mapId}` : null;
    if (key === this.placementKey) return;
    this.placementKey = key;
    this.placementUnsubs.forEach((u) => u());
    this.placementUnsubs = [];
    this.state.crawlerPlacements = [];
    this.state.runtimeMobPlacements = [];
    this.prevNear = new Set();
    this.primedPlacements = false;
    if (!key) return; // episode not loaded yet; the episodes listener calls us again
    this.placementUnsubs = [
      onSnapshot(doc(db, `${this.path}/crawler-placements/${key}`), (s) => this.onCrawlerPlacements(s.exists() ? (s.data().placements || []) : []), (e) => warn(`[${this.name}]`, e.message)),
      onSnapshot(doc(db, `${this.path}/runtime-mob-placements/${key}`), (s) => { this.state.runtimeMobPlacements = s.exists() ? (s.data().placements || []) : []; }, (e) => warn(`[${this.name}]`, e.message)),
    ];
  }

  // ── scene helpers ──

  npcPlacements() {
    const mapId = this.currentMapId;
    const ep = this.state.episode;
    if (!ep || mapId === null) return [];
    const episodePlacements = (ep.mobPlacements || []).filter((p) => p.mapId === mapId || (!p.mapId && ep.mapIds?.[0] === mapId));
    const runtime = this.state.runtimeMobPlacements.filter((p) => p.mapId === mapId);
    const muted = new Set(this.settings.mutedMobIds || []);
    return [...episodePlacements, ...runtime]
      .map((p) => ({ ...p, mob: this.state.mobs.find((m) => m.id === p.mobId) }))
      .filter((p) => p.mob && hasPersonality(p.mob) && !muted.has(p.mobId));
  }

  crawlerPlacementsOnMap() {
    const mapId = this.currentMapId;
    return this.state.crawlerPlacements.filter((p) => p.mapId === mapId);
  }

  /** The NPC's placement closest to a point (NPCs can be placed more than once). */
  placementFor(mobId, near) {
    const places = this.npcPlacements().filter((p) => p.mobId === mobId);
    if (!places.length) return null;
    if (!near) return places[0];
    return places.reduce((best, p) => (distance(p, near) < distance(best, near) ? p : best));
  }

  nearPairs() {
    const pairs = [];
    for (const c of this.crawlerPlacementsOnMap()) {
      for (const n of this.npcPlacements()) {
        const d = distance(c, n);
        if (d <= CONFIG.nearDistance) pairs.push({ crawlerId: c.crawlerId, mobId: n.mobId, d, npc: n, crawler: c });
      }
    }
    return pairs;
  }

  scene(npcPlacement) {
    const crawlers = this.state.crawlers;
    const placements = this.crawlerPlacementsOnMap();
    const nearby = [];
    const farther = [];
    for (const p of placements) {
      const c = crawlers.find((x) => x.id === p.crawlerId);
      if (!c) continue;
      (npcPlacement && distance(p, npcPlacement) <= CONFIG.nearDistance ? nearby : farther).push(c);
    }
    const combat = this.state.combat;
    return {
      episodeName: this.state.episode?.name,
      episodeDescription: (this.state.episode?.description || '').slice(0, 200),
      timeOfDay: timeOfDay(this.state.clock?.gameTime),
      inCombat: !!combat?.active && combat.phase !== 'ended',
      nearby,
      farther,
    };
  }

  transcript() {
    const epId = this.showtime?.episodeId;
    return formatTranscript(
      this.state.chat.filter((m) => !m.episodeId || m.episodeId === epId).slice(-CONFIG.transcriptLines)
    );
  }

  // ── events ──

  onChat(snapshot) {
    const all = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    this.state.chat = all.slice(-50);
    if (!this.chatPrimed) { this.chatPrimed = true; return; } // ignore history from before we started
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added') continue;
      const m = { ...change.doc.data(), id: change.doc.id };
      if (m.authorType === 'npc') continue;
      if (m.episodeId && m.episodeId !== this.showtime?.episodeId) continue;
      if ((m.createdAt ?? 0) < Date.now() - 120_000) continue;
      this.lastActivityAt = Date.now();
      this.handlePlayerMessage(m);
    }
  }

  handlePlayerMessage(m) {
    const npcs = this.npcPlacements();
    if (!npcs.length) return;
    const uniqueMobs = [...new Map(npcs.map((n) => [n.mobId, n.mob])).values()];
    const named = uniqueMobs.filter((mob) => mentionsName(m.text, mob.name));
    const speakerSpot = m.authorType === 'crawler' ? this.crawlerPlacementsOnMap().find((p) => p.crawlerId === m.authorId) : null;
    const nearSpeaker = speakerSpot
      ? npcs.filter((n) => distance(n, speakerSpot) <= CONFIG.nearDistance).sort((a, b) => distance(a, speakerSpot) - distance(b, speakerSpot))
      : [];

    // Secret checks for NPCs being talked to or standing next to the speaker
    const involved = new Map([...named.map((mob) => [mob.id, mob]), ...nearSpeaker.map((n) => [n.mobId, n.mob])]);
    for (const mob of involved.values()) {
      const p = mob.personality || {};
      const state = this.secrets[mob.id]?.state ?? 'locked';
      if (p.secret && p.revealWhen && state === 'locked') this.enqueue({ kind: 'secret-check', mobId: mob.id, message: m });
    }

    if (m.authorType === 'crawler') {
      const talkedTo = named[0]?.id ?? nearSpeaker[0]?.mobId;
      if (talkedTo) this.lastNpcByCrawler.set(m.authorId, talkedTo);
    }

    if (named.length) {
      for (const mob of named.slice(0, 2)) {
        this.enqueue({ kind: 'line', mobId: mob.id, direct: true, near: speakerSpot, trigger: `${m.authorName} spoke to you: "${m.text}"` });
      }
    } else if (nearSpeaker.length) {
      const n = nearSpeaker[0];
      this.enqueue({ kind: 'line', mobId: n.mobId, gated: true, near: speakerSpot, trigger: `${m.authorName} said this right next to you: "${m.text}"` });
    }
  }

  onSecrets(data) {
    const prev = this.secrets;
    this.secrets = data;
    if (!this.secretsPrimed) { this.secretsPrimed = true; return; }
    // When the DM unlocks a secret, that NPC speaks up with it right away.
    for (const [mobId, entry] of Object.entries(data)) {
      if (entry?.state === 'unlocked' && prev[mobId]?.state !== 'unlocked') {
        this.lastActivityAt = Date.now();
        this.enqueue({ kind: 'line', mobId, direct: true, trigger: 'You have just decided to tell the party your secret. Tell them now.' });
      }
    }
  }

  onDiceRolls(snapshot) {
    if (!this.rollsPrimed) { this.rollsPrimed = true; return; }
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added') continue;
      const roll = change.doc.data();
      if (roll.statRoll?.stat !== 'Persuasion' || !roll.crawlerId) continue;
      if ((roll.timestamp ?? 0) < Date.now() - 120_000) continue;
      this.lastActivityAt = Date.now();
      this.handlePersuasion(roll);
    }
  }

  /** A Persuasion roll counts against the NPC next to the crawler, else the NPC they last talked with. */
  handlePersuasion(roll) {
    const npcs = this.npcPlacements();
    const spot = this.crawlerPlacementsOnMap().find((p) => p.crawlerId === roll.crawlerId);
    const nearest = spot
      ? npcs.filter((n) => distance(n, spot) <= CONFIG.nearDistance).sort((a, b) => distance(a, spot) - distance(b, spot))[0]
      : null;
    const mobId = nearest?.mobId ?? this.lastNpcByCrawler.get(roll.crawlerId);
    const target = npcs.find((n) => n.mobId === mobId);
    if (!target) return;
    const mob = target.mob;
    const p = mob.personality || {};
    const dc = Number(p.persuasionDC);
    const state = this.secrets[mob.id]?.state ?? 'locked';
    if (!p.secret || !dc || state !== 'locked') return;

    // One try per crawler per NPC each noncombat turn (or every 10 minutes when turns aren't running)
    const key = `${roll.crawlerId}:${mob.id}`;
    const turn = this.state.noncombatTurn?.turnNumber ?? null;
    const prev = this.persuadeTries.get(key);
    if (prev && (turn !== null ? prev.turn === turn : Date.now() - prev.at < 10 * 60_000)) return;
    this.persuadeTries.set(key, { turn, at: Date.now() });

    const name = roll.crawlerName || 'A crawler';
    const near = spot ?? undefined;
    if (roll.total >= dc) {
      log(`[${this.name}] ${name} persuaded ${mob.name} (${roll.total} vs DC ${dc}); asking the DM`);
      setDoc(doc(db, `${this.path}/npcAi/secrets`), {
        [mob.id]: { state: 'pending', reason: `${name} rolled Persuasion ${roll.total} vs DC ${dc}.`, at: Date.now() },
      }, { merge: true }).catch((e) => warn(`[${this.name}] secret write failed:`, e.message));
      this.enqueue({ kind: 'line', mobId: mob.id, direct: true, near, trigger: `${name} just made a very convincing case for you to tell them your secret. You are wavering but haven't given in yet.` });
    } else {
      log(`[${this.name}] ${name} failed to persuade ${mob.name} (${roll.total} vs DC ${dc})`);
      this.enqueue({ kind: 'line', mobId: mob.id, direct: true, near, trigger: `${name} just tried to talk you into telling your secret, but it didn't work on you. Brush them off.` });
    }
  }

  onCrawlerPlacements(placements) {
    this.state.crawlerPlacements = placements;
    const nowNear = new Set();
    for (const pair of this.nearPairs()) {
      const key = `${pair.crawlerId}:${pair.mobId}`;
      nowNear.add(key);
      if (this.prevNear.has(key) || !this.primedPlacements) continue;
      if (Date.now() - (this.lastGreet.get(key) ?? 0) < CONFIG.greetCooldownMs) continue;
      this.lastGreet.set(key, Date.now());
      this.lastActivityAt = Date.now();
      const crawler = this.state.crawlers.find((c) => c.id === pair.crawlerId);
      this.enqueue({ kind: 'line', mobId: pair.mobId, near: pair.crawler, trigger: `${crawler?.name ?? 'A crawler'} just walked up to you.` });
    }
    this.prevNear = nowNear;
    this.primedPlacements = true;
  }

  onCrawlers(list) {
    const prev = new Map(this.state.crawlers.map((c) => [c.id, c]));
    this.state.crawlers = list;
    if (!this.crawlersPrimed) { this.crawlersPrimed = true; return; }
    for (const c of list) {
      const before = prev.get(c.id);
      if (!before || !c.maxHP) continue;
      if (before.hp / c.maxHP >= 0.3 && c.hp / c.maxHP < 0.3) {
        this.lastActivityAt = Date.now();
        this.reactNear(c.id, `${c.name} was just ${hpWords(c.hp, c.maxHP)}.`);
      }
    }
  }

  onCombat(data) {
    const prev = this.state.combat;
    this.state.combat = data;
    if (!this.combatPrimed) { this.combatPrimed = true; return; }
    const activeNow = !!data?.active && data.phase !== 'ended';
    const activeBefore = !!prev?.active && prev.phase !== 'ended';
    if (activeNow && !activeBefore) {
      this.lastActivityAt = Date.now();
      const foes = (data.combatants || []).filter((c) => c.type === 'mob').map((c) => c.name);
      this.reactAll(`A fight just broke out${foes.length ? ` against ${[...new Set(foes)].join(', ')}` : ''}.`, true);
    }
    if (activeNow && prev?.combatants) {
      for (const c of data.combatants || []) {
        if (c.type !== 'mob') continue;
        const before = prev.combatants.find((x) => x.id === c.id);
        if (before && (before.currentHP ?? 1) > 0 && (c.currentHP ?? 1) <= 0) {
          this.lastActivityAt = Date.now();
          this.reactAll(`${c.name} was just killed.`, true);
        }
      }
    }
  }

  onLootBoxes(list) {
    const prev = new Map(this.state.lootBoxes.map((b) => [b.id, b]));
    this.state.lootBoxes = list;
    if (!this.lootPrimed) { this.lootPrimed = true; return; }
    for (const b of list) {
      const before = prev.get(b.id);
      if (before && before.locked && !b.locked && b.episodeId === this.showtime?.episodeId) {
        const crawler = this.state.crawlers.find((c) => c.id === b.crawlerId);
        this.lastActivityAt = Date.now();
        this.reactNear(b.crawlerId, `${crawler?.name ?? 'A crawler'} just opened a ${b.tier} loot box: ${b.name}.`);
      }
    }
  }

  /** NPCs standing near a crawler react to something that happened to them. */
  reactNear(crawlerId, trigger) {
    const spot = this.crawlerPlacementsOnMap().find((p) => p.crawlerId === crawlerId);
    if (!spot) return;
    const near = this.npcPlacements().filter((n) => distance(n, spot) <= CONFIG.nearDistance);
    if (near.length) this.enqueue({ kind: 'line', mobId: near[0].mobId, near: spot, trigger });
  }

  /** The NPC with crawlers closest to it reacts to a big event. */
  reactAll(trigger, gated) {
    const pairs = this.nearPairs().sort((a, b) => a.d - b.d);
    const pick = pairs[0]?.npc ?? this.npcPlacements()[0];
    if (pick) this.enqueue({ kind: 'line', mobId: pick.mobId, gated: gated && !pairs.length, near: pairs[0]?.crawler, trigger });
  }

  onTick() {
    if (!this.live) return;
    const now = Date.now();
    if (!this.unloaded && now - this.lastActivityAt > CONFIG.unloadAfterMs && !this.working) {
      this.unloaded = true;
      this.activeModel = null;
      unloadAll().catch(() => {});
      this.publishStatus();
      return;
    }
    const quietSince = Math.max(this.lastActivityAt, this.lastNpcLineAt, this.lastIdleMutterAt);
    if (now - quietSince < CONFIG.idleSilenceMs || this.queue.length || this.working) return;
    if (now - this.lastActivityAt > CONFIG.unloadAfterMs) return; // nobody around: stay asleep
    const pairs = this.nearPairs();
    if (!pairs.length) return;
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    this.lastIdleMutterAt = now;
    this.enqueue({ kind: 'line', mobId: pair.mobId, gated: true, near: pair.crawler, trigger: 'It has been quiet for a while. The crawlers are standing around near you.' });
  }

  // ── work queue ──

  enqueue(job) {
    if (!this.live || !this.enabled || this.settings.mutedAll) return;
    job.createdAt = Date.now();
    if (job.kind === 'line') {
      const existing = this.queue.findIndex((j) => j.kind === 'line' && j.mobId === job.mobId);
      if (existing >= 0) {
        if (job.direct || !this.queue[existing].direct) this.queue[existing] = job;
        return;
      }
    }
    if (job.kind === 'secret-check') this.queue.unshift(job); // cheap and decides whether to prompt the DM
    else this.queue.push(job);
    this.drain();
  }

  async drain() {
    if (this.working) return;
    this.working = true;
    try {
      while (this.queue.length && this.live) {
        const job = this.queue.shift();
        if (Date.now() - job.createdAt > CONFIG.jobMaxAgeMs) continue;
        try {
          if (job.kind === 'secret-check') await this.runSecretCheck(job);
          else await this.runLine(job);
        } catch (err) {
          warn(`[${this.name}] ${job.kind} failed:`, err.message);
          this.note = 'NPC voices hit an error; check the log on the DM computer';
          this.publishStatus();
        }
      }
    } finally {
      this.working = false;
    }
  }

  async pickModel() {
    const { model, note, busy } = await chooseModel(this.settings.model);
    const changed = model !== this.activeModel || note !== this.note || !!busy !== this.busy;
    this.activeModel = model;
    this.note = note || '';
    this.busy = !!busy;
    if (changed) this.publishStatus();
    if (model) this.unloaded = false;
    return model;
  }

  async runSecretCheck(job) {
    const mob = this.state.mobs.find((m) => m.id === job.mobId);
    const p = mob?.personality;
    if (!p?.secret || !p.revealWhen) return;
    if ((this.secrets[mob.id]?.state ?? 'locked') !== 'locked') return;
    const model = await this.pickModel();
    if (!model) return;
    const reply = await chat(model, null, buildSecretCheckPrompt({
      condition: p.revealWhen, speaker: job.message.authorName, text: job.message.text, transcript: this.transcript(),
    }), { maxTokens: 4, temperature: 0 });
    if (!isYes(reply)) return;
    log(`[${this.name}] Reveal condition met for ${mob.name}; asking the DM`);
    await setDoc(doc(db, `${this.path}/npcAi/secrets`), {
      [mob.id]: { state: 'pending', reason: `${job.message.authorName}: "${job.message.text.slice(0, 120)}"`, at: Date.now() },
    }, { merge: true });
  }

  async runLine(job) {
    const now = Date.now();
    const last = this.lastLineByNpc.get(job.mobId) ?? 0;
    if (!job.direct && now - last < CONFIG.npcCooldownMs) return;
    const gap = CONFIG.globalGapMs - (now - this.lastNpcLineAt);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));

    const placement = this.placementFor(job.mobId, job.near);
    if (!placement) return; // NPC left the map or was muted
    const mob = placement.mob;
    const model = await this.pickModel();
    if (!model) return;

    const transcript = this.transcript();
    if (job.gated) {
      const answer = await chat(model, null, buildShouldSpeakPrompt({ mob, transcript, trigger: job.trigger }), { maxTokens: 4, temperature: 0 });
      if (!isYes(answer)) return;
    }

    const mapId = this.currentMapId;
    await this.writeStatus({ thinking: { mobId: mob.id, mapId, x: placement.x, y: placement.y, since: Date.now() } });
    let line = '';
    try {
      const secretUnlocked = this.secrets[mob.id]?.state === 'unlocked';
      const system = buildSystemPrompt({ mob, secretUnlocked, scene: this.scene(placement) });
      line = cleanLine(await chat(model, system, buildLinePrompt({ mob, transcript, trigger: job.trigger })), mob.name);
    } finally {
      await this.writeStatus({ thinking: null });
    }
    if (!line || !this.live || !this.enabled || this.settings.mutedAll || (this.settings.mutedMobIds || []).includes(mob.id)) return;

    const id = `chat-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await setDoc(doc(db, `${this.path}/chatMessages/${id}`), {
      id,
      authorType: 'npc',
      authorId: mob.id,
      authorName: mob.name,
      text: line,
      createdAt: Date.now(),
      episodeId: this.showtime?.episodeId,
      mapId,
      x: placement.x,
      y: placement.y,
    });
    this.lastNpcLineAt = Date.now();
    this.lastLineByNpc.set(mob.id, Date.now());
    log(`[${this.name}] ${mob.name} (${model}): ${line}`);
  }

  // ── status for the app ──

  async writeStatus(fields) {
    try {
      await setDoc(doc(db, `${this.path}/npcAi/status`), fields, { merge: true });
    } catch (err) {
      warn(`[${this.name}] status write failed:`, err.message);
    }
  }

  publishStatus() {
    if (!this.live) return;
    this.writeStatus({
      heartbeatAt: Date.now(),
      activeModel: this.unloaded ? null : this.activeModel,
      note: this.enabled ? this.note : '',
      busy: this.busy,
    });
  }
}

// ── campaigns ────────────────────────────────────────────────────────────────

const rooms = new Map();
function onRoomsChanged() {
  setKeepAwake([...rooms.values()].some((r) => r.live));
}

async function main() {
  if (args.includes('--setup')) return runSetup();

  const { NPC_EMAIL: email, NPC_PASSWORD: password } = env;
  const dmUsername = env.NPC_DM_USERNAME;
  if (!email || !password || !dmUsername) {
    console.error('Not set up yet. Run: node scripts/npc-voices/index.mjs --setup --dm <your in-game username>');
    process.exit(1);
  }
  await signInWithEmailAndPassword(auth, email, password);
  log(`Signed in as NPC voices (${auth.currentUser.uid})`);

  const profiles = await getDocs(query(collection(db, 'userProfiles'), where('username', '==', dmUsername)));
  if (profiles.empty) {
    console.error(`No user with the username "${dmUsername}". Check NPC_DM_USERNAME in .env.npc.`);
    process.exit(1);
  }
  const dmUid = profiles.docs[0].id;
  log(`Serving campaigns run by ${dmUsername}`);

  const ollamaUp = await loadedModels();
  log(ollamaUp === null ? `Warning: Ollama isn't answering at ${CONFIG.ollamaUrl}` : `Ollama is running at ${CONFIG.ollamaUrl}`);

  onSnapshot(query(collection(db, 'campaigns'), where('ownerId', '==', dmUid)), (snap) => {
    const ids = new Set(snap.docs.map((d) => d.id));
    for (const d of snap.docs) {
      if (!rooms.has(d.id)) {
        rooms.set(d.id, new Room(d.id, d.data().name || d.id));
        log(`Watching campaign "${d.data().name || d.id}"`);
      }
    }
    for (const [id, room] of rooms) {
      if (!ids.has(id)) { room.dispose(); rooms.delete(id); }
    }
    onRoomsChanged();
  }, (e) => warn('campaigns listener', e.message));

  const shutdown = async () => {
    log('Shutting down');
    for (const room of rooms.values()) room.stop();
    setKeepAwake(false);
    await unloadAll().catch(() => {});
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (err) => warn('Unhandled error:', err?.message ?? err));

main().catch((err) => {
  console.error('NPC voices failed to start:', err.message);
  process.exit(1);
});
