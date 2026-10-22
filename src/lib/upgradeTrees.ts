import { z } from "zod";
import {
  DAMAGE_TYPES, SPELL_DAMAGE_TYPES, WEAPON_TYPES, baseItemName, buildPlayStyleProfile, getUpgradeKind, getUpgradeTier,
  getUpgradeXp, resolveUpgradeXp, statKey,
  type Crawler, type CrawlerStatsById, type InventoryItem, type ItemUpgrade, type Spell, type StatModifiers, type UpgradeDrawback,
  type UpgradeEffect, type UpgradeKind, type UpgradePath, type UpgradeStep, type UpgradeTree, type WeaponDie,
} from "@/lib/gameData";
import { UPGRADE_EFFECTS_FOR, describeUpgradeDrawback, describeUpgradeEffect, resolveKnownSpell } from "@/lib/upgrades";

// When an item or spell crosses an XP milestone the Dungeon AI "meditates": the DM's browser asks the
// online model (the NPC brain's Groq/Gemini keys) for upgrade trees fitted to the crawler's play style.
// Every reply is checked against the effect menu and the power limits below before a player sees it;
// a bad reply is retried once with the error, then preset trees are used instead.

export const MEDITATING_TEXT = 'The Dungeon AI is meditating on your accomplishments, crawler.';
export const FULLY_EVOLVED_ACHIEVEMENT = { name: 'Fully Evolved', description: 'Finished all 3 steps of an upgrade tree' };
export const TREE_STEPS = 3;

const DIE_SIDES = [4, 6, 8, 10, 12, 20] as const;
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'cha', 'maxHP', 'maxMana', 'moveSpeed'] as const;
const DEFENSE_TYPES = [...DAMAGE_TYPES, ...WEAPON_TYPES] as readonly string[];

// ---- Power limits ----

export interface TierLimits {
  maxStep: number;       // die sizes a dice change may move
  maxDieAvg: number;     // average roll of added dice (1d4 = 2.5, 2d6 = 7)
  maxRange: number;      // extra feet
  maxStatPoints: number; // +1 ability = 1 point; +5 max HP, +5 max mana or +5 ft speed = 1 point
  maxChance: number;     // on-hit chance %
  maxTurns: number;
  maxArmor: number;      // armor rating and damage reduction
  maxEffects: number;    // effects in one step
}

/** What one step may do at a tier. A cursed bargain gets the next tier's limits. */
export const tierLimits = (tier: number): TierLimits => {
  const t = Math.max(1, Math.round(tier));
  return {
    maxStep: t >= 4 ? 2 : 1,
    maxDieAvg: [2.5, 3.5, 4.5, 7, 9, 11, 13][Math.min(t, 7) - 1],
    maxRange: 10 * t,
    maxStatPoints: t,
    maxChance: Math.min(50, 10 + 5 * t),
    maxTurns: 1 + Math.ceil(t / 2),
    maxArmor: Math.ceil(t / 2),
    maxEffects: 2,
  };
};

const dieAvg = (d?: WeaponDie) => (d ? d.count * (d.sides + 1) / 2 : 0);
const statPoints = (mods: StatModifiers) => Object.entries(mods).reduce((sum, [k, v]) => {
  const n = Math.abs(v ?? 0);
  return sum + (k === 'maxHP' || k === 'maxMana' || k === 'moveSpeed' ? n / 5 : n);
}, 0);

// ---- The exact shape the model must answer with ----

