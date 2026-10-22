// Pure helpers for the NPC voices script: prompts, distances, name matching, output cleanup.
// No Firebase or network calls here, so they're easy to test.
import { getMobKind, isBossMob } from './speakers.mjs';

export const hasPersonality = (mob) =>
  !!mob?.personality && Object.values(mob.personality).some((v) => typeof v === 'string' && v.trim() !== '');

/** Distance in map-percentage units between two {x, y} points. */
export const distance = (a, b) => Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the text addresses the NPC by its full name or its first name (3+ letters). */
export const mentionsName = (text, name) => {
  if (!text || !name) return false;
  const candidates = new Set([name.trim()]);
  const first = name.trim().split(/\s+/)[0];
  if (first && first.length >= 3) candidates.add(first);
  // Skip leading articles ("The Newbie Killer" → "Newbie")
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && /^(the|a|an)$/i.test(words[0]) && words[1].length >= 3) candidates.add(words[1]);
  return [...candidates].some((c) => new RegExp(`(^|[^\\p{L}])${escapeRegex(c)}($|[^\\p{L}])`, 'iu').test(text));
};

/** HP as words, so the model reacts to how hurt someone is without numbers. */
export const hpWords = (hp, maxHP) => {
  if (!maxHP || maxHP <= 0 || hp === undefined || hp === null) return '';
  const pct = hp / maxHP;
  if (hp <= 0) return 'down and unconscious';
  if (pct < 0.3) return 'badly hurt';
  if (pct < 0.7) return 'hurt';
  return 'healthy';
};

export const timeOfDay = (epochMs) => {
  if (!epochMs) return '';
  const h = new Date(epochMs).getHours();
  if (h < 5) return 'the dead of night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
};

const describeCrawler = (c) => {
  const bits = [c.race, c.job].filter(Boolean).join(' ');
  const hurt = hpWords(c.hp, c.maxHP);
  return `${c.name}${bits ? ` (${bits}${c.level ? `, level ${c.level}` : ''}${hurt ? `, ${hurt}` : ''})` : hurt ? ` (${hurt})` : ''}`;
};

// ── Memory: what an NPC remembers from earlier conversations ──

export const MEMORY_MAX_NOTES = 8;

/** -3 (hates them) … +3 (fond of them) in words for the prompt and the DM. */
export const feelingWord = (score) =>
  score <= -3 ? 'hostile' : score === -2 ? 'dislikes them' : score === -1 ? 'wary'
    : score === 0 ? 'neutral' : score === 1 ? 'warming to them' : score === 2 ? 'friendly' : 'fond of them';

const clampScore = (n) => Math.max(-3, Math.min(3, Math.round(Number(n) || 0)));

/** Prompt lines for what the NPC remembers and how it feels about each crawler. */
export const describeMemory = (memory) => {
  const lines = [];
  const notes = (memory?.notes || []).filter(Boolean);
  if (notes.length) {
    lines.push('What you remember from earlier conversations:');
    for (const n of notes) lines.push(`- ${n}`);
  }
  const feelings = Object.values(memory?.feelings || {}).filter((f) => f?.name);
  if (feelings.length) {
    lines.push(`How you feel about the crawlers: ${feelings.map((f) => `${f.name}: ${feelingWord(f.score)}`).join('; ')}. Let this show in how you treat them.`);
  }
  return lines;
};

export const MEMORY_SYSTEM_PROMPT = [
  'You keep the memory notes for a character in a tabletop game.',
  'Reply with only a JSON object, no other text.',
].join('\n');

/**
 * Prompt to fold a finished conversation into an NPC's memory.
 * @param {{ mob: object, memory?: object, transcript: string, crawlerNames: string[] }} opts
 */
