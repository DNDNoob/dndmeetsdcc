// Spoken voices: online voice services tried in order (Gemini → Groq → ElevenLabs), with Kokoro in
// this browser as the last resort. A service that's out of free use rests until it can be tried again.
import { useSyncExternalStore } from 'react';
import type { NpcSpeechVoice } from '@/lib/gameData';
import type { NpcOnlineKeys } from '@/lib/npc/onlineLlm.mjs';
import { speechEngine } from './engine';
import { applyCreatureSound, hasCreatureSound } from './effects';
import {
  GEMINI_VOICES, GROQ_VOICES, VOICE_ENGINES, fitVoice, kokoroVoice,
  type CatalogVoice, type VoiceEngine, type VoiceTraits,
} from './voices';

// Model names change often: update them here when a service retires one. Each is tried in turn.
const GEMINI_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const GROQ_MODEL = 'canopylabs/orpheus-v1-english';
const GROQ_MAX_CHARS = 200;
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export interface SpokenClip {
  blob: Blob;
  ext: 'wav' | 'mp3';
  engine: VoiceEngine;
}

export interface SpeakRequest {
  text: string;
  traits: VoiceTraits;
  pick?: NpcSpeechVoice;
}

// ── Which services are resting, for the settings screen ──

interface EngineState { restUntil: number; why: string; key?: string }
const rest: Partial<Record<VoiceEngine, EngineState>> = {};
let lastEngine: VoiceEngine | null = null;
let problem: string | null = null;
let snapshot = { rest: { ...rest }, lastEngine, problem };
const listeners = new Set<() => void>();
const changed = () => {
  snapshot = { rest: { ...rest }, lastEngine, problem };
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Why the last line wasn't read aloud for the players (or null once one works again). */
export const reportVoiceProblem = (why: string | null) => {
  if (why === problem) return;
  problem = why;
  changed();
};

/** Which service read the last line, which ones are resting and why, and the last problem. */
export const useVoiceServiceState = () => useSyncExternalStore(subscribe, () => snapshot);

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const keyFor = (engine: VoiceEngine, keys: NpcOnlineKeys) =>
  engine === 'kokoro' ? 'local' : (keys[engine] ?? '').trim();

/** Is this service resting? A new key gets tried straight away. */
const resting = (engine: VoiceEngine, keys: NpcOnlineKeys) => {
  const r = rest[engine];
  return !!r && r.restUntil > Date.now() && r.key === keyFor(engine, keys);
};

const restFor = (engine: VoiceEngine, keys: NpcOnlineKeys, ms: number, why: string) => {
  rest[engine] = { restUntil: Date.now() + ms, why: `${why}, back at ${clockTime(Date.now() + ms)}`, key: keyFor(engine, keys) };
  console.warn(`[NpcSpeech] ${why}`);
  changed();
};

/** The services that would be tried right now, in order. */
export const voiceEnginesInOrder = (keys: NpcOnlineKeys): VoiceEngine[] =>
  VOICE_ENGINES.map(e => e.id).filter(id => id === 'kokoro' || keyFor(id, keys)).filter(id => !resting(id, keys));

class Rested extends Error {}

/** Rest a service after a failed request, for as long as the failure suggests, and move on. */
async function failed(engine: VoiceEngine, keys: NpcOnlineKeys, res: Response): Promise<never> {
  const name = VOICE_ENGINES.find(e => e.id === engine)!.name;
  const body = (await res.text().catch(() => '')).slice(0, 600);
  const quota = /quota|limit|exhaust/i.test(body);
  if (res.status === 429 || (engine === 'elevenlabs' && quota)) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const delay = /"retryDelay":\s*"(\d+)/.exec(body)?.[1];
    const daily = /per ?day|PerDay|daily|monthly|quota_exceeded/i.test(body);
    const ms = daily ? 3 * HOUR
      : retryAfter > 0 ? retryAfter * 1000
        : delay ? Number(delay) * 1000 + 1000
          : 2 * MINUTE;
    restFor(engine, keys, ms, `${name} voices used up for now`);
  } else if (res.status === 401 || res.status === 403) {
    restFor(engine, keys, HOUR, `${name} key was rejected for voices`);
  } else {
    restFor(engine, keys, MINUTE, `${name} voice error ${res.status}`);
  }
  console.warn(`[NpcSpeech] ${name} ${res.status}: ${body}`);
  throw new Rested();
}

// ── Audio helpers ──