const dieSchema = z.object({
  count: z.number().int().min(1).max(4),
  sides: z.number().int().refine(n => (DIE_SIDES as readonly number[]).includes(n), 'sides must be 4, 6, 8, 10, 12 or 20'),
});
const modsSchema = z.object(Object.fromEntries(STAT_KEYS.map(k => [k, z.number().int().optional()]))).strict();
const effectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dice'), target: z.enum(['damage', 'hit']), step: z.number().int().min(-2).max(2).optional(), addDie: dieSchema.optional() }).strict(),
  z.object({ type: z.literal('property'), rangeFt: z.number().int().min(0).optional(), damageType: z.string().optional(), splash: z.boolean().optional(), durationTurns: z.number().int().min(0).optional() }).strict(),
  z.object({ type: z.literal('stat'), mods: modsSchema }).strict(),
  z.object({ type: z.literal('onHit'), chance: z.number().int().min(1).max(100), condition: z.string().max(30).optional(), turns: z.number().int().min(1).optional(), extraDie: dieSchema.optional() }).strict(),
  z.object({ type: z.literal('action'), name: z.string().min(1).max(40), uses: z.enum(['perCombat', 'perDay', 'atWill']), damage: dieSchema.optional(), text: z.string().max(160).optional() }).strict(),
  z.object({ type: z.literal('defense'), armorRating: z.number().int().min(0).optional(), reduction: z.number().int().min(0).optional(), resist: z.array(z.string()).optional(), vulnerable: z.array(z.string()).optional() }).strict(),
  z.object({ type: z.literal('language'), language: z.string().min(1).max(30) }).strict(),
  z.object({ type: z.literal('strange'), text: z.string().min(1).max(160) }).strict(),
]);
const drawbackSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('statPenalty'), mods: modsSchema }).strict(),
  z.object({ type: z.literal('destroyOnUnequip') }).strict(),
  z.object({ type: z.literal('locked') }).strict(),
  z.object({ type: z.literal('cost'), hp: z.number().int().min(0).max(10).optional(), mana: z.number().int().min(0).max(10).optional() }).strict(),
  z.object({ type: z.literal('strange'), text: z.string().min(1).max(160) }).strict(),
]);
const stepSchema = z.object({
  name: z.string().min(1).max(40),
  flavor: z.string().max(160).optional(),
  newName: z.string().min(1).max(40).optional(),
  effects: z.array(effectSchema).min(1),
  drawback: drawbackSchema.optional(),
}).strict();
const treeSchema = z.object({ name: z.string().min(1).max(40), pitch: z.string().max(200).optional(), steps: z.array(stepSchema).length(TREE_STEPS) }).strict();
const replySchema = z.object({ trees: z.array(treeSchema).min(2).max(3) }).strict();

