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
