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
  initializeFirestore, collection, onSnapshot, query, where, getDocs, connectFirestoreEmulator,
} from 'firebase/firestore';
import { NpcRoom, DEFAULT_NPC_CONFIG } from '../../src/lib/npc/engine.mjs';

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
  // The 4B instruct model was the quickest on the DM laptop (about 0.3 s a line, all on the GPU); qwen3:14b no longer fits in its free memory
  models: { quality: env.NPC_MODEL_QUALITY || 'qwen3:8b', fast: env.NPC_MODEL_FAST || 'qwen3:4b-instruct-2507-q4_K_M' },
  // Free RAM needed before loading each model (GB). Bigger models split across GPU and RAM.
  minFreeGB: { quality: num(env.NPC_QUALITY_MIN_FREE_GB, 4), fast: num(env.NPC_FAST_MIN_FREE_GB, 2.5) },
};

// Timers shared with the online brain (src/lib/npc/engine.mjs); env overrides for testing
const ENGINE_CONFIG = {
  ...DEFAULT_NPC_CONFIG,
  nearDistance: num(env.NPC_NEAR_DISTANCE, DEFAULT_NPC_CONFIG.nearDistance),        // map-% units
  npcCooldownMs: num(env.NPC_COOLDOWN_SECONDS, DEFAULT_NPC_CONFIG.npcCooldownMs / 1000) * 1000,
  globalGapMs: num(env.NPC_GLOBAL_GAP_SECONDS, DEFAULT_NPC_CONFIG.globalGapMs / 1000) * 1000,
  idleSilenceMs: num(env.NPC_IDLE_SECONDS, DEFAULT_NPC_CONFIG.idleSilenceMs / 1000) * 1000,
  unloadAfterMs: num(env.NPC_UNLOAD_MINUTES, DEFAULT_NPC_CONFIG.unloadAfterMs / 60_000) * 60_000,
  memoryQuietMs: num(env.NPC_MEMORY_QUIET_SECONDS, DEFAULT_NPC_CONFIG.memoryQuietMs / 1000) * 1000,
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

async function chat(model, system, user, { maxTokens = 80, temperature = 0.8, json = false } = {}) {
  const res = await ollama('/api/chat', {
    model,
    stream: false,
    ...(json ? { format: 'json' } : {}),
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

/** The engine's model adapter for Ollama on this computer. */
const ollamaLlm = {
  chosen: null,
  async prepare(tier) {
    const { model, note, busy } = await chooseModel(tier);
    this.chosen = model;
    return { label: model, note, busy };
  },
  async generate({ system, user, maxTokens, temperature, json }) {
    const model = this.chosen || CONFIG.models.fast;
    try {
      return { text: await chat(model, system, user, { maxTokens, temperature, json }), label: model };
    } catch (err) {
      // The bigger model can fail to load when memory is tight: answer with the fast one instead
      if (model === CONFIG.models.fast) throw err;
      warn(`${model} failed (${err.message}); using ${CONFIG.models.fast}`);
      this.chosen = CONFIG.models.fast;
      return { text: await chat(this.chosen, system, user, { maxTokens, temperature, json }), label: this.chosen };
    }
  },
  idle: () => unloadAll(),
};

/** The laptop brain is the local model only: online models run in the DM's browser. */
const laptopLlm = () => ollamaLlm;

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
        rooms.set(d.id, new NpcRoom({
          db, roomId: d.id, name: d.data().name || d.id, role: 'laptop', llm: laptopLlm(),
          config: ENGINE_CONFIG, log, warn, onLiveChange: onRoomsChanged,
        }));
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
    for (const room of rooms.values()) room.dispose();
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