/** Power-limit problems with one step claimed at `tier`, in words the model can act on. */
const stepProblems = (step: UpgradeStep, kind: UpgradeKind, tier: number): string[] => {
  const cursed = !!step.drawback;
  const lim = tierLimits(cursed ? tier + 1 : tier);
  const where = `step "${step.name}" (tier ${tier}${cursed ? ', cursed so tier ' + (tier + 1) + ' limits' : ''})`;
  const out: string[] = [];
  if (step.effects.length > lim.maxEffects) out.push(`${where} has ${step.effects.length} effects; at most ${lim.maxEffects}`);
  if (kind !== 'spell' && kind !== 'weapon' && step.drawback?.type === 'cost') out.push(`${where}: a "cost" drawback only works on weapons and spells`);
  if (kind === 'spell' && (step.drawback?.type === 'locked' || step.drawback?.type === 'destroyOnUnequip' || step.drawback?.type === 'statPenalty')) out.push(`${where}: spells can't be equipped, so use a "cost" or "strange" drawback`);
  for (const e of step.effects) {
    if (!UPGRADE_EFFECTS_FOR[kind].includes(e.type)) { out.push(`${where}: "${e.type}" effects don't work on ${kind === 'gear' ? 'this item' : kind + 's'}`); continue; }
    switch (e.type) {
      case 'dice':
        if (Math.abs(e.step ?? 0) > lim.maxStep) out.push(`${where}: step ${e.step} is over the limit of ${lim.maxStep}`);
        if (dieAvg(e.addDie) > lim.maxDieAvg) out.push(`${where}: added dice average ${dieAvg(e.addDie)}, limit ${lim.maxDieAvg}`);
        if (!e.step && !e.addDie) out.push(`${where}: a dice effect needs step or addDie`);
        break;
      case 'property':
        if ((e.rangeFt ?? 0) > lim.maxRange) out.push(`${where}: +${e.rangeFt} ft is over the ${lim.maxRange} ft limit`);
        if (e.damageType && !(kind === 'spell' ? SPELL_DAMAGE_TYPES : DAMAGE_TYPES as readonly string[]).includes(e.damageType)) out.push(`${where}: unknown damage type "${e.damageType}"`);
        if ((e.durationTurns ?? 0) > lim.maxTurns) out.push(`${where}: +${e.durationTurns} turns is over the limit of ${lim.maxTurns}`);
        if (e.durationTurns && kind !== 'spell') out.push(`${where}: durationTurns only works on spells`);
        break;
      case 'stat':
        if (Object.values(e.mods).some(v => (v ?? 0) < 0)) out.push(`${where}: stat bonuses must be positive (put penalties in a drawback)`);
        if (statPoints(e.mods) > lim.maxStatPoints) out.push(`${where}: stat bonus worth ${statPoints(e.mods)} points, limit ${lim.maxStatPoints}`);
        break;
      case 'onHit':
        if (e.chance > lim.maxChance) out.push(`${where}: ${e.chance}% chance is over the ${lim.maxChance}% limit`);
        if ((e.turns ?? 0) > lim.maxTurns) out.push(`${where}: ${e.turns} turns is over the limit of ${lim.maxTurns}`);
        if (dieAvg(e.extraDie) > lim.maxDieAvg) out.push(`${where}: extra dice average ${dieAvg(e.extraDie)}, limit ${lim.maxDieAvg}`);
        if (!e.condition && !e.extraDie) out.push(`${where}: an onHit effect needs a condition or extraDie`);
        break;
      case 'action':
        if (dieAvg(e.damage) > lim.maxDieAvg * 2) out.push(`${where}: action damage average ${dieAvg(e.damage)}, limit ${lim.maxDieAvg * 2}`);
        if (e.uses === 'atWill' && e.damage) out.push(`${where}: a damaging action can't be at will`);
        break;
      case 'defense':
        if ((e.armorRating ?? 0) > lim.maxArmor) out.push(`${where}: +${e.armorRating} armor rating is over the limit of ${lim.maxArmor}`);
        if ((e.reduction ?? 0) > lim.maxArmor) out.push(`${where}: reduction ${e.reduction} is over the limit of ${lim.maxArmor}`);
        if ((e.resist?.length ?? 0) > 1) out.push(`${where}: at most 1 resistance per step`);
        for (const t of [...(e.resist ?? []), ...(e.vulnerable ?? [])]) if (!DEFENSE_TYPES.includes(t)) out.push(`${where}: unknown damage or weapon type "${t}"`);
        break;
      default:
        break;
    }
  }
  if (step.drawback?.type === 'statPenalty' && statPoints(step.drawback.mods) < 1) out.push(`${where}: the stat penalty must be at least 1 point`);
  return out;
};

/** Every problem with a set of trees offered at `tier` (step i is claimed at tier + i). Empty when they're fine. */
export const treeProblems = (trees: UpgradeTree[], kind: UpgradeKind, tier: number): string[] => {
  const out: string[] = [];
  let cursed = 0;
  for (const tree of trees) {
    if (tree.steps.filter(s => s.effects.some(e => e.type === 'strange')).length > 1) out.push(`tree "${tree.name}" has more than one strange effect`);
    tree.steps.forEach((step, i) => {
      if (step.drawback) cursed++;
      out.push(...stepProblems(step, kind, tier + i));
    });
  }
  if (cursed > 1) out.push(`${cursed} cursed bargains offered; at most 1 across all trees`);
  return out;
};

/** Reads the model's reply: JSON (fenced or not) in the exact shape, within the power limits. */
export const parseUpgradeTrees = (text: string, kind: UpgradeKind, tier: number): { trees: UpgradeTree[] } | { error: string } => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return { error: 'The reply had no JSON object.' };
  let raw: unknown;
  try { raw = JSON.parse(text.slice(start, end + 1)); } catch (e) { return { error: `The JSON didn't parse: ${(e as Error).message}` }; }
  const parsed = replySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.slice(0, 6).map(i => `${i.path.join('.') || 'reply'}: ${i.message}`).join('; ') };
  }
  const trees = parsed.data.trees as UpgradeTree[];
  const problems = treeProblems(trees, kind, tier);
  return problems.length ? { error: problems.slice(0, 8).join('; ') } : { trees };
};

// ---- The prompt ----

const KIND_WORDS: Record<UpgradeKind, string> = { weapon: 'weapon', armor: 'piece of armor', gear: 'piece of gear (ring, amulet or hand item)', spell: 'spell', none: 'item' };

