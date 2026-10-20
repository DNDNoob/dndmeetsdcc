// Spoken NPC voices: the voices each voice service offers, and how one is picked from an NPC's notes
import { baseMobId, type Mob, type NpcSpeechVoice } from '@/lib/gameData';

/** Where a line is read aloud, tried in this order: online services first, Kokoro in this browser last. */
export type VoiceEngine = 'gemini' | 'groq' | 'elevenlabs' | 'kokoro';
export const VOICE_ENGINES: { id: VoiceEngine; name: string }[] = [
  { id: 'gemini', name: 'Gemini' },
  { id: 'groq', name: 'Groq' },
  { id: 'elevenlabs', name: 'ElevenLabs' },
  { id: 'kokoro', name: 'Kokoro' },
];
export const engineName = (id: VoiceEngine) => VOICE_ENGINES.find(e => e.id === id)?.name ?? id;

export interface CatalogVoice {
  id: string;
  name: string;
  gender: 'man' | 'woman';
  accent?: string;      // e.g. American, British
  note?: string;        // how it sounds, e.g. "Gravelly"
  deep?: boolean;       // suits gruff, old or big speakers
  bright?: boolean;     // suits quick, young or small speakers
  good?: boolean;       // Kokoro: the clearer voices, used when picking automatically
}

export const KOKORO_VOICES: CatalogVoice[] = [
  { id: 'af_heart', name: 'Heart', gender: 'woman', accent: 'American', good: true },
  { id: 'af_bella', name: 'Bella', gender: 'woman', accent: 'American', good: true, bright: true },
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
  { id: 'am_fenrir', name: 'Fenrir', gender: 'man', accent: 'American', good: true, deep: true },
  { id: 'am_puck', name: 'Puck', gender: 'man', accent: 'American', good: true, bright: true },
  { id: 'am_onyx', name: 'Onyx', gender: 'man', accent: 'American', deep: true },
  { id: 'am_echo', name: 'Echo', gender: 'man', accent: 'American' },
  { id: 'am_eric', name: 'Eric', gender: 'man', accent: 'American' },
  { id: 'am_liam', name: 'Liam', gender: 'man', accent: 'American' },
  { id: 'am_santa', name: 'Santa', gender: 'man', accent: 'American' },
  { id: 'am_adam', name: 'Adam', gender: 'man', accent: 'American' },
  { id: 'bf_emma', name: 'Emma', gender: 'woman', accent: 'British', good: true },
  { id: 'bf_isabella', name: 'Isabella', gender: 'woman', accent: 'British', good: true },
  { id: 'bf_alice', name: 'Alice', gender: 'woman', accent: 'British' },
  { id: 'bf_lily', name: 'Lily', gender: 'woman', accent: 'British' },
  { id: 'bm_george', name: 'George', gender: 'man', accent: 'British', good: true, deep: true },
  { id: 'bm_fable', name: 'Fable', gender: 'man', accent: 'British', good: true },
  { id: 'bm_lewis', name: 'Lewis', gender: 'man', accent: 'British' },
  { id: 'bm_daniel', name: 'Daniel', gender: 'man', accent: 'British' },
];

