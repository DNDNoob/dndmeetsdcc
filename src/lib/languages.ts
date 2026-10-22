// App-side language rules: who understands what, scrambled text, and how a chat line reads
// for each viewer (including party translators). Built-in languages are in languageList.mjs.
import { BUILT_IN_LANGUAGES, GESTURE_LANGUAGE_IDS, DEFAULT_LANGUAGE_ID, TELEPATHIC_LANGUAGE_ID, REAL_LANGUAGES, languageName, crawlerLanguageIds as knownLanguageIds, crawlerUnderstands as understandsLanguage, type LanguageInfo } from './languageList.mjs';
import { translateModeAt, type ChatMessage, type Crawler, type CustomLanguage, type LanguageEffect } from './gameData';

export { BUILT_IN_LANGUAGES, DEFAULT_LANGUAGE_ID, TELEPATHIC_LANGUAGE_ID, languageName, mobLanguageIds } from './languageList.mjs';
export type { LanguageInfo } from './languageList.mjs';

export interface Language extends LanguageInfo {
  custom?: boolean;
  createdByCrawlerId?: string;
}

/** Built-in languages first, then custom ones by name. */
export const allLanguages = (custom: CustomLanguage[]): Language[] => [
  ...BUILT_IN_LANGUAGES,
  ...[...custom]
    .filter(l => l.name?.trim())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(l => ({ id: l.id, name: l.name, description: l.description, custom: true, createdByCrawlerId: l.createdByCrawlerId })),
];

type KnowsLanguages = Pick<Crawler, 'languages' | 'languageEffects' | 'itemLanguages'>;

/** The languages a crawler knows, including ones from spells and equipped items; none set = Worldspeech. */
export const crawlerLanguageIds = (crawler: KnowsLanguages | null | undefined): string[] => knownLanguageIds(crawler);

/** Languages the crawler has only for now (spells and items), not the ones they really know. */
export const borrowedLanguageIds = (crawler: KnowsLanguages | null | undefined): string[] => {
  const own = crawler?.languages ?? [DEFAULT_LANGUAGE_ID];
  return crawlerLanguageIds(crawler).filter(id => !own.includes(id));
};

/** Speak with Dead style limits: the language's only source is a spell with no questions left. */
const outOfQuestions = (crawler: KnowsLanguages | null | undefined, languageId: string): boolean => {
  if (!crawler || (crawler.languages ?? [DEFAULT_LANGUAGE_ID]).includes(languageId) || crawler.itemLanguages?.includes(languageId)) return false;
  const effects = (crawler.languageEffects ?? []).filter(e => e.languageId === languageId);
  return effects.length > 0 && effects.every(e => e.questionsLeft !== undefined && e.questionsLeft <= 0);
};

/** The spell effect a line in this language should count against (one with questions left), if any. */
export const questionEffectFor = (crawler: KnowsLanguages | null | undefined, languageId: string | undefined): LanguageEffect | undefined => {
  if (!crawler || !languageId || (crawler.languages ?? [DEFAULT_LANGUAGE_ID]).includes(languageId) || crawler.itemLanguages?.includes(languageId)) return undefined;
  const effects = (crawler.languageEffects ?? []).filter(e => e.languageId === languageId);
  if (effects.some(e => e.questionsLeft === undefined)) return undefined; // another spell gives it with no limit
  return effects.find(e => (e.questionsLeft ?? 0) > 0);
};