const effectMenu = (kind: UpgradeKind) => {
  const lines: Record<string, string> = {
    dice: '{"type":"dice","target":"damage"|"hit","step":1,"addDie":{"count":1,"sides":4}}  step moves the first die up sizes (d4,d6,d8,d10,d12,d20); addDie adds dice. Use either or both.',
    property: `{"type":"property","rangeFt":10,"damageType":"Fire","splash":true${kind === 'spell' ? ',"durationTurns":1' : ''}}  any subset. Damage types: ${(kind === 'spell' ? SPELL_DAMAGE_TYPES : DAMAGE_TYPES).join(', ')}.`,
    stat: '{"type":"stat","mods":{"str":1}}  bonus while equipped. Keys: str, dex, con, int, cha, maxHP, maxMana, moveSpeed (feet).',
    onHit: '{"type":"onHit","chance":20,"condition":"Burning","turns":2,"extraDie":{"count":1,"sides":4}}  condition and/or extraDie.',
    action: '{"type":"action","name":"Shatter Swing","uses":"perCombat"|"perDay"|"atWill","damage":{"count":2,"sides":6},"text":"Hits everyone within 5 ft"}',
    defense: `{"type":"defense","armorRating":1,"reduction":1,"resist":["Bows"],"vulnerable":["Fire"]}  armor rating adds to the wearer's DC; resist halves and vulnerable doubles damage of those types. Types: ${DEFENSE_TYPES.join(', ')}.`,
    language: '{"type":"language","language":"beast"}  speak a language while equipped.',
    strange: '{"type":"strange","text":"Whispers the name of the nearest hidden mob once per day"}  anything odd; the DM rules on it. At most one per tree.',
  };
  return UPGRADE_EFFECTS_FOR[kind].map(t => `- ${lines[t]}`).join('\n');
};

const limitsText = (tier: number) => [0, 1, 2].map(i => {
  const l = tierLimits(tier + i);
  return `Step ${i + 1} (tier ${tier + i}): dice step ≤${l.maxStep}, added dice average ≤${l.maxDieAvg}, action damage average ≤${l.maxDieAvg * 2}, range ≤+${l.maxRange} ft, stat points ≤${l.maxStatPoints}, on-hit chance ≤${l.maxChance}%, turns ≤${l.maxTurns}, armor rating/reduction ≤${l.maxArmor}, ≤${l.maxEffects} effects.`;
}).join('\n');

export interface UpgradePromptInput {
  kind: UpgradeKind;
  tier: number;
  item: InventoryItem | Spell;
  upgrades?: ItemUpgrade[];
  profile: Record<string, unknown>; // buildPlayStyleProfile output
}

/** The system and user messages for one meditation. */
export const buildUpgradePrompt = ({ kind, tier, item, upgrades, profile }: UpgradePromptInput): { system: string; user: string } => {
  const system = [
    'You are the Dungeon AI from Dungeon Crawler Carl: a sarcastic, theatrical game-show host who rewards crawlers for entertaining violence.',
    `A crawler's ${KIND_WORDS[kind]} has reached a milestone. Design upgrade trees for it, fitted to how this crawler actually plays.`,
    'Answer with JSON only, no other text, in exactly this shape:',
    '{"trees":[{"name":"Executioner","pitch":"one line in your voice","steps":[{"name":"Heavy Edge","flavor":"one short line","newName":"optional new item name","effects":[...],"drawback":{...}}, ...3 steps]}, ...]}',
    'Rules:',
    '- Exactly 3 trees: one that leans into the crawler\'s play style, one that patches a weakness, and one wild card.',
    '- Each tree has exactly 3 steps. Steps are claimed one milestone apart, so later steps can be stronger.',
    '- 1 or 2 effects per step, from this menu only (exact fields, integers only):',
    effectMenu(kind),
    '- Power limits (the game rejects anything over them):',
    limitsText(tier),
    '- A step may be a cursed bargain: add a "drawback" and it may use the NEXT tier\'s limits. At most one cursed step across all trees, usually in the wild card. Drawbacks:',
    kind === 'spell'
      ? '  {"type":"cost","mana":1} or {"type":"cost","hp":2}, or {"type":"strange","text":"..."}'
      : `  {"type":"statPenalty","mods":{"dex":1}} (taken off), {"type":"destroyOnUnequip"}, {"type":"locked"}${kind === 'weapon' ? ', {"type":"cost","hp":2}' : ''}, {"type":"strange","text":"..."}`,
    '- "newName" is optional: rename the item when a step changes it a lot (usually the last step). Keep names under 40 characters.',
    '- Don\'t repeat an upgrade the item already has. Keep it funny, a little cruel, and playable.',
  ].join('\n');
  const user = JSON.stringify({
    milestone: `tier ${tier}`,
    [kind === 'spell' ? 'spell' : 'item']: compactItem(item),
    existingUpgrades: (upgrades ?? []).map(u => ({ name: u.name, effects: u.effects.map(describeUpgradeEffect), drawback: u.drawback ? describeUpgradeDrawback(u.drawback) : undefined })),
    crawler: profile,
  });
  return { system, user };
};

