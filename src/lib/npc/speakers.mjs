// Who talks on the map. Shared by the app and the NPC voices engine so both name speakers the same way.
//
// A character (Grimble the Goblin Merchant) is one person wherever their token stands.
// A creature (Goblin) is a template: each copy on the map is its own speaker ("Goblin B")
// with its own AI personality, so no two goblins feel the same.

/** 'character' for unique story characters, 'creature' for templates. Old mobs: NPC type → character. */
export const getMobKind = (mob) => mob?.kind ?? (mob?.type === 'npc' ? 'character' : 'creature');

export const isBossMob = (mob) => mob?.boss ?? mob?.type === 'boss';

/** Creatures start out hostile and characters friendly, until the DM flips the token. */
export const isPlacementHostile = (placement, mob) => placement?.hostile ?? getMobKind(mob) === 'creature';

const SEP = '~';

/** The mob a speaker comes from ("goblinId~1" → "goblinId"). */
export const baseMobId = (speakerId) => String(speakerId ?? '').split(SEP)[0];

/**
 * One entry per token that can speak, in the order given.
 * @param placements tokens on the current map, episode ones first, then ones added during play
 * @param mobs every mob in the campaign
 * @param allPlacements every token in the episode, to tell when copies need letters (like the map does)
 * @returns {{ id: string, name: string, mob: object, placement: object }[]}
 */
export function mapSpeakers(placements, mobs, allPlacements = placements) {
  const counts = {};
  for (const p of allPlacements) counts[p.mobId] = (counts[p.mobId] ?? 0) + 1;
  const seen = {};
  const speakers = [];
  for (const placement of placements) {
    const idx = seen[placement.mobId] ?? 0;
    seen[placement.mobId] = idx + 1;
    const mob = mobs.find((m) => m.id === placement.mobId);
    if (!mob) continue;
    if (getMobKind(mob) === 'character') {
      speakers.push({ id: mob.id, name: mob.name, mob, placement });
      continue;
    }
    // Same letter the token shows (letterIndex, or its order on the map for old tokens)
    const letterIndex = placement.letterIndex ?? idx;
    const lettered = (counts[placement.mobId] ?? 1) > 1;
    speakers.push({
      id: `${mob.id}${SEP}${letterIndex}`,
      name: lettered ? `${mob.name} ${String.fromCharCode(65 + letterIndex)}` : mob.name,
      mob,
      placement,
    });
  }
  return speakers;
}