export const buildMemoryPrompt = ({ mob, memory, transcript, crawlerNames }) => {
  const notes = (memory?.notes || []).filter(Boolean);
  const feelings = memory?.feelings || {};
  const current = crawlerNames.map((name) => {
    const f = Object.values(feelings).find((x) => x?.name === name);
    return `${name}: ${f ? clampScore(f.score) : 0}`;
  });
  return [
    `Character: ${mob.name}${mob.description ? ` (${mob.description.slice(0, 200)})` : ''}`,
    mob.personality?.attitude ? `Their usual attitude: ${mob.personality.attitude}` : null,
    '',
    notes.length ? `What ${mob.name} already remembers:\n${notes.map((n) => `- ${n}`).join('\n')}` : `${mob.name} has no memories of the party yet.`,
    '',
    `The conversation that just ended:\n${transcript}`,
    '',
    `Update ${mob.name}'s memory. Keep what still matters, add what is new, merge repeats, drop trivia.`,
    `- At most ${MEMORY_MAX_NOTES} notes, each under 20 words, written from ${mob.name}'s point of view, naming who did what.`,
    '- Keep promises, deals, threats, insults, favours, lies they were told, names and plans they learned, and what they told the party.',
    '- Only record what was actually said or done. Do not invent anything, and never record anything that was not said aloud.',
    `- Feelings: a score from -3 (hostile) to 3 (fond) for each crawler, moved at most 1 or 2 points by this conversation. Current scores: ${current.join(', ') || 'none'}.`,
    '',
    'JSON shape: {"notes": ["..."], "feelings": {"<crawler name>": <score>}}',
  ].filter((l) => l !== null).join('\n');
};

/**
 * Read the model's memory update. Feelings are keyed by crawler id (names mapped through `crawlers`);
 * crawlers it didn't mention keep their old score. Null if the reply isn't usable.
 * @param {string} raw
 * @param {{ id: string, name: string }[]} crawlers
 * @param {object} [prev] the memory before this conversation
 */