const pcmToWav = (pcm: Uint8Array, rate: number): Blob => {
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) header.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); header.setUint32(4, 36 + pcm.length, true); text(8, 'WAVE');
  text(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
  header.setUint32(24, rate, true); header.setUint32(28, rate * 2, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true);
  text(36, 'data'); header.setUint32(40, pcm.length, true);
  return new Blob([header.buffer, pcm], { type: 'audio/wav' });
};

/** The PCM samples and rate of a 16-bit mono WAV. */
const readWav = (buf: ArrayBuffer): { pcm: Uint8Array; rate: number } => {
  const v = new DataView(buf);
  let rate = 24000;
  let at = 12;
  while (at + 8 <= buf.byteLength) {
    const id = String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
    const size = v.getUint32(at + 4, true);
    if (id === 'fmt ') rate = v.getUint32(at + 12, true);
    if (id === 'data') return { pcm: new Uint8Array(buf, at + 8, Math.min(size, buf.byteLength - at - 8)), rate };
    at += 8 + size + (size % 2);
  }
  return { pcm: new Uint8Array(0), rate };
};

const base64ToBytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/** Split text into pieces of at most `max` characters, at sentence ends where possible. */
const chunks = (text: string, max: number): string[] => {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf(', '));
    const at = cut > max / 3 ? cut + 1 : slice.lastIndexOf(' ') > 0 ? slice.lastIndexOf(' ') : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
};

const pace = (speed: number) => (speed <= 0.92 ? 'slow' : speed >= 1.08 ? 'fast' : '');
// Gemini's delivery tags for each mood picked from the NPC's notes
const GEMINI_TAGS: Record<string, string> = {
  whisper: 'whispers', angry: 'anger', sad: 'negative', nervous: 'nervousness',
  cheerful: 'enthusiasm', gruff: 'annoyance', sly: 'amusement',
};

// ── The services ──

let geminiModel = 0; // index of the first model name that works

async function gemini(req: SpeakRequest, key: string, keys: NpcOnlineKeys): Promise<SpokenClip> {
  const voice = req.pick?.gemini && GEMINI_VOICES.some(v => v.id === req.pick!.gemini)
    ? req.pick.gemini : fitVoice(GEMINI_VOICES, req.traits)!.id;
  // Only the line itself, led by one bracketed tag (Gemini's inline delivery tags are never spoken).
  // Written directions, even short ones, sometimes get read out.
  const tag = GEMINI_TAGS[moodOf(req.traits.manner)] ?? pace(req.traits.speed);
  const prompt = tag ? `[${tag}] ${req.text}` : req.text;
  while (geminiModel < GEMINI_MODELS.length) {
    const model = GEMINI_MODELS[geminiModel];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (res.status === 404) { geminiModel++; continue; } // retired model name: try the next one
    if (!res.ok) return failed('gemini', keys, res);
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)?.inlineData;
    if (!part?.data) throw new Error('Gemini returned no audio');
    const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? '')?.[1]) || 24000;
    return { blob: pcmToWav(base64ToBytes(part.data), rate), ext: 'wav', engine: 'gemini' };
  }
  geminiModel = 0;
  restFor('gemini', keys, HOUR, 'No Gemini voice model is available');
  throw new Rested();
}

// One- or two-word directions Orpheus understands, picked from the NPC's notes
const GROQ_DIRECTIONS: [RegExp, string][] = [
  [/whisper/, 'whisper'], [/angry|furious|hostile|rage/, 'angry'], [/sad|gloomy|melanchol/, 'sad'],
  [/nervous|scared|afraid|timid|jittery/, 'nervous'], [/cheer|jolly|friendly|warm/, 'cheerful'],
  [/gruff|growl|grumpy/, 'gruff'], [/sly|sneaky|cunning/, 'sly'],
];

const moodOf = (manner: string) => GROQ_DIRECTIONS.find(([re]) => re.test(manner.toLowerCase()))?.[1] ?? '';

async function groq(req: SpeakRequest, key: string, keys: NpcOnlineKeys): Promise<SpokenClip> {
  const voice = req.pick?.groq && GROQ_VOICES.some(v => v.id === req.pick!.groq) ? req.pick.groq : fitVoice(GROQ_VOICES, req.traits)!.id;
  const direction = moodOf(req.traits.manner);
  const prefix = direction ? `[${direction}] ` : '';
  const parts: Uint8Array[] = [];
  let rate = 24000;
  for (const piece of chunks(req.text, GROQ_MAX_CHARS - prefix.length)) {
    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: GROQ_MODEL, voice, input: prefix + piece, response_format: 'wav' }),
    });
    if (!res.ok) return failed('groq', keys, res);
    const wav = readWav(await res.arrayBuffer());
    rate = wav.rate;
    parts.push(wav.pcm);
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => { all.set(p, at); return at + p.length; }, 0);
  return { blob: pcmToWav(all, rate), ext: 'wav', engine: 'groq' };
}

