import {
  ABILITY_USES,
  CHECK_DIFFICULTIES,
  SKILLS,
  type Ability,
  type AbilityEffect,
  type AbilityEffectType,
  type AbilityKey,
  type WeaponDie,
} from '@/lib/gameData';
import { DEFAULT_ABILITIES } from '@/lib/defaultAbilities';

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