export const parseMemory = (raw, crawlers, prev) => {
  const text = stripThinking(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  if (!Array.isArray(data?.notes)) return null;
  const notes = data.notes
    .filter((n) => typeof n === 'string' && n.trim())
    .map((n) => n.trim().slice(0, 200))
    .slice(0, MEMORY_MAX_NOTES);
  const feelings = { ...(prev?.feelings || {}) };
  for (const [name, score] of Object.entries(data.feelings || {})) {
    const crawler = crawlers.find((c) => c.name?.toLowerCase() === name.trim().toLowerCase());
    if (crawler && Number.isFinite(Number(score))) feelings[crawler.id] = { name: crawler.name, score: clampScore(score) };
  }
  return { notes, feelings };
};

/**
 * Languages with no words for outsiders. Each line is "meaning || what you do": crawlers who know the
 * language read the meaning, everyone else sees the body language.
 */
const GESTURE_STYLES = {
  beast: {
    intro: 'You are a creature that talks in animal sounds and body language (Beast). Only crawlers who can speak with animals understand your words; everyone else just sees what you do.',
    example: 'Food first, then I show you the tunnel. || squeaks twice and backs toward the hole, eyeing your cheese',
  },
  plant: {
    intro: 'You are a plant that talks in rustling, creaking and slow movement (Plant). Only crawlers who can speak with plants understand your words; everyone else just sees what you do. You only know slow, local things: who walked past, weather, water, light, what grows and rots around you. You think in seasons, not minutes.',
    example: 'Heavy boots came at moonrise and crushed my roots. They went east. || its leaves shiver and a vine curls toward the east tunnel',
  },
  dead: {
    intro: 'You are dead. A spell (Speak with Dead) gives your corpse a voice for a few questions (Dead). You only know what you knew in life, up to the moment you died; you learn nothing new and cannot see the present. Answer briefly, and often cryptically. You are not obliged to be truthful to those you hated in life.',
    example: 'The one with the iron ring. He laughed as I fell. || its jaw creaks open and a dry whisper escapes',
  },
};

/**
 * System prompt for one NPC line. The secret is only included when the DM has unlocked it,
 * so the model can't leak what it hasn't been told.
 */
export const buildSystemPrompt = ({ mob, secretUnlocked, scene, memory, speaking, knownLanguages, gesture, realLanguage }) => {
  const p = mob.personality || {};
  const style = gesture ? GESTURE_STYLES[gesture] : null;
  const lines = [
    `You are ${mob.name}, a character in a gritty, darkly funny dungeon-crawl tabletop game.`,
  ];
  if (mob.description) lines.push(`Who you are: ${mob.description}`);
  if (p.voice) lines.push(`Voice and manner: ${p.voice}`);
  if (p.wants) lines.push(`What you want: ${p.wants}`);
  if (p.knows) lines.push(`What you know: ${p.knows}`);
  if (p.attitude) lines.push(`Your attitude toward the party: ${p.attitude}`);
  if (p.secret) {
    if (secretUnlocked) {
      lines.push(`You have decided to share your secret now: ${p.secret}. Tell the party if it fits the moment.`);
    } else {
      lines.push('You are keeping a secret. Do not hint at what it is. If pressed about it, deflect or stall in character.');
      if (p.revealWhen) lines.push(`You would only open up if: ${p.revealWhen}.`);
    }
  }
  lines.push(...describeMemory(memory));
  if (style) {
    lines.push(style.intro);
  } else if (speaking) {
    const knows = knownLanguages?.length > 1 ? ` (you know ${knownLanguages.join(', ')})` : '';
    lines.push(realLanguage
      ? `You are speaking ${speaking}${knows}. Write every word of your line in ${realLanguage}, never in English, even if the crawlers spoke English. Then add " || " and the same line in plain English, for crawlers who understand ${realLanguage}.`
      : `You are speaking ${speaking}${knows}. Write your words in plain English; the game turns them into ${speaking} by itself, so never encode, cipher or translate them.`);
  }
  lines.push('');
  lines.push('The scene:');
  if (scene.episodeName) lines.push(`- Location: ${scene.episodeName}${scene.episodeDescription ? ` (${scene.episodeDescription})` : ''}`);
  if (scene.timeOfDay) lines.push(`- Time: ${scene.timeOfDay}`);
  lines.push(`- ${scene.inCombat ? 'A fight is happening right now.' : 'No fighting at the moment.'}`);
  if (scene.nearby.length) lines.push(`- Crawlers right next to you: ${scene.nearby.map(describeCrawler).join('; ')}`);
  if (scene.farther.length) lines.push(`- Crawlers farther away: ${scene.farther.map(describeCrawler).join('; ')}`);
  lines.push('');
  if (style) {
    lines.push('Rules: Reply with ONE line in this exact form: what you mean, in plain words (25 words or fewer) || what the crawlers see and hear you do (15 words or fewer, third person, no name).');
    lines.push(`Example: ${style.example}`);
    lines.push('Stay in character. No quotation marks, no name prefix.');
  } else if (realLanguage) {
    lines.push(`Rules: Reply with ONE line in this exact form: your spoken line in ${realLanguage} (25 words or fewer) || the same line in English. Stay in character.`);
  } else {
    lines.push('Rules: Reply with ONE line of spoken dialogue, 25 words or fewer. Stay in character.');
    lines.push('No narration, no stage directions, no actions in asterisks, no quotation marks, no name prefix.');
  }
  lines.push('Never speak or decide for the players.');
  return lines.join('\n');
};

/**
 * Chat lines as the model reads them. With `understands`, lines in a language the NPC doesn't
 * know come through as just the language, not the words.
 */
export const formatTranscript = (messages, understands, nameOf) =>
  messages.map((m) => {
    const who = `${m.authorName}${m.authorType === 'dm' ? ' (narrator)' : ''}`;
    if (understands && m.language && !understands(m.language)) {
      return `${who}: (says something in ${nameOf ? nameOf(m.language) : 'a language'} you don't understand)`;
    }
    return `${who}: ${m.text}`;
  }).join('\n');

export const buildLinePrompt = ({ mob, transcript, trigger }) =>
  [
    transcript ? `Recent conversation:\n${transcript}` : 'Nobody has said anything yet.',
    '',
    `What just happened: ${trigger}`,
    `Say ${mob.name}'s next line.`,
  ].join('\n');

export const buildShouldSpeakPrompt = ({ mob, transcript, trigger }) =>
  [
    `${mob.name} is a character in a tabletop game. ${mob.personality?.voice ?? ''}`.trim(),
    transcript ? `Recent conversation:\n${transcript}` : '',
    `What just happened: ${trigger}`,
    `Would ${mob.name} naturally say something out loud right now? Most of the time the answer is NO unless it concerns them.`,
    'Answer with only YES or NO.',
  ].filter(Boolean).join('\n\n');

export const buildSecretCheckPrompt = ({ condition, speaker, text, transcript }) =>
  [
    `Reveal condition: ${condition}`,
    transcript ? `Recent conversation:\n${transcript}` : '',
    `New message from ${speaker}: "${text}"`,
    'Taken together with the conversation, did this new message just meet the reveal condition (for example, an actual offer of payment if the condition is a payment)? Asking about the secret is NOT enough.',
    'Answer with only YES or NO.',
  ].filter(Boolean).join('\n\n');

export const isYes = (reply) => /^\W*yes\b/i.test(stripThinking(reply).trim());

export const stripThinking = (text) => (text || '').replace(/<think>[\s\S]*?(<\/think>|$)/gi, '');

/** Turn raw model output into one clean line of dialogue (or '' if nothing usable). */
export const cleanLine = (raw, name) => {
  let text = stripThinking(raw).trim();
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
  text = firstLine;
  if (name) text = text.replace(new RegExp(`^${escapeRegex(name)}\\s*[:：-]\\s*`, 'i'), '');
  text = text.replace(/^\*[^*]*\*\s*/, '').replace(/\s*\*[^*]*\*$/, ''); // leading/trailing *actions*
  text = text.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
  if (text.length > 220) text = text.slice(0, 217).replace(/\s+\S*$/, '') + '…';
  return text;
};

/**
 * Some online models take "you are speaking Base64" literally and send an encoded blob (or a
 * made-up cipher) instead of words, which no reader can follow. A line that is one long run of
 * code characters is decoded when it hides plain text; otherwise it comes back as '' (unusable).
 */
export const undoEncodedLine = (text) => {
  const t = (text || '').trim();
  if (/\s/.test(t) || !/^[A-Za-z0-9+/_-]{12,}={0,2}$/.test(t) || !/[0-9+/=_-]|[a-z][A-Z]/.test(t)) return t;
  try {
    const bin = atob(t.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, ''));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))).trim();
    return /^[\x20-\x7E\u00A0-\u024F’“”…—]+$/.test(decoded) && /[a-z]{2,}\s+[a-z]{2,}/i.test(decoded) ? decoded : '';
  } catch {
    return '';
  }
};

