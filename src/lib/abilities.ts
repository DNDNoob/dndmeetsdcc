import {
  ABILITY_USES,
  CHECK_DIFFICULTIES,
  SKILLS,
  type Ability,
  type AbilityEffect,
  type AbilityEffectType,
  type AbilityKey,
  type AbilityLink,
  type AbilityTweaks,
  type Crawler,
  type InventoryItem,
  type Spell,
  type WeaponDie,
} from '@/lib/gameData';
import { DEFAULT_ABILITIES } from '@/lib/defaultAbilities';
import { resolveKnownSpell } from '@/lib/upgrades';

// ======== Abilities: labels and helpers (no Firebase access here) ========

export const STAT_NAMES: Record<AbilityKey, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', cha: 'Charisma',
};

export const ABILITY_EFFECT_TYPES: { type: AbilityEffectType; label: string }[] = [
  { type: 'dice', label: 'Roll dice (attack, damage or healing)' },
  { type: 'condition', label: 'Put a condition on the target' },
  { type: 'stat', label: 'Stat bonus' },
  { type: 'language', label: 'Grant a language' },
  { type: 'defense', label: 'Defense (armor, resist, vulnerable)' },
  { type: 'movement', label: 'Movement' },
  { type: 'text', label: 'Something else (the DM judges it)' },
];

/** A blank effect of the given type, ready for the editor. */
export const newAbilityEffect = (type: AbilityEffectType): AbilityEffect => {
  switch (type) {
    case 'dice': return { type, purpose: 'damage', dice: [{ count: 1, sides: 6 }], damageType: 'Basic' };
    case 'condition': return { type, condition: 'Stunned', turns: 1 };
    case 'stat': return { type, mods: { str: 1 } };
    case 'language': return { type, language: '' };
    case 'defense': return { type, armorRating: 1 };
    case 'movement': return { type, feet: 10 };
    case 'text': return { type, text: '' };
  }
};

export const createDefaultAbility = (): Ability => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  activation: 'Action',
  uses: 'atWill',
  effects: [],
});

const diceText = (dice: WeaponDie[]): string =>
  dice.filter(d => d.count > 0).map(d => `${d.count}d${d.sides}`).join(' + ');

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

