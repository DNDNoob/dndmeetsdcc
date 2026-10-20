// Languages crawlers and mobs can know. Shared by the app and the NPC voices engine,
// so it's plain JavaScript (no build step) like src/lib/npc/*.mjs.

/** Everyone starts with this one; lines and mobs with no language set use it. */
export const DEFAULT_LANGUAGE_ID = 'worldspeech';

/** Only crawlers with the Telepathic switch on can use this one. */
export const TELEPATHIC_LANGUAGE_ID = 'mindspeech';

/** Animal speech: anyone who doesn't know it sees the creature's sounds and body language instead. */
export const BEAST_LANGUAGE_ID = 'beast';

/** Plant speech (rustles and creaks), shown as what the plant does to anyone who doesn't know it. */
export const PLANT_LANGUAGE_ID = 'plant';

/** Corpses speak this. A mob that knows it only answers someone who talks to it in Dead (Speak with Dead). */
export const DEAD_LANGUAGE_ID = 'dead';

/** Languages with no words for outsiders: they see the speaker's body language (the line's gesture) instead. */
export const GESTURE_LANGUAGE_IDS = [BEAST_LANGUAGE_ID, PLANT_LANGUAGE_ID, DEAD_LANGUAGE_ID];

export const BUILT_IN_LANGUAGES = [
  { id: 'worldspeech', name: 'Worldspeech', description: 'Essentially the common tongue, spoken by most races.' },
  { id: 'dervish', name: 'Dervish', description: 'A common language of small creatures like gnomes, dwarves and goblins.' },
  { id: 'vernonacular', name: 'Vernonacular', description: 'The language of magicians.' },
  { id: 'mindspeech', name: 'Mindspeech', description: 'A language of mental impressions, most useful with non-auditory or sub-sentient creatures. Crawlers need telepathy to use it.' },
  { id: 'ward-sign', name: 'Ward sign', description: 'A sign language built on abstract symbolism.' },
  { id: 'mewmew', name: 'Mewmew', description: 'Spoken by the Felinus races.' },
  { id: 'base64', name: 'Base64', description: 'A numerical language, often used by machines and sentient robots.' },
  { id: 'kra-kow', name: 'Kra Kow', description: 'Usually spoken by goblins, orcs and trolls.' },
  { id: 'spanish', name: 'Spanish', description: 'Spanish, carried down into the dungeon from the world above.' },
  { id: 'beast', name: 'Beast', description: 'Animal sounds and body language. Crawlers need Speak with Animals (or a similar gift) to understand the words; everyone else sees what the creature does.' },
  { id: 'plant', name: 'Plant', description: 'Rustling, creaking and slow movement. Crawlers need Speak with Plants (or a similar gift) to understand the words; everyone else sees what the plant does.' },
  { id: 'dead', name: 'Dead', description: 'The voice of a corpse. A corpse only answers crawlers who speak to it in Dead, usually through Speak with Dead.' },
];

/** A mob's languages; mobs with none set speak Worldspeech. The first one is its native tongue. */
export const mobLanguageIds = (mob) =>
  Array.isArray(mob?.languages) && mob.languages.length ? mob.languages : [DEFAULT_LANGUAGE_ID];

/** Display name for a language id, looking in custom languages too. */
export const languageName = (id, custom = []) =>
  BUILT_IN_LANGUAGES.find((l) => l.id === id)?.name
  ?? custom.find((l) => l.id === id)?.name
  ?? 'an unknown tongue';