// ── Preset lines ──

/**
 * Lines for an NPC speaking a language nobody in the party knows. The players only see gibberish
 * (or body language), so these stand in for a model call. The DM sees the words.
 */
const PRESET_LINES = {
  any: [
    'Go away. I have nothing for you.', 'What do you want? Speak properly!', 'Bah. Lost again, are you?',
    'Leave me be, strangers.', 'You smell like trouble.', 'Not another one of you lot.',
    'Keep walking, if you know what is good for you.', 'Hah! Look at the soft little crawlers.',
  ],
  spanish: [
    '¿Qué quieres? No te entiendo.', '¡Vete de aquí, forastero!', 'Ay, otro aventurero perdido...',
    'No tengo nada para ti.', '¡Cuidado con los túneles!', '¿Quién eres tú? Habla claro.',
    'Déjame en paz, por favor.', 'Aquí abajo nadie sobrevive mucho tiempo.',
  ],
  'kra-kow': [
    'Soft-skins! Go away or get smashed!', 'Me no talk to food.', 'Shinies or leave!',
    'Boss say no strangers. Go!', 'You smell funny. Me like it.', 'Grr. Who let you in here?',
  ],
  base64: [
    'Unit busy. Leave.', 'Query not recognized.', 'Organic detected. Stand back.',
    'Processing. Please wait.', 'Access denied.', 'Error. Try again later.',
  ],
};

/** A preset line in a language, picked by `random` (0..1). */
export const presetLine = (languageId, random = Math.random()) => {
  const list = PRESET_LINES[languageId] ?? PRESET_LINES.any;
  return list[Math.floor(random * list.length) % list.length];
};

/** Languages that get the "meaning || what you do" format (see GESTURE_LANGUAGE_IDS). */
export const hasGestureStyle = (languageId) => Object.hasOwn(GESTURE_STYLES, languageId);