const compactItem = (item: InventoryItem | Spell) => {
  if ('spellData' in item) {
    const sd = item.spellData;
    return { name: item.name, description: item.description, school: sd.school, level: sd.spellLevel, manaCost: sd.manaCost, range: sd.range, target: sd.target, damage: sd.damageDice, damageType: sd.damageType, special: sd.specialEffect };
  }
  return {
    name: baseItemName(item), description: item.description, slot: item.equipSlot, rarity: item.rarity, effects: item.effects,
    statBonuses: item.statModifiers, weapon: item.weaponData && { type: item.weaponData.weaponType, damage: item.weaponData.damageDice, damageType: item.weaponData.damageType, hitDie: item.weaponData.hitDie, ranged: item.weaponData.isRanged, range: item.weaponData.normalRange },
    armor: item.armorData,
  };
};

// ---- Preset trees, used when the AI can't answer ----

const s = (name: string, flavor: string, effects: UpgradeEffect[], drawback?: UpgradeDrawback, newName?: string): UpgradeStep =>
  ({ name, flavor, effects, ...(drawback ? { drawback } : {}), ...(newName ? { newName } : {}) });

const PRESETS: Record<Exclude<UpgradeKind, 'none'>, UpgradeTree[]> = {
  weapon: [
    { name: 'Heavy Hand', pitch: 'Subtlety is for people who lose.', steps: [
      s('Heavier Head', 'Someone added lead. You can tell.', [{ type: 'dice', target: 'damage', step: 1 }]),
      s('Back Muscles', 'Swinging this is a workout plan.', [{ type: 'stat', mods: { str: 1 } }]),
      s('Crushing Blow', 'Once a fight, make it count.', [{ type: 'action', name: 'Crushing Blow', uses: 'perCombat', damage: { count: 1, sides: 8 } }]),
    ] },
    { name: 'Keen Edge', pitch: 'Hit things. Hit them more often.', steps: [
      s('True Aim', 'It wants to land.', [{ type: 'dice', target: 'hit', addDie: { count: 1, sides: 4 } }]),
      s('Bleeder', 'Shallow cuts, deep regrets.', [{ type: 'onHit', chance: 15, extraDie: { count: 1, sides: 4 } }]),
      s('Honed', 'The edge sings a little.', [{ type: 'dice', target: 'damage', addDie: { count: 1, sides: 4 } }]),
    ] },
    { name: 'Wild Card', pitch: 'The audience demanded something stupid.', steps: [
      s('Ember Kiss', 'Warm to the touch. Too warm.', [{ type: 'onHit', chance: 15, condition: 'Burning', turns: 1 }]),
      s('Gossip', 'It hums when a coward is about to run.', [{ type: 'strange', text: 'Hums a little tune when an enemy is about to flee' }]),
      s('Hungry Steel', 'It bites back.', [{ type: 'dice', target: 'damage', step: 2 }], { type: 'cost', hp: 1 }, 'The Hungry One'),
    ] },
  ],
  armor: [
    { name: 'Bulwark', pitch: 'Be the wall. Walls rarely die.', steps: [
      s('Thick Plates', 'Extra padding in all the wrong places.', [{ type: 'defense', armorRating: 1 }]),
      s('Shock Lining', 'Takes the edge off.', [{ type: 'defense', reduction: 1 }]),
      s('Iron Lungs', 'Breathing is optional now.', [{ type: 'stat', mods: { con: 1 } }]),
    ] },
    { name: 'Warden', pitch: 'Pick your enemy. Ignore them.', steps: [
      s('Tight Weave', 'Arrows bounce. Mostly.', [{ type: 'defense', resist: ['Bows'] }]),
      s('Second Wind', 'More of you to hit.', [{ type: 'stat', mods: { maxHP: 5 } }]),
      s('Hardened', 'It has seen things.', [{ type: 'defense', armorRating: 1 }]),
    ] },
    { name: 'Wild Card', pitch: 'Fashion is pain.', steps: [
      s('Squeaky', 'It squeaks when sneaking is a bad idea.', [{ type: 'strange', text: 'Squeaks loudly whenever sneaking would be a bad idea' }]),
      s('Dashing', 'The crowd loves it.', [{ type: 'stat', mods: { cha: 1 } }]),
      s('Clingy', "It doesn't want to let go.", [{ type: 'defense', armorRating: 2 }], { type: 'locked' }, 'The Clingy One'),
    ] },
  ],
  gear: [
    { name: 'Focus', pitch: 'Small trinket, big ego.', steps: [
      s('Polished', 'Shinier. Somehow smarter.', [{ type: 'stat', mods: { int: 1 } }]),
      s('Wellspring', 'A little extra in the tank.', [{ type: 'stat', mods: { maxMana: 5 } }]),
      s('Lucky Break', 'Once a day, the dice owe you.', [{ type: 'action', name: 'Lucky Break', uses: 'perDay', text: 'Reroll one d20 and keep the better roll' }]),
    ] },
    { name: 'Vigor', pitch: 'Stay alive. Ratings love a survivor.', steps: [
      s('Steady Pulse', 'Your heart keeps time.', [{ type: 'stat', mods: { con: 1 } }]),
      s('Hardy', 'Harder to kill.', [{ type: 'stat', mods: { maxHP: 5 } }]),
      s('Quick Feet', 'Run, crawler, run.', [{ type: 'stat', mods: { moveSpeed: 10 } }]),
    ] },
    { name: 'Wild Card', pitch: 'Nobody asked for this.', steps: [
      s('Chatty', 'It has opinions.', [{ type: 'strange', text: 'Whispers unhelpful advice at the worst moments' }]),
      s('Charming', 'People like you more. People are wrong.', [{ type: 'stat', mods: { cha: 1 } }]),
      s('Devil\'s Due', 'Power, with a catch.', [{ type: 'stat', mods: { str: 2, dex: 2 } }], { type: 'statPenalty', mods: { con: 1 } }, 'Devil\'s Due'),
    ] },
  ],
  spell: [
    { name: 'Amplify', pitch: 'Louder. Bigger. Worse for them.', steps: [
      s('Overcharge', 'More juice.', [{ type: 'dice', target: 'damage', step: 1 }]),
      s('Lingering', 'It sticks around.', [{ type: 'property', durationTurns: 1 }]),
      s('Cascade', 'One more die, because why not.', [{ type: 'dice', target: 'damage', addDie: { count: 1, sides: 4 } }]),
    ] },
    { name: 'Reach', pitch: 'Hurt them from the cheap seats.', steps: [
      s('Long Cast', 'Further away is safer.', [{ type: 'property', rangeFt: 10 }]),
      s('Spillover', 'Neighbors get some too.', [{ type: 'property', splash: true }]),
      s('Afterburn', 'A little extra sting.', [{ type: 'onHit', chance: 15, extraDie: { count: 1, sides: 4 } }]),
    ] },
    { name: 'Wild Card', pitch: 'The producers are bored.', steps: [
      s('Scorch', 'Everything is flammable if you try.', [{ type: 'onHit', chance: 15, condition: 'Burning', turns: 1 }]),
      s('Showboat', 'It plays its own theme music.', [{ type: 'strange', text: 'Plays a short theme song whenever it is cast' }]),
      s('Blood Price', 'It costs more than mana.', [{ type: 'dice', target: 'damage', step: 2 }], { type: 'cost', hp: 2 }),
    ] },
  ],
};

