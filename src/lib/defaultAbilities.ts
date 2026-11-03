import type { AbilityKey, SkillId } from "@/lib/gameData";

// Combat actions every character has, whatever their class, items or spells. Kept as data so a
// shared abilities system can take them over later. Each one costs its action type in combat
// (one action and one bonus action per turn, one reaction per round).

export type DefaultAbilityType = 'Action' | 'Bonus Action' | 'Reaction';

export interface DefaultAbility {
  id: string;
  name: string;
  actionType: DefaultAbilityType;
  description: string;
  /** The check it rolls, if any: d20 + ability modifier (+ skill rank) */
  roll?: { ability: AbilityKey; skill?: SkillId };
}

export const DEFAULT_ABILITIES: DefaultAbility[] = [
  {
    id: 'dodge',
    name: 'Dodge',
    actionType: 'Reaction',
    description: "When an attack would hit you, roll d20 + DEX + Acrobatics. Meet or beat the attack roll and it misses. You're asked automatically when a mob's attack would hit.",
    roll: { ability: 'dex', skill: 'acrobatics' },
  },
  {
    id: 'opportunity-attack',
    name: 'Opportunity Attack',
    actionType: 'Reaction',
    description: 'When an enemy leaves your reach, attack it once with a weapon or Unarmed Strike from the Attacks tab, even on its turn.',
  },
  {
    id: 'trip',
    name: 'Trip',
    actionType: 'Reaction',
    description: 'Try to knock a creature down as it moves past you. DEX check; the DM decides if it falls.',
    roll: { ability: 'dex' },
  },
  {
    id: 'help',
    name: 'Help',
    actionType: 'Action',
    description: 'Give an ally advantage on their next roll. They get the Helped effect until the end of their next turn.',
  },
  {
    id: 'ready',
    name: 'Ready',
    actionType: 'Action',
    description: 'Name a trigger ("when the door opens, I shoot"). When it happens, act right away; that uses your reaction.',
  },
  {
    id: 'grapple',
    name: 'Grapple',
    actionType: 'Action',
    description: "Grab a creature so it can't move. Athletics check against the target's Athletics or Acrobatics.",
    roll: { ability: 'str', skill: 'athletics' },
  },
  {
    id: 'shove',
    name: 'Shove',
    actionType: 'Action',
    description: "Push a creature 5 ft away or knock it prone. Athletics check against the target's Athletics or Acrobatics.",
    roll: { ability: 'str', skill: 'athletics' },
  },
  {
    id: 'use-item',
    name: 'Use Item',
    actionType: 'Bonus Action',
    description: 'Drink a potion, read a scroll or use another item from your pack.',
  },
];

export const getDefaultAbility = (id: string): DefaultAbility | undefined => DEFAULT_ABILITIES.find(a => a.id === id);