/**
 * Split a Beast, Plant or Dead reply ("words || body language") into the words (for those who
 * understand) and what everyone else sees, as "*squeaks and backs away*". No body language → gesture is ''.
 */
export const parseGestureLine = (raw, name) => {
  const text = stripThinking(raw).trim();
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
  const [words, ...rest] = firstLine.split('||');
  let gesture = rest.join(' ').trim().replace(/^\*+|\*+$/g, '').trim();
  if (name) gesture = gesture.replace(new RegExp(`^${escapeRegex(name)}\\s+`, 'i'), '');
  if (gesture.length > 140) gesture = gesture.slice(0, 137).replace(/\s+\S*$/, '') + '…';
  return { text: cleanLine(words, name), gesture: gesture ? `*${gesture}*` : '' };
};

/**
 * Split a reply in a real language ("¡Hola, amigo! || Hello, friend!") into the words as spoken
 * and their English meaning, for crawlers who know the language. No " || " → meaning is ''.
 */
export const parseRealLanguageLine = (raw, name) => {
  const text = stripThinking(raw).trim();
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
  const [words, ...rest] = firstLine.split('||');
  return { text: cleanLine(words, name), meaning: cleanLine(rest.join(' '), name) };
};

// ── Auto-generated personalities ──

/** Random ingredients, so two mobs built from the same facts still come out different. */
export const PERSONALITY_TRAITS = {
  temperament: [
    'nervous and twitchy', 'smug and self-important', 'gloomy and fatalistic', 'cheerful to an unsettling degree',
    'bored and sarcastic', 'paranoid', 'hot-tempered', 'dreamy and distracted', 'proud and touchy about it',
    'world-weary', 'eager to please', 'petty and vindictive', 'jovial and loud', 'cold and calculating',
  ],
  quirk: [
    'talks about themself in the third person', 'uses far too many fancy words, often wrongly',
    'speaks in short, clipped sentences', 'turns everything into a sales pitch', 'keeps mentioning their mother',
    'trails off mid-thought', 'uses sports metaphors for everything', 'whispers like everything is a conspiracy',
    'is very polite even when threatening', 'rhymes by accident and is embarrassed by it', 'complains constantly about the dungeon management',
    'names and talks to their weapon', 'quotes made-up proverbs', 'laughs at their own jokes',
  ],
  drive: [
    'wants to get out of the dungeon alive', 'is saving up for something embarrassing', 'craves recognition from the System',
    'is hiding from someone higher up', 'wants revenge on a past crawler', 'just wants a nap', 'is desperate for gossip',
    'collects strange trinkets', 'is secretly lonely', 'wants a promotion', 'is protecting someone or something nearby',
    'owes a dangerous debt',
  ],
  view: [
    'sees the crawlers as a business opportunity', 'thinks the crawlers are entertainment', 'fears the crawlers',
    'resents the crawlers for showing up', 'is curious about the crawlers', 'wants to recruit the crawlers for a scheme',
    'thinks the crawlers are beneath them', 'is quietly rooting for the crawlers',
  ],
  spark: [
    'lanterns', 'soup', 'a broken crown', 'taxes', 'a lost bet', 'mushrooms', 'a love letter', 'ratings',
    'a forbidden song', 'a stolen spoon', 'an old map', 'teeth', 'a cursed coin', 'fireworks', 'a pet beetle', 'bureaucracy',
  ],
};

const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];

/** One random pick from each trait list, plus a seed number to show in the log and the saved personality. */
export const rollPersonalityTraits = (rand = Math.random) => ({
  temperament: pick(PERSONALITY_TRAITS.temperament, rand),
  quirk: pick(PERSONALITY_TRAITS.quirk, rand),
  drive: pick(PERSONALITY_TRAITS.drive, rand),
  view: pick(PERSONALITY_TRAITS.view, rand),
  spark: pick(PERSONALITY_TRAITS.spark, rand),
  seed: Math.floor(rand() * 1_000_000),
});

const mobKindWords = (mob) => {
  const kind = getMobKind(mob) === 'character' ? 'a named character in the story' : 'a common creature, one of many like it';
  return isBossMob(mob) ? `${kind} (a boss)` : kind;
};