/** Ready-made trees for when the AI is unavailable or keeps answering badly. */
export const presetUpgradeTrees = (kind: UpgradeKind): UpgradeTree[] => (kind === 'none' ? [] : JSON.parse(JSON.stringify(PRESETS[kind])));

/** Turns a tree step into an upgrade record. */
export const stepToUpgrade = (step: UpgradeStep, treeName: string, source: ItemUpgrade['source']): ItemUpgrade => ({
  id: crypto.randomUUID(),
  name: step.name,
  ...(step.flavor ? { flavor: step.flavor } : {}),
  ...(step.newName ? { newName: step.newName } : {}),
  effects: step.effects,
  ...(step.drawback ? { drawback: step.drawback } : {}),
  source,
  treeName,
  appliedAt: new Date().toISOString(),
});

// ---- Milestones ----

/** A meditation stuck this long (the DM's tab closed mid-request) is picked up again. */
export const MEDITATION_STALE_MS = 2 * 60_000;

export interface DueUpgrade {
  key: string;            // crawlerId + target, for de-duplicating work
  crawlerId: string;
  crawlerName: string;
  target: { kind: 'item' | 'spell'; id: string };
  targetName: string;
  kind: UpgradeKind;
  tier: number;           // the tier its XP has reached
  path: UpgradePath;
  item: InventoryItem | Spell;
  upgrades: ItemUpgrade[];
  /** advance: a new milestone was reached and nothing is waiting on it. meditate: trees are being written. */
  action: 'advance' | 'meditate';
}