/** One line per effect, e.g. "8d6 fire damage" or "Stunned for 1 turn". */
export const describeAbilityEffect = (effect: AbilityEffect, languageName: (id: string) => string = id => id): string => {
  switch (effect.type) {
    case 'dice': {
      const dice = diceText(effect.dice) || 'no dice';
      if (effect.purpose === 'healing') return `Heals ${dice}`;
      if (effect.purpose === 'attack') return `${dice} added to the attack roll`;
      const type = effect.damageType && effect.damageType !== 'Basic' ? `${effect.damageType.toLowerCase()} ` : '';
      return `${dice} ${type}damage`;
    }
    case 'condition':
      return `${effect.condition} for ${effect.turns} turn${effect.turns === 1 ? '' : 's'}${effect.description ? ` (${effect.description})` : ''}`;
    case 'stat': {
      const parts = Object.entries(effect.mods).filter(([, v]) => v).map(([k, v]) => `${signed(v as number)} ${k.toUpperCase()}`);
      return parts.length ? parts.join(', ') : 'No stat change';
    }
    case 'language':
      return effect.language ? `Can speak and read ${languageName(effect.language)}` : 'Grants a language (none picked)';
    case 'defense': {
      const parts = [
        effect.armorRating ? `${signed(effect.armorRating)} armor rating` : '',
        effect.resist?.length ? `resists ${effect.resist.join(', ')}` : '',
        effect.vulnerable?.length ? `vulnerable to ${effect.vulnerable.join(', ')}` : '',
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : 'No defense change';
    }
    case 'movement':
      return `${signed(effect.feet)} ft movement`;
    case 'text':
      return effect.text || 'Special effect';
  }
};

/** "2 per day", "At will", "1 per combat" */
export const describeAbilityUses = (ability: Pick<Ability, 'uses' | 'usesCount'>): string => {
  if (ability.uses === 'atWill') return 'At will';
  const label = ABILITY_USES.find(u => u.id === ability.uses)?.label.toLowerCase() ?? '';
  return `${ability.usesCount ?? 1} ${label}`;
};

/** "Sleight of Hand (DEX), Medium" or "DEX check" */
export const describeAbilityRoll = (roll: Ability['roll']): string | null => {
  if (!roll) return null;
  const skill = roll.skill ? SKILLS.find(s => s.id === roll.skill) : undefined;
  const base = skill ? `${skill.name} (${roll.ability.toUpperCase()})` : `${roll.ability.toUpperCase()} check`;
  const difficulty = roll.difficulty ? CHECK_DIFFICULTIES.find(d => d.id === roll.difficulty)?.name : undefined;
  return difficulty ? `${base}, ${difficulty}` : base;
};

/** Ids of built-in abilities are prefixed so they never clash with library ids. */
export const BUILT_IN_PREFIX = 'builtin:';

/** Actions every character has (Dodge, Help, Grapple...), shown read-only in the Abilities library. */
export const BUILT_IN_ABILITIES: Ability[] = DEFAULT_ABILITIES.map(a => ({
  id: `${BUILT_IN_PREFIX}${a.id}`,
  name: a.name,
  description: a.description,
  activation: a.actionType,
  uses: 'atWill',
  ...(a.roll ? { roll: { ability: a.roll.ability, ...(a.roll.skill ? { skill: a.roll.skill } : {}) } } : {}),
  effects: [],
}));

export const isBuiltInAbility = (ability: Pick<Ability, 'id'>): boolean => ability.id.startsWith(BUILT_IN_PREFIX);

/** A fresh, editable copy of an ability ("Make my own copy"), remembering where it came from. */
export const copyAbility = (source: Ability): Ability => {
  const { createdBy: _c, createdByUsername: _u, ...rest } = source;
  return {
    ...rest,
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    effects: source.effects.map(e => ({ ...e })),
    copiedFrom: source.copiedFrom ?? source.id,
  };
};

// ======== Links: items and spells point at library abilities ========

const isSet = (v: unknown) => v !== undefined && v !== null && v !== '';

/** True when the link changes anything about the ability. */
export const hasTweaks = (link: Pick<AbilityLink, 'tweaks'>): boolean =>
  !!link.tweaks && Object.values(link.tweaks).some(isSet);

/** The ability as this link uses it: the library card with the link's tweaks applied. */
export const applyAbilityTweaks = (ability: Ability, tweaks?: AbilityTweaks): Ability => {
  if (!tweaks) return ability;
  let effects = ability.effects;
  if (isSet(tweaks.diceCount)) {
    const i = effects.findIndex(e => e.type === 'dice' && e.dice.length > 0);
    if (i >= 0) {
      effects = effects.map((e, j) => (j === i && e.type === 'dice'
        ? { ...e, dice: e.dice.map((d, k) => (k === 0 ? { ...d, count: tweaks.diceCount! } : d)) }
        : e));
    }
  }
  if (isSet(tweaks.turns)) {
    const i = effects.findIndex(e => e.type === 'condition');
    if (i >= 0) effects = effects.map((e, j) => (j === i && e.type === 'condition' ? { ...e, turns: tweaks.turns! } : e));
  }
  const cost = isSet(tweaks.mana) || isSet(tweaks.hp)
    ? { ...ability.cost, ...(isSet(tweaks.mana) ? { mana: tweaks.mana } : {}), ...(isSet(tweaks.hp) ? { hp: tweaks.hp } : {}) }
    : ability.cost;
  return {
    ...ability,
    effects,
    cost,
    ...(isSet(tweaks.uses) ? { uses: tweaks.uses! } : {}),
    ...(isSet(tweaks.usesCount) ? { usesCount: tweaks.usesCount } : {}),
    ...(ability.roll && isSet(tweaks.difficulty) ? { roll: { ...ability.roll, difficulty: tweaks.difficulty } } : {}),
  };
};

/** Finds a linked ability in the campaign library, or among the built-in ones. */
export const findAbility = (library: Ability[], id: string): Ability | undefined =>
  library.find(a => a.id === id) ?? BUILT_IN_ABILITIES.find(a => a.id === id);

/** A copy of the ability with the link's tweaks baked in, for "Make my own copy" from a link. */
export const copyWithTweaks = (ability: Ability, link: AbilityLink): Ability =>
  copyAbility(applyAbilityTweaks(ability, link.tweaks));

export interface CrawlerAbility {
  key: string;            // unique per source, e.g. "item:<itemId>:<abilityId>"
  ability: Ability;       // with the link's tweaks applied
  base: Ability;          // the library card
  link: AbilityLink;
  source: { kind: 'item' | 'spell'; id: string; name: string };
}

/**
 * Abilities a crawler has right now: from equipped items (or carried items that have no slot)
 * and from known spells. Links to abilities that no longer exist are skipped.
 */
export const getCrawlerAbilities = (
  crawler: Pick<Crawler, 'equippedItems' | 'knownSpells'>,
  inventory: InventoryItem[],
  spells: Spell[],
  library: Ability[],
): CrawlerAbility[] => {
  const equippedIds = new Set(Object.values(crawler.equippedItems ?? {}).filter(Boolean));
  const out: CrawlerAbility[] = [];
  const add = (links: AbilityLink[] | undefined, source: CrawlerAbility['source']) => {
    for (const link of links ?? []) {
      const base = findAbility(library, link.abilityId);
      if (!base) continue;
      out.push({ key: `${source.kind}:${source.id}:${link.abilityId}`, ability: applyAbilityTweaks(base, link.tweaks), base, link, source });
    }
  };
  for (const item of inventory) {
    if (!item.abilities?.length) continue;
    if (item.equipSlot && !equippedIds.has(item.id)) continue;
    add(item.abilities, { kind: 'item', id: item.id, name: item.name });
  }
  for (const ks of crawler.knownSpells ?? []) {
    const spell = resolveKnownSpell(ks, spells);
    if (spell?.abilities?.length) add(spell.abilities, { kind: 'spell', id: spell.id, name: spell.name });
  }
  return out;
};

/** Rolls dice, e.g. for an ability's damage or healing. */
export const rollAbilityDice = (dice: WeaponDie[]): { results: { dice: string; result: number }[]; total: number } => {
  const results: { dice: string; result: number }[] = [];
  for (const d of dice) {
    for (let i = 0; i < d.count; i++) {
      results.push({ dice: `D${d.sides}`, result: Math.floor(Math.random() * d.sides) + 1 });
    }
  }
  return { results, total: results.reduce((sum, r) => sum + r.result, 0) };
};

export const formatAbilityDice = (dice: WeaponDie[]): string => diceText(dice);

/** Short one-line summary of what an ability does, for chips and lists. */
export const summarizeAbility = (ability: Ability): string => {
  const parts = [
    ability.activation,
    describeAbilityUses(ability),
    ability.cost?.mana ? `${ability.cost.mana} mana` : '',
    ability.cost?.hp ? `${ability.cost.hp} HP` : '',
    describeAbilityRoll(ability.roll) ?? '',
    ...ability.effects.slice(0, 2).map(e => describeAbilityEffect(e)),
  ].filter(Boolean);
  return parts.join(' · ');
};