// Gemini's prebuilt voices. Accent and manner come from the line's instructions, not the voice.
export const GEMINI_VOICES: CatalogVoice[] = [
  { id: 'Algenib', name: 'Algenib', gender: 'man', note: 'Gravelly', deep: true },
  { id: 'Charon', name: 'Charon', gender: 'man', note: 'Informative', deep: true },
  { id: 'Orus', name: 'Orus', gender: 'man', note: 'Firm', deep: true },
  { id: 'Alnilam', name: 'Alnilam', gender: 'man', note: 'Firm' },
  { id: 'Rasalgethi', name: 'Rasalgethi', gender: 'man', note: 'Informative' },
  { id: 'Iapetus', name: 'Iapetus', gender: 'man', note: 'Clear' },
  { id: 'Algieba', name: 'Algieba', gender: 'man', note: 'Smooth' },
  { id: 'Enceladus', name: 'Enceladus', gender: 'man', note: 'Breathy' },
  { id: 'Umbriel', name: 'Umbriel', gender: 'man', note: 'Easy-going' },
  { id: 'Schedar', name: 'Schedar', gender: 'man', note: 'Even' },
  { id: 'Sadaltager', name: 'Sadaltager', gender: 'man', note: 'Knowledgeable' },
  { id: 'Achird', name: 'Achird', gender: 'man', note: 'Friendly' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', gender: 'man', note: 'Casual' },
  { id: 'Puck', name: 'Puck', gender: 'man', note: 'Upbeat', bright: true },
  { id: 'Fenrir', name: 'Fenrir', gender: 'man', note: 'Excitable', bright: true },
  { id: 'Sadachbia', name: 'Sadachbia', gender: 'man', note: 'Lively', bright: true },
  { id: 'Gacrux', name: 'Gacrux', gender: 'woman', note: 'Mature', deep: true },
  { id: 'Kore', name: 'Kore', gender: 'woman', note: 'Firm' },
  { id: 'Sulafat', name: 'Sulafat', gender: 'woman', note: 'Warm' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', gender: 'woman', note: 'Gentle' },
  { id: 'Achernar', name: 'Achernar', gender: 'woman', note: 'Soft' },
  { id: 'Despina', name: 'Despina', gender: 'woman', note: 'Smooth' },
  { id: 'Erinome', name: 'Erinome', gender: 'woman', note: 'Clear' },
  { id: 'Callirrhoe', name: 'Callirrhoe', gender: 'woman', note: 'Easy-going' },
  { id: 'Autonoe', name: 'Autonoe', gender: 'woman', note: 'Bright' },
  { id: 'Pulcherrima', name: 'Pulcherrima', gender: 'woman', note: 'Forward' },
  { id: 'Aoede', name: 'Aoede', gender: 'woman', note: 'Breezy' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'woman', note: 'Bright', bright: true },
  { id: 'Leda', name: 'Leda', gender: 'woman', note: 'Youthful', bright: true },
  { id: 'Laomedeia', name: 'Laomedeia', gender: 'woman', note: 'Upbeat', bright: true },
];

export const GROQ_VOICES: CatalogVoice[] = [
  { id: 'troy', name: 'Troy', gender: 'man', deep: true },
  { id: 'daniel', name: 'Daniel', gender: 'man' },
  { id: 'austin', name: 'Austin', gender: 'man', bright: true },
  { id: 'diana', name: 'Diana', gender: 'woman' },
  { id: 'hannah', name: 'Hannah', gender: 'woman' },
  { id: 'autumn', name: 'Autumn', gender: 'woman', bright: true },
];

export const voiceLabel = (v: CatalogVoice) =>
  `${v.name} (${[v.accent, v.note, v.gender].filter(Boolean).join(' ')})`;

/** Creature sounds: an effect put on any voice so a goblin squeaks and a dragon rumbles. */
export interface CreatureSound { id: string; name: string; words: string[] }
export const CREATURE_SOUNDS: CreatureSound[] = [
  { id: 'goblin', name: 'Goblin', words: ['goblin', 'goblins', 'kobold', 'imp', 'gremlin', 'gnome', 'hobgoblin'] },
  { id: 'tiny', name: 'Tiny', words: ['pixie', 'fairy', 'faerie', 'sprite', 'mouse', 'squirrel', 'chipmunk', 'hamster', 'cartoon', 'cartoonish'] },
  { id: 'giant', name: 'Giant', words: ['giant', 'ogre', 'troll', 'golem', 'titan', 'colossal', 'cyclops'] },
  { id: 'dragon', name: 'Dragon', words: ['dragon', 'dragons', 'wyrm', 'drake', 'wyvern', 'demon', 'devil', 'hydra'] },
  { id: 'ghost', name: 'Ghost', words: ['ghost', 'ghostly', 'spirit', 'wraith', 'specter', 'spectre', 'phantom', 'banshee', 'spectral', 'lich'] },
];
export const creatureSoundName = (id?: string) => CREATURE_SOUNDS.find(c => c.id === id)?.name ?? 'None';

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

type VoiceMob = Pick<Mob, 'id' | 'name'> & Partial<Pick<Mob, 'description' | 'personality'>>;

/** What an NPC should sound like, worked out from its notes. Same NPC, same result. */
export interface VoiceTraits {
  gender: 'man' | 'woman';
  british: boolean;
  deep: boolean;
  quick: boolean;
  seed: number;
  speed: number;
  /** How to say it, for services that take directions (Gemini, Groq) */
  manner: string;
  /** Creature sound effect put on the clip, if any */
  sound?: string;
}

export function voiceTraits(speakerId: string, mob: VoiceMob | undefined, pick?: NpcSpeechVoice): VoiceTraits {
  const base = baseMobId(speakerId);
  const m = mob ?? { id: base, name: speakerId };
  const text = [m.personality?.voice, m.name, m.description, m.personality?.attitude].filter(Boolean).join(' ').toLowerCase();
  const seed = hash(base);
  const woman = has(text, WOMAN);
  const man = has(text, MAN);
  // A voice the DM picked decides the gender (and accent) for the other services too
  const picked = pick && [
    ...KOKORO_VOICES.filter(v => v.id === pick.voice),
    ...GEMINI_VOICES.filter(v => v.id === pick.gemini),
    ...GROQ_VOICES.filter(v => v.id === pick.groq),
  ][0];
  const gender = picked?.gender ?? (woman && !man ? 'woman' : man && !woman ? 'man' : seed % 2 ? 'woman' : 'man');
  const british = picked?.accent ? picked.accent === 'British' : has(text, BRITISH) || (!has(text, ['american']) && seed % 3 === 0);
  const deep = has(text, DEEP);
  const quick = has(text, QUICK);
  const autoSpeed = deep && !quick ? 0.9 : quick && !deep ? 1.1 : 1;
  const speed = pick?.speed ?? autoSpeed;
  // Copy letter A, B, C… nudges the speed a little so a room of goblins doesn't sound identical
  const copy = speakerId.length > base.length ? hash(speakerId) % 5 : 2;
  const nudged = Math.min(NPC_SPEED_MAX, Math.max(NPC_SPEED_MIN, Math.round(speed * (1 + (copy - 2) * 0.04) * 100) / 100));
  const notes = (m.personality?.voice || m.description || '').trim().slice(0, 200);
  const manner = [
    `${m.name}${notes ? `, ${notes}` : ''}`,
    m.personality?.attitude ? `Attitude: ${m.personality.attitude.slice(0, 80)}` : '',
  ].filter(Boolean).join('. ');
  // The DM's pick, else the first creature named in the notes ('none' means plain)
  const sound = pick?.sound
    ? (pick.sound === 'none' ? undefined : pick.sound)
    : CREATURE_SOUNDS.find(c => has(text, c.words))?.id;
  return { gender, british, deep, quick, seed, speed: nudged, manner, sound };
}

/** The catalog voice that best fits the traits. */
export function fitVoice(catalog: CatalogVoice[], t: VoiceTraits, opts: { goodOnly?: boolean } = {}): CatalogVoice | undefined {
  let pool = catalog.filter(v => v.gender === t.gender && (!opts.goodOnly || v.good));
  const accented = pool.filter(v => !v.accent || v.accent === (t.british ? 'British' : 'American'));
  if (accented.length) pool = accented;
  const toned = pool.filter(v => (t.deep && !t.quick ? v.deep : t.quick && !t.deep ? v.bright : !v.deep && !v.bright));
  if (toned.length) pool = toned;
  if (!pool.length) pool = catalog;
  return pool[t.seed % pool.length];
}

/** The Kokoro voice for a speaker: the DM's pick, else one that fits its notes. */
export function kokoroVoice(t: VoiceTraits, pick?: NpcSpeechVoice): string {
  if (pick?.voice && KOKORO_VOICES.some(v => v.id === pick.voice)) return pick.voice;
  return fitVoice(KOKORO_VOICES, t, { goodOnly: true })?.id ?? 'af_heart';
}