const pathOf = (p?: UpgradePath): UpgradePath => p ?? { tiersUsed: 0 };

/** Items and known spells that need the Dungeon AI: a milestone nobody has acted on, or a meditation in progress. */
export const findDueUpgrades = (
  crawlers: Crawler[],
  inventoryOf: (crawlerId: string) => InventoryItem[],
  statsById: CrawlerStatsById,
  library: Spell[],
): DueUpgrade[] => {
  const out: DueUpgrade[] = [];
  const consider = (base: Omit<DueUpgrade, 'action'>) => {
    const { path, tier } = base;
    if (path.status === 'meditating') out.push({ ...base, action: 'meditate' });
    else if (!path.status && tier > path.tiersUsed) out.push({ ...base, action: 'advance' });
  };
  for (const c of crawlers) {
    const stats = statsById[c.id];
    for (const item of inventoryOf(c.id)) {
      const kind = getUpgradeKind(item);
      const { enabled, milestones } = resolveUpgradeXp(kind, item.upgradeXp);
      if (!enabled || kind === 'none') continue;
      const xp = getUpgradeXp(kind, item.upgradeXp, stats?.items?.[statKey(item.id)]).total;
      consider({
        key: `${c.id}|item|${item.id}`, crawlerId: c.id, crawlerName: c.name, target: { kind: 'item', id: item.id },
        targetName: baseItemName(item), kind, tier: getUpgradeTier(xp, milestones).tier, path: pathOf(item.upgradePath),
        item, upgrades: item.upgrades ?? [],
      });
    }
    for (const ks of c.knownSpells ?? []) {
      const spell = resolveKnownSpell(ks, library);
      if (!spell) continue;
      const { enabled, milestones } = resolveUpgradeXp('spell', spell.upgradeXp);
      if (!enabled) continue;
      const xp = getUpgradeXp('spell', spell.upgradeXp, stats?.spells?.[statKey(ks.spellId)], ks.castCount).total;
      consider({
        key: `${c.id}|spell|${ks.spellId}`, crawlerId: c.id, crawlerName: c.name, target: { kind: 'spell', id: ks.spellId },
        targetName: ks.spellName, kind: 'spell', tier: getUpgradeTier(xp, milestones).tier, path: pathOf(ks.upgradePath),
        item: spell, upgrades: ks.upgrades ?? [],
      });
    }
  }
  return out;
};

/** The play-style profile sent with a meditation, with this item's own numbers. */
export const meditationProfile = (due: DueUpgrade, crawlers: Crawler[], statsById: CrawlerStatsById) => {
  const crawler = crawlers.find(c => c.id === due.crawlerId);
  return crawler ? buildPlayStyleProfile(crawler, crawlers, statsById, { itemId: statKey(due.target.id) }) : {};
};

/** The next step of the picked tree, when there is one. */
export const nextTreeStep = (path?: UpgradePath): UpgradeStep | undefined =>
  path?.tree ? path.tree.steps[path.stepsTaken ?? 0] : undefined;
