// Spoken NPC voices: the Kokoro voices an NPC can use, and how one is picked from its notes
import { baseMobId, type Mob, type NpcSpeechVoice } from '@/lib/gameData';

export interface KokoroVoice {
  id: string;
  name: string;
  gender: 'man' | 'woman';
  accent: 'American' | 'British';
  good?: boolean; // the clearer voices, used when picking one automatically
}

export const KOKORO_VOICES: KokoroVoice[] = [
  { id: 'af_heart', name: 'Heart', gender: 'woman', accent: 'American', good: true },
  { id: 'af_bella', name: 'Bella', gender: 'woman', accent: 'American', good: true },
  { id: 'af_nicole', name: 'Nicole', gender: 'woman', accent: 'American', good: true },
  { id: 'af_aoede', name: 'Aoede', gender: 'woman', accent: 'American', good: true },
  { id: 'af_kore', name: 'Kore', gender: 'woman', accent: 'American', good: true },
  { id: 'af_sarah', name: 'Sarah', gender: 'woman', accent: 'American', good: true },
  { id: 'af_nova', name: 'Nova', gender: 'woman', accent: 'American' },
  { id: 'af_alloy', name: 'Alloy', gender: 'woman', accent: 'American' },
  { id: 'af_sky', name: 'Sky', gender: 'woman', accent: 'American' },
  { id: 'af_jessica', name: 'Jessica', gender: 'woman', accent: 'American' },
  { id: 'af_river', name: 'River', gender: 'woman', accent: 'American' },
  { id: 'am_michael', name: 'Michael', gender: 'man', accent: 'American', good: true },
  { id: 'am_fenrir', name: 'Fenrir', gender: 'man', accent: 'American', good: true },
  { id: 'am_puck', name: 'Puck', gender: 'man', accent: 'American', good: true },
  { id: 'am_onyx', name: 'Onyx', gender: 'man', accent: 'American' },
  { id: 'am_echo', name: 'Echo', gender: 'man', accent: 'American' },
  { id: 'am_eric', name: 'Eric', gender: 'man', accent: 'American' },
  { id: 'am_liam', name: 'Liam', gender: 'man', accent: 'American' },
  { id: 'am_santa', name: 'Santa', gender: 'man', accent: 'American' },
  { id: 'am_adam', name: 'Adam', gender: 'man', accent: 'American' },
  { id: 'bf_emma', name: 'Emma', gender: 'woman', accent: 'British', good: true },
  { id: 'bf_isabella', name: 'Isabella', gender: 'woman', accent: 'British', good: true },
  { id: 'bf_alice', name: 'Alice', gender: 'woman', accent: 'British' },
  { id: 'bf_lily', name: 'Lily', gender: 'woman', accent: 'British' },
  { id: 'bm_george', name: 'George', gender: 'man', accent: 'British', good: true },
  { id: 'bm_fable', name: 'Fable', gender: 'man', accent: 'British', good: true },
  { id: 'bm_lewis', name: 'Lewis', gender: 'man', accent: 'British' },
  { id: 'bm_daniel', name: 'Daniel', gender: 'man', accent: 'British' },
];

export const voiceLabel = (v: KokoroVoice) => `${v.name} (${v.accent} ${v.gender})`;

export const NPC_SPEED_MIN = 0.7;
export const NPC_SPEED_MAX = 1.4;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const has = (text: string, words: string[]) => words.some(w => new RegExp(`\\b${w}\\b`).test(text));

const WOMAN = ['she', 'her', 'woman', 'lady', 'girl', 'queen', 'mother', 'grandmother', 'granny', 'witch', 'priestess', 'female', 'matron', 'wife', 'daughter', 'sister', 'madam', 'dame', 'princess', 'duchess', 'hag', 'crone', 'sorceress', 'barmaid', 'maiden'];
const MAN = ['he', 'his', 'him', 'man', 'king', 'father', 'grandfather', 'boy', 'male', 'lord', 'sir', 'husband', 'son', 'brother', 'prince', 'duke', 'monk', 'priest', 'wizard', 'barkeep', 'guy', 'dude', 'bro'];
const BRITISH = ['posh', 'british', 'english', 'noble', 'lord', 'lady', 'royal', 'aristocrat', 'butler', 'proper', 'elf', 'elven', 'wizard', 'scholar', 'refined', 'queen', 'king', 'duke', 'duchess', 'prince', 'princess', 'cockney'];
const DEEP = ['gruff', 'deep', 'growl', 'growls', 'rumbling', 'booming', 'orc', 'ogre', 'giant', 'troll', 'brute', 'menacing', 'gravelly', 'old', 'ancient', 'elderly', 'slow', 'dwarf', 'dwarven'];
const QUICK = ['squeaky', 'goblin', 'kobold', 'nervous', 'excited', 'excitable', 'jittery', 'manic', 'child', 'young', 'pixie', 'gnome', 'fast', 'chatty', 'rambling', 'hyper', 'frantic', 'twitchy'];

/** A voice chosen from the NPC's "Voice and manner" notes, its name and description. Same NPC, same voice. */
type VoiceMob = Pick<Mob, 'id' | 'name'> & Partial<Pick<Mob, 'description' | 'personality'>>;

export function autoVoice(mob: VoiceMob): NpcSpeechVoice {
  const text = [mob.personality?.voice, mob.name, mob.description, mob.personality?.attitude]
    .filter(Boolean).join(' ').toLowerCase();
  const seed = hash(baseMobId(mob.id));
  const woman = has(text, WOMAN);
  const man = has(text, MAN);
  const gender: KokoroVoice['gender'] = woman && !man ? 'woman' : man && !woman ? 'man' : seed % 2 ? 'woman' : 'man';
  const british = has(text, BRITISH) || (!has(text, ['american']) && seed % 3 === 0);
  const deep = has(text, DEEP);
  const quick = has(text, QUICK);

  let pool = KOKORO_VOICES.filter(v => v.good && v.gender === gender && v.accent === (british ? 'British' : 'American'));
  if (deep && gender === 'man') pool = KOKORO_VOICES.filter(v => ['am_onyx', 'am_fenrir', 'bm_george'].includes(v.id));
  if (has(text, ['jolly', 'santa'])) pool = KOKORO_VOICES.filter(v => v.id === 'am_santa');
  const voice = pool[seed % pool.length] ?? KOKORO_VOICES[0];
  const speed = deep && !quick ? 0.88 : quick && !deep ? 1.15 : 1;
  return { voice: voice.id, speed };
}

/**
 * The voice a speaker talks with: the DM's pick for its creature (or character), else one chosen
 * from its notes. Creature copies ("Goblin B") share the voice at slightly different speeds.
 */
export function speakerVoice(
  speakerId: string,
  mob: VoiceMob | undefined,
  picks: Record<string, NpcSpeechVoice> | undefined,
): NpcSpeechVoice {
  const base = baseMobId(speakerId);
  const chosen = picks?.[base];
  const auto = autoVoice(mob ?? { id: base, name: speakerId });
  const voice = chosen?.voice && KOKORO_VOICES.some(v => v.id === chosen.voice) ? chosen.voice : auto.voice;
  const speed = chosen?.speed ?? auto.speed;
  // Copy letter A, B, C… nudges the speed a little so a room of goblins doesn't sound identical
  const copy = speakerId.length > base.length ? hash(speakerId) % 5 : 2;
  const nudged = speed * (1 + (copy - 2) * 0.04);
  return { voice, speed: Math.min(NPC_SPEED_MAX, Math.max(NPC_SPEED_MIN, Math.round(nudged * 100) / 100)) };
}
