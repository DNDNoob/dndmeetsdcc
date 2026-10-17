// Pure helpers for the NPC voices script: prompts, distances, name matching, output cleanup.
// No Firebase or network calls here, so they're easy to test.

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

/**
 * System prompt for one NPC line. The secret is only included when the DM has unlocked it,
 * so the model can't leak what it hasn't been told.
 */
export const buildSystemPrompt = ({ mob, secretUnlocked, scene }) => {
  const p = mob.personality || {};
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
  lines.push('');
  lines.push('The scene:');
  if (scene.episodeName) lines.push(`- Location: ${scene.episodeName}${scene.episodeDescription ? ` (${scene.episodeDescription})` : ''}`);
  if (scene.timeOfDay) lines.push(`- Time: ${scene.timeOfDay}`);
  lines.push(`- ${scene.inCombat ? 'A fight is happening right now.' : 'No fighting at the moment.'}`);
  if (scene.nearby.length) lines.push(`- Crawlers right next to you: ${scene.nearby.map(describeCrawler).join('; ')}`);
  if (scene.farther.length) lines.push(`- Crawlers farther away: ${scene.farther.map(describeCrawler).join('; ')}`);
  lines.push('');
  lines.push('Rules: Reply with ONE line of spoken dialogue, 25 words or fewer. Stay in character.');
  lines.push('No narration, no stage directions, no actions in asterisks, no quotation marks, no name prefix.');
  lines.push('Never speak or decide for the players.');
  return lines.join('\n');
};

export const formatTranscript = (messages) =>
  messages.map((m) => `${m.authorName}${m.authorType === 'dm' ? ' (narrator)' : ''}: ${m.text}`).join('\n');

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

const MOB_KINDS = { npc: 'a non-player character', boss: 'a boss monster', normal: 'a monster' };

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
    `Kind: ${MOB_KINDS[mob.type] ?? 'a monster'}, level ${mob.level ?? 1}`,
  ];
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
