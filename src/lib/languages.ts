// App-side language rules: who understands what, scrambled text, and how a chat line reads
// for each viewer (including party translators). Built-in languages are in languageList.mjs.
import { BUILT_IN_LANGUAGES, DEFAULT_LANGUAGE_ID, TELEPATHIC_LANGUAGE_ID, languageName, type LanguageInfo } from './languageList.mjs';
import type { ChatMessage, Crawler, CustomLanguage } from './gameData';

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

/** The languages a crawler knows; none set = Worldspeech. */
export const crawlerLanguageIds = (crawler: Pick<Crawler, 'languages'> | null | undefined): string[] =>
  crawler?.languages ?? [DEFAULT_LANGUAGE_ID];

/** Mindspeech only works for telepathic crawlers. */
export const crawlerUnderstands = (crawler: Pick<Crawler, 'languages' | 'telepathic'> | null | undefined, languageId: string | undefined): boolean => {
  if (!languageId) return true;
  if (!crawler) return false;
  if (languageId === TELEPATHIC_LANGUAGE_ID && !crawler.telepathic) return false;
  return crawlerLanguageIds(crawler).includes(languageId);
};

/** The languages a crawler can speak in chat, in their own order. */
export const usableLanguageIds = (crawler: Pick<Crawler, 'languages' | 'telepathic'> | null | undefined): string[] =>
  crawlerLanguageIds(crawler).filter(id => crawlerUnderstands(crawler, id));

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
const translatorsFor = (languageId: string, party: Crawler[]) =>
  party.filter(c => (c.translateMode === 'auto' || c.translateMode === 'review') && crawlerUnderstands(c, languageId));

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

  if (understands) {
    const toldParty = translations
      .filter(t => reader.isAdmin || t.authorId === reader.crawler?.id)
      .map(t => ({ by: t.authorName, text: t.text, twisted: t.text.trim() !== m.text.trim(), mine: t.authorId === reader.crawler?.id }));
    const me = reader.crawler;
    const someoneNeedsIt = reader.party.some(c => c.id !== me?.id && !crawlerUnderstands(c, languageId) && !(m.authorType === 'crawler' && m.authorId === c.id));
    const canTranslate = !!me && me.translateMode === 'review' && !own
      && crawlerUnderstands(me, languageId) && someoneNeedsIt
      && !translations.some(t => t.authorId === me.id);
    return {
      text: m.text, languageId, languageName: labelled, scrambled: false,
      ...(toldParty.length ? { toldParty } : {}),
      ...(canTranslate ? { canTranslate } : {}),
    };
  }

  // Someone speaking a language doesn't translate their own words
  const translators = translatorsFor(languageId, reader.party)
    .filter(t => t.id !== reader.crawler?.id && !(m.authorType === 'crawler' && m.authorId === t.id));
  // A translator's own version wins (it may be twisted); newest one if several posted
  const told = [...translations].reverse().find(t => translators.some(c => c.id === t.authorId));
  if (told) return { text: told.text, languageId, languageName: name, scrambled: false, via: byCrawler(told.authorId)?.name ?? told.authorName };
  const auto = translators.find(c => c.translateMode === 'auto');
  if (auto) return { text: m.text, languageId, languageName: name, scrambled: false, via: auto.name };
  const checking = translators.find(c => c.translateMode === 'review');
  return {
    text: scrambleText(m.text, languageId), languageId, languageName: name, scrambled: true,
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