/** "3 turns left", "2 questions left" and so on, for showing a spell's language. */
export const languageEffectLeft = (e: LanguageEffect): string => {
  const parts: string[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (e.questionsLeft !== undefined) parts.push(`${plural(e.questionsLeft, 'question')} left`);
  if (e.noncombatTurnsLeft !== undefined) parts.push(`${plural(e.noncombatTurnsLeft, 'turn')} left`);
  else if (e.combatRoundsLeft !== undefined) parts.push(`${plural(e.combatRoundsLeft, 'round')} left`);
  return parts.join(', ');
};

/** Mindspeech only works for telepathic crawlers. */
export const crawlerUnderstands = (crawler: (KnowsLanguages & Pick<Crawler, 'telepathic'>) | null | undefined, languageId: string | undefined): boolean =>
  understandsLanguage(crawler, languageId);

/** The languages a crawler can speak in chat, in their own order. */
export const usableLanguageIds = (crawler: (KnowsLanguages & Pick<Crawler, 'telepathic'>) | null | undefined): string[] =>
  crawlerLanguageIds(crawler).filter(id => crawlerUnderstands(crawler, id) && !outOfQuestions(crawler, id));

// ── Scrambled text ──

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Small seeded random, so the same line always scrambles the same way
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SYLLABLES: Record<string, string[]> = {
  worldspeech: ['ka', 'lo', 'ver', 'nem', 'tas', 'rin', 'do', 'mel', 'sa', 'tor', 'en', 'bal'],
  dervish: ['bik', 'tum', 'gol', 'dra', 'nik', 'wum', 'zib', 'pok', 'rak', 'fen', 'dub', 'skee'],
  vernonacular: ['ae', 'thir', 'vel', 'quor', 'ixa', 'lum', 'ser', 'eth', "y'ra", 'oth', 'zan', 'ilm'],
  mewmew: ['mew', 'mrrp', 'mrow', 'prr', 'nya', 'mreow', 'hss', 'mip'],
  'kra-kow': ['KRA', 'KOW', 'grok', 'ugg', 'zug', 'THRAK', 'gar', 'muk', 'rrah', 'dak'],
  beast: ['grr', 'yip', 'squeak', 'snrf', 'hss', 'huff', 'chrr', 'rrr', 'awoo', 'chuff'],
  plant: ['rustle', 'creak', 'shff', 'krr', 'swsh', 'tikk', 'hsss', 'crrk'],
  dead: ['hhh', 'khh', 'sss', 'rrhh', 'ahh', 'thh', 'kkt', 'uhh'],
};
const WARD_SIGNS = ['◬', '⟁', '⌖', '⊹', '⋔', '⟡', '⌬', '⍟', '⧖', '⟐', '⏃', '⎔'];
const MIND_WAVES = ['∿', '≈', '≋', '~', '◌', '∾'];

const CONSONANTS = 'bcdfghjklmnpqrstvwxz';
const VOWELS = 'aeiouy';

/** A made-up language gets its own sound, picked from its id. */
const customSyllables = (languageId: string): string[] => {
  const rand = seeded(hash(languageId));
  const pickFrom = (s: string) => s[Math.floor(rand() * s.length)];
  const out: string[] = [];
  for (let i = 0; i < 10; i++) {
    out.push(pickFrom(CONSONANTS) + pickFrom(VOWELS) + (rand() < 0.4 ? pickFrom(CONSONANTS) : ''));
  }
  return out;
};

const toBase64 = (text: string): string => {
  try {
    return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  } catch {
    return text.replace(/./g, '0');
  }
};

/** What a line looks like to someone who doesn't know its language. Same input, same output. */
export const scrambleText = (text: string, languageId: string): string => {
  if (!text) return text;
  // Real languages (Spanish) are already foreign words to anyone who doesn't know them
  if (languageId in REAL_LANGUAGES) return text;
  if (languageId === 'base64') return toBase64(text);
  const rand = seeded(hash(`${languageId}:${text}`));
  const pickFrom = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const words = text.split(/\s+/).filter(Boolean);
  if (languageId === 'ward-sign') {
    return words.map(() => Array.from({ length: 1 + Math.floor(rand() * 2) }, () => pickFrom(WARD_SIGNS)).join('')).join(' ');
  }
  if (languageId === TELEPATHIC_LANGUAGE_ID) {
    return words.map(w => Array.from({ length: Math.max(1, Math.min(4, Math.ceil(w.length / 2))) }, () => pickFrom(MIND_WAVES)).join('')).join(' ');
  }
  const syllables = SYLLABLES[languageId] ?? customSyllables(languageId);
  return words.map((w, i) => {
    const count = Math.max(1, Math.min(3, Math.round(w.replace(/\W/g, '').length / 3)));
    let word = Array.from({ length: count }, () => pickFrom(syllables)).join(languageId === 'kra-kow' ? '-' : '');
    if (i === 0 && languageId !== 'kra-kow') word = word.charAt(0).toUpperCase() + word.slice(1);
    const tail = /[.,!?;:…]+$/.exec(w)?.[0] ?? '';
    return word + tail;
  }).join(' ');
};

// ── Reading chat lines ──

export interface ChatReader {
  isAdmin: boolean;
  crawler: Crawler | null; // the viewer's crawler (null for the DM or a spectator)
  party: Crawler[];        // every crawler in the campaign (possible translators)
}

/** How one chat line shows for the current viewer. */
export interface ChatLineView {
  text: string;
  languageId?: string;
  languageName?: string;   // set when the language is worth showing (not plain Worldspeech everyone reads)
  scrambled: boolean;      // the viewer sees gibberish
  via?: string;            // a translator passed it on to the viewer
  translating?: string;    // a translator who checks lines first hasn't passed this one on yet
  /** DM and the translator themselves: what translators told the party, and whether it was twisted */
  toldParty?: { by: string; text: string; twisted: boolean; mine: boolean }[];
  /** The viewer is a translator who still needs to pass this line on (or twist it) */
  canTranslate?: boolean;
}

/** Translators who can carry a line in this language to the party. */
const translatorsFor = (languageId: string, party: Crawler[], at: number | undefined) =>
  party.filter(c => translateModeAt(c, at) !== 'off' && crawlerUnderstands(c, languageId));

export const readChatLine = (
  m: ChatMessage,
  translations: ChatMessage[], // lines whose translationOf is m.id, oldest first
  reader: ChatReader,
  custom: CustomLanguage[],
): ChatLineView => {
  const languageId = m.language;
  if (!languageId) return { text: m.text, scrambled: false };
  const name = languageName(languageId, custom);
  const own = reader.crawler && m.authorType === 'crawler' && m.authorId === reader.crawler.id;
  const understands = reader.isAdmin || own || crawlerUnderstands(reader.crawler, languageId);
  // Worldspeech is the everyday tongue: only label it for someone who can't follow it
  const labelled = languageId !== DEFAULT_LANGUAGE_ID ? name : undefined;
  const byCrawler = (id: string) => reader.party.find(c => c.id === id);
  // Spanish NPC lines carry their English meaning: that's what knowing the language gets you
  const understood = m.meaning || m.text;

  if (understands) {
    const toldParty = translations
      .filter(t => reader.isAdmin || t.authorId === reader.crawler?.id)
      .map(t => ({ by: t.authorName, text: t.text, twisted: t.text.trim() !== understood.trim() && t.text.trim() !== m.text.trim(), mine: t.authorId === reader.crawler?.id }));
    const me = reader.crawler;
    const someoneNeedsIt = reader.party.some(c => c.id !== me?.id && !crawlerUnderstands(c, languageId) && !(m.authorType === 'crawler' && m.authorId === c.id));
    // A line said while checking lines, or an older line from before translating was switched on
    const modeThen = me ? translateModeAt(me, m.createdAt) : 'off';
    const canTranslate = !!me && (modeThen === 'review' || (modeThen === 'off' && (me.translateMode ?? 'off') !== 'off')) && !own
      && crawlerUnderstands(me, languageId) && someoneNeedsIt
      && !translations.some(t => t.authorId === me.id);
    return {
      text: understood, languageId, languageName: labelled, scrambled: false,
      ...(toldParty.length ? { toldParty } : {}),
      ...(canTranslate ? { canTranslate } : {}),
    };
  }

  // Someone speaking a language doesn't translate their own words
  const translators = translatorsFor(languageId, reader.party, m.createdAt)
    .filter(t => t.id !== reader.crawler?.id && !(m.authorType === 'crawler' && m.authorId === t.id));
  // A translator's own version wins (it may be twisted); newest one if several posted
  // (any party member who knows the language: older lines can be passed on one at a time)
  const told = [...translations].reverse().find(t => t.authorId !== reader.crawler?.id
    && reader.party.some(c => c.id === t.authorId && crawlerUnderstands(c, languageId)));
  if (told) return { text: told.text, languageId, languageName: name, scrambled: false, via: byCrawler(told.authorId)?.name ?? told.authorName };
  const auto = translators.find(c => translateModeAt(c, m.createdAt) === 'auto');
  if (auto) return { text: understood, languageId, languageName: name, scrambled: false, via: auto.name };
  const checking = translators.find(c => translateModeAt(c, m.createdAt) === 'review');
  return {
    // Beast, Plant and Dead: show what the speaker does rather than gibberish
    text: (GESTURE_LANGUAGE_IDS.includes(languageId) && m.gesture) || scrambleText(m.text, languageId), languageId, languageName: name, scrambled: true,
    ...(checking ? { translating: checking.name } : {}),
  };
};

/** Text such as an item description, as the viewer sees it. */
export const readWrittenText = (
  text: string,
  languageId: string | undefined,
  reader: Pick<ChatReader, 'isAdmin' | 'crawler'>,
): { text: string; scrambled: boolean } => {
  if (!languageId || reader.isAdmin || crawlerUnderstands(reader.crawler, languageId)) return { text, scrambled: false };
  return { text: scrambleText(text, languageId), scrambled: true };
};