// ElevenLabs voices differ by account, so they're read from the account the first time
let elevenVoices: { key: string; list: Promise<CatalogVoice[]> } | null = null;

export function elevenLabsVoices(key: string): Promise<CatalogVoice[]> {
  if (elevenVoices?.key === key) return elevenVoices.list;
  const list = fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
    .then(r => (r.ok ? r.json() : { voices: [] }))
    .then((data: { voices?: { voice_id: string; name: string; labels?: Record<string, string> }[] }) =>
      (data.voices ?? []).map((v): CatalogVoice => {
        const l = v.labels ?? {};
        const desc = `${l.description ?? ''} ${l.age ?? ''} ${l.descriptive ?? ''}`.toLowerCase();
        return {
          id: v.voice_id,
          name: v.name.split(/\s+-\s+/)[0],
          gender: /female|woman/i.test(l.gender ?? '') ? 'woman' : 'man',
          accent: /british|english/i.test(l.accent ?? '') ? 'British' : /american/i.test(l.accent ?? '') ? 'American' : l.accent,
          note: [l.age, l.description ?? l.descriptive].filter(Boolean).join(', ') || undefined,
          deep: /deep|old|gravel|raspy|gruff|mature|husky/.test(desc),
          bright: /young|child|bright|upbeat|energetic|cheerful|playful/.test(desc),
        };
      }))
    .catch(() => []);
  elevenVoices = { key, list };
  return list;
}

async function elevenlabs(req: SpeakRequest, key: string, keys: NpcOnlineKeys): Promise<SpokenClip> {
  const voices = await elevenLabsVoices(key);
  const voice = req.pick?.elevenlabs || fitVoice(voices, req.traits)?.id;
  if (!voice) {
    restFor('elevenlabs', keys, HOUR, "Couldn't load ElevenLabs voices");
    throw new Rested();
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({
      text: req.text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, req.traits.speed)) },
    }),
  });
  if (!res.ok) return failed('elevenlabs', keys, res);
  return { blob: new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' }), ext: 'mp3', engine: 'elevenlabs' };
}

async function kokoro(req: SpeakRequest): Promise<SpokenClip> {
  const blob = await speechEngine.speak(req.text, kokoroVoice(req.traits, req.pick), req.traits.speed);
  return { blob, ext: 'wav', engine: 'kokoro' };
}

/** Read a line aloud with the first service that works, with the NPC's creature sound on it. Throws only if Kokoro fails too. */
export async function speakLine(req: SpeakRequest, keys: NpcOnlineKeys): Promise<SpokenClip> {
  const clip = await speakPlain(req, keys);
  if (!hasCreatureSound(req.traits.sound)) return clip;
  try {
    return { ...clip, blob: await applyCreatureSound(clip.blob, req.traits.sound!), ext: 'wav' };
  } catch (err) {
    console.warn('[NpcSpeech] Creature sound failed, using the plain voice', err);
    return clip;
  }
}

async function speakPlain(req: SpeakRequest, keys: NpcOnlineKeys): Promise<SpokenClip> {
  // An NPC given an ElevenLabs character voice is read by ElevenLabs while it has use left
  const order = voiceEnginesInOrder(keys);
  if (req.pick?.elevenlabs && order.includes('elevenlabs')) order.sort((a, b) => Number(b === 'elevenlabs') - Number(a === 'elevenlabs'));
  for (const engine of order) {
    try {
      const key = keyFor(engine, keys);
      const clip = engine === 'gemini' ? await gemini(req, key, keys)
        : engine === 'groq' ? await groq(req, key, keys)
          : engine === 'elevenlabs' ? await elevenlabs(req, key, keys)
            : await kokoro(req);
      if (rest[engine] || lastEngine !== engine) { delete rest[engine]; lastEngine = engine; changed(); }
      return clip;
    } catch (err) {
      if (err instanceof Rested) continue;
      if (engine === 'kokoro') throw err;
      // Network trouble or an odd reply: give that service a minute off and move on
      restFor(engine, keys, MINUTE, `${VOICE_ENGINES.find(e => e.id === engine)!.name} voice failed (${(err as Error).message})`);
    }
  }
  throw new Error('No voice service could read the line');
}