const describeItem = (item) => {
  const mods = item.statModifiers
    ? Object.entries(item.statModifiers).filter(([, v]) => v).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')
    : '';
  const bits = [item.description, mods, item.tags?.length ? item.tags.join(', ') : ''].filter(Boolean).join('; ');
  return `${item.name}${bits ? ` (${bits.slice(0, 140)})` : ''}`;
};

/** Everything the game knows about a mob, as plain lines for the personality prompt. */
export const describeMobFacts = ({ mob, items = [], gold }) => {
  const lines = [
    `Name: ${mob.name}`,
    `Kind: ${mobKindWords(mob)}, level ${mob.level ?? 1}`,
  ];
  if (mob.speciesName) lines.push(`Species: ${mob.speciesName}`);
  if (mob.description) lines.push(`Description: ${mob.description.slice(0, 600)}`);
  if (mob.hitPoints) lines.push(`Hit points: ${mob.hitPoints}`);
  if (mob.strengths) lines.push(`Strengths and abilities: ${mob.strengths.slice(0, 300)}`);
  if (mob.weaknesses) lines.push(`Weaknesses: ${mob.weaknesses.slice(0, 300)}`);
  const equipped = new Set(Object.values(mob.equippedItems || {}).filter(Boolean));
  if (items.length) {
    lines.push(`Carrying: ${items.slice(0, 12).map((i) => `${describeItem(i)}${equipped.has(i.id) ? ' [equipped]' : ''}`).join('; ')}`);
  }
  if (gold) lines.push(`Gold: ${gold}`);
  return lines.join('\n');
};

export const PERSONALITY_SYSTEM_PROMPT = [
  'You invent characters for a gritty, darkly funny dungeon-crawl tabletop game in the style of Dungeon Crawler Carl:',
  'a deadly dungeon run as an alien game show, where monsters and NPCs know they are part of the show.',
  'Every creature can talk, even beasts: simple creatures talk in simple, broken or animal-flavoured speech.',
  'Reply with one JSON object only. No markdown, no commentary.',
].join(' ');

/**
 * Prompt that asks the model to write a personality card for a mob that doesn't have one.
 * The game facts keep it grounded; the random traits make every result different.
 */
export const buildPersonalityPrompt = ({ mob, items, gold, traits, episodeName }) =>
  [
    'Create the personality for this character.',
    '',
    'Game facts (stay true to these):',
    describeMobFacts({ mob, items, gold }),
    episodeName ? `Where they are: ${episodeName}` : null,
    '',
    'Random ingredients (work all of them in, in your own way):',
    `- Temperament: ${traits.temperament}`,
    `- Speech quirk: ${traits.quirk}`,
    `- What drives them: ${traits.drive}`,
    `- How they see the crawlers: ${traits.view}`,
    `- Something tied to their past or secret: ${traits.spark}`,
    '',
    'Return JSON with exactly these keys (strings, each 30 words or fewer):',
    '{"voice": how they talk and carry themselves,',
    ' "wants": what they are after right now,',
    ' "knows": one useful or juicy thing they could tell the crawlers about this place,',
    ' "attitude": how they treat the crawlers,',
    ' "secret": something they hide, tied to their items, abilities or past,',
    ' "revealWhen": the plain-words condition for giving up the secret (a bribe, a favour, flattery, a threat...)}',
  ].filter((l) => l !== null).join('\n');

const PERSONALITY_KEYS = ['voice', 'wants', 'knows', 'attitude', 'secret', 'revealWhen'];

/** Pull the personality fields out of the model's reply; null if it isn't usable. */
export const parsePersonality = (raw) => {
  const text = stripThinking(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const out = {};
  for (const key of PERSONALITY_KEYS) {
    const v = data?.[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 300);
  }
  return out.voice ? out : null;
};

/** A Persuasion DC that scales with the mob: tougher and boss mobs are harder to talk round. */
export const defaultPersuasionDC = (mob) =>
  Math.min(25, Math.max(10, 10 + Math.floor((mob.level ?? 1) / 2) + (mob.type === 'boss' ? 5 : 0)));
