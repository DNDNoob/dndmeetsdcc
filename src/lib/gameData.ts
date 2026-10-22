import type { NpcSpeaker } from './npc/speakers.mjs';
export { getMobKind, isBossMob, isPlacementHostile, baseMobId, mapSpeakers } from './npc/speakers.mjs';
import { getMobKind as mobKindOf, isBossMob as mobIsBoss } from './npc/speakers.mjs';
export type { NpcSpeaker } from './npc/speakers.mjs';

export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'feet' | 'leftHand' | 'rightHand' | 'ringFinger' | 'weapon';

export interface EquippedItems {
  head?: string; // Item ID
  chest?: string;
  legs?: string;
  feet?: string;
  leftHand?: string;
  rightHand?: string;
  ringFinger?: string;
  weapon?: string;
}

export interface Crawler {
  id: string;
  name: string;
  race: string;
  job: string;
  level: number;
  hp: number;
  maxHP: number;
  mana: number;
  maxMana: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  cha: number;
  achievements: string;
  gold: number;
  avatar?: string;
  equippedItems?: EquippedItems;
  knownSpells?: KnownSpell[];
  moveSpeed?: number; // feet per combat turn; defaults to DEFAULT_MOVE_SPEED
  activityStats?: CrawlerActivityStats;
  trophies?: CrawlerTrophy[]; // DM-awarded recognition for things that can't be measured automatically
  languages?: string[];   // Language ids this crawler knows; none set = Worldspeech only
  telepathic?: boolean;   // Needed to use Mindspeech (DM sets it)
  translateMode?: TranslateMode; // Translating chat lines for party members who don't know the language
  languageEffects?: LanguageEffect[]; // Spells like Speak with Animals: languages known for a while
  itemLanguages?: string[]; // Worked out from equipped items when crawlers load; not something to save
  backstory?: CrawlerBackstory; // Answers from the character creator; editable on the profile
  usesAbilityPoints?: boolean;  // Made with the character creator: abilities at 0 points (score 10 or less) roll with disadvantage
  xp?: number;                  // Total experience; missing = exactly what `level` needs (crawlers from before XP)
  xpLog?: XPLogEntry[];         // Most recent grants first, capped at XP_LOG_LIMIT
  skills?: Partial<Record<SkillId, number>>; // Old: ranks bought with skill points (now skillXP)
  skillPoints?: number;         // Old: unspent skill points (now skillXPToSpend)
  skillXP?: Partial<Record<SkillId, number>>; // Skill XP per skill; the rank comes from it (getSkillRank)
  skillXPToSpend?: number;      // Skill XP from level-ups, not yet spent on a skill
  abilityPoints?: number;       // Unspent ability points from level-ups
  barterTrades?: number;        // Completed buys and sells with merchants; raises Barter
}

// ======== Character creation ========

export interface CrawlerBackstory {
  profession?: string;
  accomplishment?: string;
  hobby?: string;
  whenWorldEnded?: string; // Where they were when the world ended
  mostImportant?: string;  // The most important person, thing or animal in the world to them
}

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'cha';
export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'cha'];
export const ABILITY_POINTS_TOTAL = 2 * ABILITY_KEYS.length; // 2 points per ability
export const ABILITY_POINTS_MAX = 5;                          // No ability can start above 5 points

// Each ability point adds +1 to rolls: the score is 10 + 2 per point, so the usual (score - 10) / 2 modifier equals the points
export const abilityScoreFromPoints = (points: number): number => 10 + 2 * points;

export const NEW_CRAWLER_HP = 25;
export const NEW_CRAWLER_MANA = 3;

// Abilities with 0 points roll with disadvantage (only for crawlers made with the character creator)
export const rollsWithDisadvantage = (crawler: Pick<Crawler, 'usesAbilityPoints'> | null | undefined, effectiveScore: number): boolean =>
  !!crawler?.usesAbilityPoints && effectiveScore <= 10;

// A d20 roll, or two taking the lower one with disadvantage. results and diceLabel are what the dice history shows.
export const rollD20 = (disadvantage = false): { rawRoll: number; results: { dice: string; result: number }[]; diceLabel?: string } => {
  const first = Math.floor(Math.random() * 20) + 1;
  if (!disadvantage) return { rawRoll: first, results: [{ dice: 'D20', result: first }] };
  const second = Math.floor(Math.random() * 20) + 1;
  const low = Math.min(first, second);
  return {
    rawRoll: low,
    results: [{ dice: 'D20 (Dis)', result: low }, { dice: 'D20 (other)', result: Math.max(first, second) }],
    diceLabel: '2d20 low',
  };
};

// ======== Experience, levels and skills ========

// Starting XP amounts; the DM scales all of them with the campaign's XP scale
export const XP_REWARDS = {
  damagePer2: 1,        // per 2 damage dealt to hostile mobs
  killPerMobLevel: 5,   // killing blow: 5 × the mob's level
  survived: 2,          // above 0 HP when combat ends
  finisher: 10,         // took down the last mob standing
  nearDeath: 5,         // HP dropped below 10% of max
  questDefault: 10,     // a quest with no XP set
  masteryLevelUp: 20,   // a spell mastery or Looting level up
} as const;
// Each level adds 5% of max HP and max mana, rounded up (so always at least +1)
export const LEVEL_UP_GROWTH = 0.05;
export const getLevelUpIncrease = (max: number): number => Math.max(1, Math.ceil(Math.max(0, max) * LEVEL_UP_GROWTH));
export const XP_LOG_LIMIT = 20;
export const XP_SCALE_OPTIONS = [0.5, 0.75, 1, 1.5, 2] as const;

export interface XPLogEntry {
  amount: number;
  reason: string;
  at: number; // epoch ms
}

/** Total XP needed to reach `level`: 50 × L × (L − 1), so each level costs 100 more than the last. No cap. */
export const getXPForLevel = (level: number): number => {
  const l = Math.max(1, Math.floor(level));
  return 50 * l * (l - 1);
};

export const getLevelForXP = (xp: number): number => {
  let level = 1;
  while (getXPForLevel(level + 1) <= xp) level++;
  return level;
};

/** A crawler's total XP; crawlers from before XP count as having exactly their level's XP. */
export const getCrawlerXP = (crawler: Pick<Crawler, 'xp' | 'level'>): number =>
  crawler.xp ?? getXPForLevel(crawler.level || 1);

export type SkillId =
  | 'acrobatics' | 'animalHandling' | 'athletics' | 'deception' | 'intimidation' | 'medicine' | 'performance'
  | 'persuasion' | 'sleightOfHand' | 'stealth' | 'survival' | 'arcana' | 'perception'
  | 'religion' | 'nature' | 'investigation' | 'history' | 'memory' | 'science'
  | 'barter';

/**
 * roll: earns skill XP from successful checks. knowledge: only from skill XP spent at level-ups.
 * trade: earns skill XP from trading with merchants. Every kind can also take spent skill XP.
 */
export type SkillKind = 'roll' | 'knowledge' | 'trade';

export interface SkillDef {
  id: SkillId;
  name: string;
  ability: AbilityKey;
  kind: SkillKind;
  description: string;
}

const checks = (what: string) => `+1 per rank to ${what} checks.`;
export const SKILLS: SkillDef[] = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'dex', kind: 'roll', description: checks('balance, tumble and dodge') },
  { id: 'animalHandling', name: 'Animal Handling', ability: 'cha', kind: 'roll', description: checks('calm, tame and ride') },
  { id: 'athletics', name: 'Athletics', ability: 'str', kind: 'roll', description: `${checks('climb, jump and grapple')} Every 3 ranks add +5 ft of movement.` },
  { id: 'deception', name: 'Deception', ability: 'cha', kind: 'roll', description: checks('lie and bluff') },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha', kind: 'roll', description: checks('threaten') },
  { id: 'medicine', name: 'Medicine', ability: 'int', kind: 'roll', description: `${checks('treat and diagnose')} Also +1 HP per rank on every heal you give.` },
  { id: 'performance', name: 'Performance', ability: 'cha', kind: 'roll', description: checks('perform and entertain') },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha', kind: 'roll', description: `${checks('persuade')} Also adds to haggle rolls.` },
  { id: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dex', kind: 'roll', description: checks('pickpocket, palm and pick locks') },
  { id: 'stealth', name: 'Stealth', ability: 'dex', kind: 'roll', description: checks('sneak and hide') },
  { id: 'survival', name: 'Survival', ability: 'con', kind: 'roll', description: checks('track, forage and endure') },
  { id: 'arcana', name: 'Arcana', ability: 'int', kind: 'roll', description: checks('magic lore') },
  { id: 'perception', name: 'Perception', ability: 'int', kind: 'roll', description: checks('spot, search and sense-lies') },
  { id: 'religion', name: 'Religion', ability: 'int', kind: 'knowledge', description: checks('religion') },
  { id: 'nature', name: 'Nature', ability: 'int', kind: 'knowledge', description: checks('nature') },
  { id: 'investigation', name: 'Investigation', ability: 'int', kind: 'knowledge', description: checks('investigation') },
  { id: 'history', name: 'History', ability: 'int', kind: 'knowledge', description: checks('history') },
  { id: 'memory', name: 'Memory', ability: 'int', kind: 'knowledge', description: checks('memory') },
  { id: 'science', name: 'Science & Engineering', ability: 'int', kind: 'knowledge', description: checks('science, engineering and technology') },
  { id: 'barter', name: 'Barter', ability: 'cha', kind: 'trade', description: 'Every 2 ranks lower a merchant\'s Scrooge factor by 1 for you, and each rank adds +1 to haggle rolls. Earns skill XP as you buy and sell.' },
];
export const MAX_SKILL_RANK = 10;

// ---- Skill XP ----
// A skill's rank comes from its skill XP. Rank N needs 25·N·(N+1) XP in total (50, 150, 300, 500…),
// so each rank costs more than the last. XP is never reset: spending XP adds to what a skill earned.
export const SKILL_XP_PER_SUCCESS = 5;   // a successful check with a roll skill
export const SKILL_XP_PER_TRADE = 5;     // a buy or sell (Barter)
export const SKILL_XP_PER_LEVEL = 100;   // skill XP to spend, from each character level-up

export const getSkillXPForRank = (rank: number): number => {
  const r = Math.max(0, Math.min(MAX_SKILL_RANK, Math.floor(rank)));
  return 25 * r * (r + 1);
};
export const MAX_SKILL_XP = getSkillXPForRank(MAX_SKILL_RANK);

export const getSkillRankForXP = (xp: number): number => {
  let rank = 0;
  while (rank < MAX_SKILL_RANK && xp >= getSkillXPForRank(rank + 1)) rank++;
  return rank;
};

type SkillCrawler = Pick<Crawler, 'skills' | 'skillXP' | 'barterTrades' | 'skillPoints' | 'skillXPToSpend'>;

/** A skill's XP. Crawlers from before skill XP count their bought ranks (and Barter their trades). */
export const getSkillXP = (crawler: SkillCrawler | null | undefined, id: SkillId): number => {
  if (!crawler) return 0;
  const stored = crawler.skillXP?.[id];
  if (stored !== undefined) return Math.max(0, Math.min(MAX_SKILL_XP, stored));
  const legacy = id === 'barter'
    ? SKILL_XP_PER_TRADE * (crawler.barterTrades ?? 0)
    : getSkillXPForRank(crawler.skills?.[id] ?? 0);
  return Math.min(MAX_SKILL_XP, legacy);
};

export const getSkillRank = (crawler: SkillCrawler | null | undefined, id: SkillId): number =>
  getSkillRankForXP(getSkillXP(crawler, id));

/** Skill XP left to spend. Unspent skill points from before skill XP are worth a level's skill XP each. */
export const getSkillXPToSpend = (crawler: SkillCrawler | null | undefined): number =>
  Math.max(0, crawler?.skillXPToSpend ?? (crawler?.skillPoints ?? 0) * SKILL_XP_PER_LEVEL);

/** Every skill's XP as stored, filling in crawlers from before skill XP, plus `id` changed by `delta`. */
export const withSkillXP = (crawler: SkillCrawler, id: SkillId, delta: number): Partial<Record<SkillId, number>> => {
  const all: Partial<Record<SkillId, number>> = {};
  for (const s of SKILLS) {
    const xp = getSkillXP(crawler, s.id);
    if (xp > 0) all[s.id] = xp;
  }
  all[id] = Math.max(0, Math.min(MAX_SKILL_XP, (all[id] ?? 0) + delta));
  return all;
};

/** The skill a roll label belongs to, e.g. "Stealth" or "Stealth check (rank 2)". */
export const skillForLabel = (label: string): SkillDef | undefined =>
  SKILLS.find(s => label === s.name || label.startsWith(`${s.name} check`));

/** Scrooge levels a crawler's Barter takes off: 1 per 2 ranks. */
export const getBarterScroogeReduction = (barterRank: number): number => Math.floor(barterRank / 2);

// ======== Languages ========

/** off: not translating. auto: lines pass on to the party as said. review: the translator passes each line on (or twists it) first. */
export type TranslateMode = 'off' | 'auto' | 'review';

/**
 * A language a crawler knows for a while, from casting a spell. It ends when a countdown it has
 * reaches 0: noncombat turns tick at each new noncombat turn, combat rounds at each new round. A spell
 * timed only in combat rounds also ends at the next noncombat turn (an hour passes). With neither, it
 * lasts until the DM or the crawler ends it. questionsLeft (Speak with Dead) only limits speaking:
 * at 0 the crawler can't talk in the language any more but still understands the last answer.
 */
export interface LanguageEffect {
  id: string;
  name: string;          // the spell, e.g. "Speak with Animals"
  spellId?: string;
  languageId: string;
  noncombatTurnsLeft?: number;
  combatRoundsLeft?: number;
  questionsLeft?: number;
}

/** A language someone made up: rooms/{roomId}/languages/{id}. Built-in languages live in src/lib/languageList.mjs. */
export interface CustomLanguage {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;          // Firebase uid
  createdByCrawlerId?: string; // the crawler who made it (they know it from the start)
  createdAt?: number;
}

// A trophy the DM awards by hand. Awarding the same name again increments count.
export interface CrawlerTrophy {
  id: string;
  name: string;
  description?: string;
  count: number;
  awardedAt: string; // ISO timestamp of the most recent award
}

// Default movement speed (feet per combat turn) when a crawler has none set
export const DEFAULT_MOVE_SPEED = 60;

// The crawler a crawler picker should open on: the viewer's own crawler, else the first one
export const getInitialCrawlerId = (crawlers: Crawler[], currentPlayerId?: string): string =>
  currentPlayerId && crawlers.some(c => c.id === currentPlayerId) ? currentPlayerId : (crawlers[0]?.id || "");

// Episodes point at maps by their position in the campaign's map list ("0", "1", ...).
// When maps are deleted, positions after them shift down, so rewrite an episode's references
// with `remap` (old position -> new position, or null if that map is gone).
// Returns only the changed fields, or null when nothing changes.
export const remapEpisodeMapRefs = (
  episode: Episode,
  remap: (oldId: string) => string | null,
): Pick<Episode, 'mapIds' | 'mobPlacements' | 'crawlerPlacements' | 'mapSettings'> | null => {
  const firstMapId = episode.mapIds[0];
  // Placements saved without a mapId belong to the episode's first map
  const placementMap = (mapId?: string) => remap(mapId || firstMapId || '0');
  const mapIds = episode.mapIds.map(remap).filter((id): id is string => id !== null);
  const mobPlacements = (episode.mobPlacements || [])
    .map(p => ({ ...p, mapId: placementMap(p.mapId) }))
    .filter((p): p is EpisodeMobPlacement => p.mapId !== null);
  const crawlerPlacements = episode.crawlerPlacements
    ?.map(p => ({ ...p, mapId: placementMap(p.mapId) }))
    .filter((p): p is CrawlerPlacement => p.mapId !== null);
  const mapSettings = episode.mapSettings
    ? Object.fromEntries(
        Object.entries(episode.mapSettings)
          .map(([k, v]) => [remap(k), v] as const)
          .filter((e): e is readonly [string, MapSettings] => e[0] !== null),
      )
    : undefined;
  const changed =
    JSON.stringify(mapIds) !== JSON.stringify(episode.mapIds) ||
    JSON.stringify(mobPlacements) !== JSON.stringify(episode.mobPlacements || []) ||
    JSON.stringify(crawlerPlacements) !== JSON.stringify(episode.crawlerPlacements) ||
    JSON.stringify(mapSettings) !== JSON.stringify(episode.mapSettings);
  if (!changed) return null;
  return {
    mapIds,
    mobPlacements,
    ...(crawlerPlacements ? { crawlerPlacements } : {}),
    ...(mapSettings ? { mapSettings } : {}),
  };
};

// Noncombat turns allow this multiple of a crawler's combat movement speed
export const NONCOMBAT_MOVE_MULTIPLIER = 2;

// Activity counters recorded automatically during play
export interface CrawlerActivityStats {
  feetMoved?: number; // total feet moved by the crawler's own player
  damageDealt?: number;
  damageTaken?: number; // hit points lost
  lowHealthCount?: number; // times HP dropped below 10% of max HP
  killingBlows?: number; // mobs brought to 0 HP
  combatEndingBlows?: number; // killing blows that took down the last mob standing
  mobsLooted?: number; // mobs whose loot this crawler shared in (raises their Looting level)
}

export type ActivityStatKey = keyof CrawlerActivityStats;

// Returns a new stats object with each delta added (missing counters start at 0)
export function addActivityStats(stats: CrawlerActivityStats | undefined, deltas: CrawlerActivityStats): CrawlerActivityStats {
  const next: CrawlerActivityStats = { ...(stats ?? {}) };
  for (const [key, val] of Object.entries(deltas) as [ActivityStatKey, number | undefined][]) {
    if (!val) continue;
    next[key] = (next[key] ?? 0) + val;
  }
  return next;
}

// Stat deltas for a crawler's HP going from oldHP to newHP (only HP loss is recorded)
export function getHPLossStats(oldHP: number, newHP: number, maxHP: number): CrawlerActivityStats {
  if (newHP >= oldHP) return {};
  const lowThreshold = maxHP * 0.1;
  return {
    damageTaken: oldHP - newHP,
    lowHealthCount: maxHP > 0 && oldHP >= lowThreshold && newHP < lowThreshold ? 1 : 0,
  };
}

// ---- Crawler stats doc: rooms/{roomId}/crawlerStats/{crawlerId} ----
// Counters the game keeps to learn how each crawler plays (feeds the profile, the DM and AI prompts).
// Kept apart from the crawler doc, which carries the avatar and changes far less often.

/** What dealt damage, healed or left an effect: a weapon or other item, a spell, or a plain attack. */
export interface StatSource {
  kind: 'item' | 'spell';
  id: string;
  name: string;
  damageType?: string;
  weaponType?: string; // a weapon's type, for weapon proficiency
}

/** Counters for one weapon, armor piece or spell. */
export interface SourceStats {
  name?: string;
  uses?: number;          // attack rolls made with it (spells count casts in knownSpells instead)
  hits?: number;          // targets it damaged
  damage?: number;
  kills?: number;         // hostile mobs brought to 0 HP
  bossKills?: number;
  biggestHit?: number;
  healing?: number;
  conditions?: number;    // spell effects left on targets
  friendlyFire?: number;  // damage to other crawlers
  neutralDamage?: number; // damage to mobs that aren't hostile, NPCs included
  neutralKills?: number;
  damageAbsorbed?: number; // armor: for when a damage-reduction rule exists
  hitsDeflected?: number;
  boostedRolls?: number;   // rings and other stat gear: rolls made with an ability the item raises while equipped
}

// ---- Upgrade XP: items and spells level up from what they do ----
// Each XP source is worth a set amount; tiers unlock at the milestones. The DM can change both per
// item or spell, and unset fields use the defaults for that kind of item.

export type UpgradeKind = 'weapon' | 'armor' | 'gear' | 'spell' | 'none';

export const UPGRADE_XP_SOURCES = ['perDamage', 'perKill', 'perBossKill', 'perHealing', 'perCondition', 'perCast', 'perAbsorbed', 'perBoostedRoll'] as const;
export type UpgradeXpSource = typeof UPGRADE_XP_SOURCES[number];

export interface UpgradeXpSettings extends Partial<Record<UpgradeXpSource, number>> {
  enabled?: boolean;
  milestones?: number[]; // total XP for each tier, ascending
}

export const UPGRADE_XP_SOURCE_LABELS: Record<UpgradeXpSource, string> = {
  perDamage: 'per damage dealt',
  perKill: 'per kill',
  perBossKill: 'per boss kill',
  perHealing: 'per HP healed',
  perCondition: 'per effect left on a target',
  perCast: 'per cast',
  perAbsorbed: 'per damage absorbed',
  perBoostedRoll: 'per roll with a stat it raises',
};

export const DEFAULT_UPGRADE_MILESTONES = [50, 150, 300, 500, 750];

export const DEFAULT_UPGRADE_XP: Record<Exclude<UpgradeKind, 'none'>, Partial<Record<UpgradeXpSource, number>>> = {
  weapon: { perDamage: 1, perKill: 10, perBossKill: 25 },
  armor: { perAbsorbed: 1 },
  gear: { perBoostedRoll: 5 },
  spell: { perCast: 5, perDamage: 1, perKill: 10, perBossKill: 25, perHealing: 1, perCondition: 5 },
};

const ARMOR_SLOTS: EquipmentSlot[] = ['head', 'chest', 'legs', 'feet'];

/** What kind of upgradeable thing an item is: weapons, armor, other equippable gear, or nothing (consumables). */
export const getUpgradeKind = (item: Pick<InventoryItem, 'weaponData' | 'equipSlot'>): UpgradeKind => {
  if (item.weaponData) return 'weapon';
  if (!item.equipSlot) return 'none';
  return ARMOR_SLOTS.includes(item.equipSlot) ? 'armor' : 'gear';
};

/** The settings in force: the item's own values over the defaults for its kind. */
export const resolveUpgradeXp = (kind: UpgradeKind, settings?: UpgradeXpSettings): Required<Pick<UpgradeXpSettings, 'enabled' | 'milestones'>> & Partial<Record<UpgradeXpSource, number>> => {
  const defaults = kind === 'none' ? {} : DEFAULT_UPGRADE_XP[kind];
  const rates: Partial<Record<UpgradeXpSource, number>> = {};
  for (const src of UPGRADE_XP_SOURCES) {
    const value = settings?.[src] ?? defaults[src];
    if (value) rates[src] = value;
  }
  const milestones = (settings?.milestones?.length ? settings.milestones : DEFAULT_UPGRADE_MILESTONES).filter(m => m > 0).sort((a, b) => a - b);
  return { ...rates, enabled: settings?.enabled ?? kind !== 'none', milestones };
};

export interface UpgradeXpBreakdown {
  total: number;
  parts: { source: UpgradeXpSource; count: number; xp: number }[];
}

/** XP an item or spell has earned from its counters (`casts` comes from the known spell's cast count). */
export const getUpgradeXp = (kind: UpgradeKind, settings: UpgradeXpSettings | undefined, stats: SourceStats | undefined, casts = 0): UpgradeXpBreakdown => {
  const rates = resolveUpgradeXp(kind, settings);
  const counts: Record<UpgradeXpSource, number> = {
    perDamage: stats?.damage ?? 0,
    perKill: Math.max(0, (stats?.kills ?? 0) - (stats?.bossKills ?? 0)),
    perBossKill: stats?.bossKills ?? 0,
    perHealing: stats?.healing ?? 0,
    perCondition: stats?.conditions ?? 0,
    perCast: casts,
    perAbsorbed: stats?.damageAbsorbed ?? 0,
    perBoostedRoll: stats?.boostedRolls ?? 0,
  };
  const parts = UPGRADE_XP_SOURCES
    .filter(src => rates[src] && counts[src])
    .map(src => ({ source: src, count: counts[src], xp: counts[src] * (rates[src] ?? 0) }));
  return { total: parts.reduce((sum, p) => sum + p.xp, 0), parts };
};

export interface UpgradeTierProgress {
  tier: number;          // milestones reached
  maxTier: number;
  floor: number;         // XP where the current tier started
  next: number | null;   // XP for the next tier, null once every milestone is reached
}

export const getUpgradeTier = (xp: number, milestones: number[]): UpgradeTierProgress => {
  const tier = milestones.filter(m => xp >= m).length;
  return { tier, maxTier: milestones.length, floor: tier > 0 ? milestones[tier - 1] : 0, next: milestones[tier] ?? null };
};

export interface CrawlerStats {
  id: string; // = crawlerId
  items?: Record<string, SourceStats>;
  spells?: Record<string, SourceStats>;
  weaponTypeHits?: Record<string, number>; // weapon type -> attacks that hit a hostile mob (weapon proficiency)
  damageByType?: Record<string, number>;
  killsByMob?: Record<string, number>; // mob name -> hostile kills
  bossKills?: number;
  healingDone?: number;
  healingReceived?: number;
  friendlyFire?: number;
  neutralDamage?: number;
  neutralKills?: number;
  // Dice
  rollsByAbility?: Partial<Record<AbilityKey, number>>;
  d20Rolls?: number;
  d20Total?: number;
  nat20s?: number;
  nat1s?: number;
  disadvantageRolls?: number;
  checksPassed?: number;
  checksFailed?: number;
  // Combat style
  zeroHPDrops?: number;      // times knocked to 0 HP
  combatsFought?: number;
  combatsSurvived?: number;  // still standing when the fight ended
  roundsFought?: number;
  turnsTaken?: number;       // combat turns that ended
  turnFeet?: number;         // feet moved across those turns
  idleTurns?: number;        // turns with no action, bonus action or movement
  // Social
  npcLines?: number;         // chat lines said to NPCs nearby or picked with @
  persuasionRolls?: number;
  haggles?: number;
  haggleWins?: number;       // haggles the DM approved
  translations?: number;     // lines translated for the party
  // Economy
  goldEarned?: number;       // from loot, loot boxes and selling
  goldSpent?: number;        // at merchants
  itemsBought?: number;
  itemsSold?: number;
  gearSwaps?: number;        // items put into an equipment slot
  // Exploration and progress
  noncombatRolls?: number;
  lootBoxesByTier?: Record<string, number>;
  questsFinished?: number;
  // Player habits
  timedTurns?: number;       // combat turns with a turn clock
  turnSeconds?: number;      // time those turns took (each capped at 10 minutes)
  undoTurns?: number;
  voiceLines?: number;       // chat lines sent with the hold-to-talk mic
  typedLines?: number;
  // Standout moments, newest first (capped at CRAWLER_MOMENTS_MAX)
  moments?: CrawlerMoment[];
}

export interface CrawlerMoment {
  at: number; // epoch ms
  text: string;
}

export const CRAWLER_MOMENTS_MAX = 10;

// ---- Play style: tags worked out from the stats, compared with the party ----
// Shown to the DM only (players don't see them, so the AI's upgrade picks stay a surprise),
// and sent with AI prompts such as upgrade trees.

export type PlayStyleTag =
  | 'Striker' | 'Finisher' | 'Tank' | 'Healer' | 'Skirmisher' | 'Sharpshooter' | 'Talker'
  | 'Reckless' | 'Hoarder' | 'Spender' | 'Lucky' | 'Cursed' | 'Loose cannon' | 'Troublemaker';

export const PLAY_STYLE_RULES: Record<PlayStyleTag, string> = {
  Striker: 'Deals at least a quarter more damage than the party average',
  Finisher: 'Lands at least a quarter more killing blows than the party average',
  Tank: 'Takes at least a quarter more damage than the party average and survives most fights',
  Healer: 'Healing is over a quarter of their damage',
  Skirmisher: 'Moves at least a quarter more feet per combat turn than the party average',
  Sharpshooter: 'Over half their weapon attacks use ranged weapons',
  Talker: 'Talks to NPCs and rolls Persuasion at least a quarter more than the party average',
  Reckless: 'Drops near death or to 0 HP at least a quarter more often than the party average',
  Hoarder: 'Has spent under a quarter of the 50+ gold they earned',
  Spender: 'Has spent over three quarters of the 50+ gold they earned',
  Lucky: 'Averages 12 or more on 10+ d20 rolls',
  Cursed: 'Averages 9 or less on 10+ d20 rolls',
  'Loose cannon': 'Has dealt 10+ damage, or 5% of their damage, to other crawlers',
  Troublemaker: 'Has killed a neutral mob or NPC, or dealt them 10+ damage',
};

const statsOf = (statsById: CrawlerStatsById, id: string): CrawlerStats => statsById[id] ?? { id };

/** Play style tags for a crawler. `rangedItemIds`: their weapons that are ranged. */
export function getPlayStyleTags(crawler: Crawler, party: Crawler[], statsById: CrawlerStatsById, rangedItemIds: string[] = []): PlayStyleTag[] {
  const everyone = party.length > 0 ? party : [crawler];
  const st = statsOf(statsById, crawler.id);
  const avg = (value: (c: Crawler) => number) => everyone.reduce((sum, c) => sum + value(c), 0) / everyone.length;
  const standsOut = (value: (c: Crawler) => number) => {
    const mine = value(crawler);
    return mine > 0 && mine >= 1.25 * avg(value) && everyone.length > 1;
  };
  const damage = (c: Crawler) => c.activityStats?.damageDealt ?? 0;
  const tags: PlayStyleTag[] = [];
  if (standsOut(damage)) tags.push('Striker');
  if (standsOut(c => c.activityStats?.killingBlows ?? 0)) tags.push('Finisher');
  const fights = st.combatsFought ?? 0;
  if (standsOut(c => c.activityStats?.damageTaken ?? 0) && (fights === 0 || (st.combatsSurvived ?? 0) / fights >= 0.5)) tags.push('Tank');
  if ((st.healingDone ?? 0) > 0 && (st.healingDone ?? 0) > 0.25 * damage(crawler)) tags.push('Healer');
  if (standsOut(c => {
    const s = statsOf(statsById, c.id);
    return (s.turnsTaken ?? 0) > 0 ? (s.turnFeet ?? 0) / (s.turnsTaken ?? 1) : 0;
  })) tags.push('Skirmisher');
  const itemStats = Object.entries(st.items ?? {});
  const attacks = itemStats.reduce((sum, [, s]) => sum + (s.uses ?? 0), 0);
  const ranged = itemStats.filter(([id]) => rangedItemIds.includes(id)).reduce((sum, [, s]) => sum + (s.uses ?? 0), 0);
  if (attacks > 0 && ranged / attacks > 0.5) tags.push('Sharpshooter');
  if (standsOut(c => {
    const s = statsOf(statsById, c.id);
    return (s.npcLines ?? 0) + (s.persuasionRolls ?? 0);
  })) tags.push('Talker');
  if (standsOut(c => (c.activityStats?.lowHealthCount ?? 0) + (statsOf(statsById, c.id).zeroHPDrops ?? 0))) tags.push('Reckless');
  const earned = st.goldEarned ?? 0;
  if (earned >= 50) {
    const spentShare = (st.goldSpent ?? 0) / earned;
    if (spentShare < 0.25) tags.push('Hoarder');
    else if (spentShare > 0.75) tags.push('Spender');
  }
  const rolls = st.d20Rolls ?? 0;
  if (rolls >= 10) {
    const average = (st.d20Total ?? 0) / rolls;
    if (average >= 12) tags.push('Lucky');
    else if (average <= 9) tags.push('Cursed');
  }
  const friendly = st.friendlyFire ?? 0;
  if (friendly >= 10 || (friendly > 0 && friendly >= 0.05 * damage(crawler))) tags.push('Loose cannon');
  if ((st.neutralKills ?? 0) > 0 || (st.neutralDamage ?? 0) >= 10) tags.push('Troublemaker');
  return tags;
}

/**
 * A compact description of how a crawler plays, for AI prompts (upgrade trees, NPCs). Pass `itemId`
 * to include that weapon's, armor's or spell's own counters. Only non-zero numbers are kept.
 */
export function buildPlayStyleProfile(
  crawler: Crawler,
  party: Crawler[],
  statsById: CrawlerStatsById,
  options: { rangedItemIds?: string[]; itemId?: string } = {},
): Record<string, unknown> {
  const st = statsOf(statsById, crawler.id);
  const compact = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== 0 && v !== '' && !(Array.isArray(v) && v.length === 0)));
  const abilityRolls = st.rollsByAbility ?? {};
  const favoriteAbility = (Object.entries(abilityRolls) as [AbilityKey, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
  const item = options.itemId ? (st.items?.[options.itemId] ?? st.spells?.[options.itemId]) : undefined;
  const topVictims = Object.entries(st.killsByMob ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  const damageTypes = Object.entries(st.damageByType ?? {}).sort((a, b) => b[1] - a[1]).map(([type]) => type);
  return compact({
    crawler: compact({
      name: crawler.name, race: crawler.race, job: crawler.job, level: crawler.level,
      abilities: { str: crawler.str, dex: crawler.dex, con: crawler.con, int: crawler.int, cha: crawler.cha },
      backstory: crawler.backstory ? compact({ ...crawler.backstory }) : undefined,
    }),
    style: compact({
      tags: getPlayStyleTags(crawler, party, statsById, options.rangedItemIds),
      favoriteAbility,
      averageD20: st.d20Rolls ? Math.round(((st.d20Total ?? 0) / st.d20Rolls) * 10) / 10 : undefined,
      nat20s: st.nat20s, nat1s: st.nat1s,
    }),
    combat: compact({
      damageDealt: crawler.activityStats?.damageDealt, killingBlows: crawler.activityStats?.killingBlows,
      bossKills: st.bossKills, healingDone: st.healingDone, damageTaken: crawler.activityStats?.damageTaken,
      nearDeath: crawler.activityStats?.lowHealthCount, knockedOut: st.zeroHPDrops,
      friendlyFire: st.friendlyFire, neutralDamage: st.neutralDamage, neutralKills: st.neutralKills,
      favoriteDamageTypes: damageTypes.slice(0, 3), mostKilled: topVictims,
    }),
    item: item ? compact({ ...item }) : undefined,
    moments: (st.moments ?? []).map(m => m.text),
    social: compact({ npcLines: st.npcLines, persuasionRolls: st.persuasionRolls, haggleWins: st.haggleWins, translations: st.translations }),
    economy: compact({ goldEarned: st.goldEarned, goldSpent: st.goldSpent, itemsBought: st.itemsBought, itemsSold: st.itemsSold }),
  });
}

/** A map key that Firestore accepts (no __x__ names, not too long). */
export const statKey = (raw: string): string => {
  const key = (raw || 'unknown').trim().slice(0, 80) || 'unknown';
  return /^__.*__$/.test(key) ? `_${key}` : key;
};

// ---- Weapon proficiency ----
// Each attack that hits a hostile mob earns its weapon type proficiency XP. Ranks use the skill XP
// curve (rank 1 after 10 hits, rank 2 after 30…), and each rank is +1 to hit with that type, up to +10.
export const WEAPON_XP_PER_HIT = 5;
/** Unarmed Strike's proficiency, alongside the weapon types. */
export const HAND_TO_HAND = 'Hand to Hand';

export const getWeaponProficiencyXP = (stats: CrawlerStats | null | undefined, weaponType: string | undefined): number =>
  weaponType ? Math.min(MAX_SKILL_XP, WEAPON_XP_PER_HIT * (stats?.weaponTypeHits?.[statKey(weaponType)] ?? 0)) : 0;

export const getWeaponProficiency = (stats: CrawlerStats | null | undefined, weaponType: string | undefined): number =>
  getSkillRankForXP(getWeaponProficiencyXP(stats, weaponType));

/** The ability a dice log stat roll used: "STR", or a skill check like "Stealth check (rank 2)". */
export const abilityOfRoll = (stat: string): AbilityKey | undefined => {
  const first = stat.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if ((ABILITY_KEYS as string[]).includes(first)) return first as AbilityKey;
  return SKILLS.find(s => stat.startsWith(`${s.name} check`))?.ability;
};

// ---- Crawler stats shown on the profile ----

export type CrawlerStatKey = ActivityStatKey | 'spellCasts' | 'barterTrades'
  | 'healingDone' | 'bossKills' | 'nat20s' | 'friendlyFire' | 'neutralDamage';

export const CRAWLER_STAT_LABELS: Record<CrawlerStatKey, string> = {
  damageDealt: 'Damage Dealt',
  killingBlows: 'Killing Blows',
  combatEndingBlows: 'Fight Finishers',
  bossKills: 'Boss Kills',
  healingDone: 'Healing Done',
  damageTaken: 'HP Lost',
  lowHealthCount: 'Near Death',
  feetMoved: 'Feet Moved',
  mobsLooted: 'Mobs Looted',
  spellCasts: 'Spells Cast',
  barterTrades: 'Merchant Trades',
  nat20s: 'Natural 20s',
  friendlyFire: 'Friendly Fire',
  neutralDamage: 'Damage to Neutrals',
};

export const CRAWLER_STAT_KEYS = Object.keys(CRAWLER_STAT_LABELS) as CrawlerStatKey[];

/** Stats per crawler id, from the crawlerStats collection. */
export type CrawlerStatsById = Record<string, CrawlerStats | undefined>;

export const getCrawlerStatValue = (crawler: Crawler, key: CrawlerStatKey, stats?: CrawlerStats): number => {
  if (key === 'spellCasts') return (crawler.knownSpells ?? []).reduce((sum, s) => sum + (s.castCount || 0), 0);
  if (key === 'barterTrades') return crawler.barterTrades ?? 0;
  if (key === 'healingDone' || key === 'bossKills' || key === 'nat20s' || key === 'friendlyFire' || key === 'neutralDamage') {
    return stats?.[key] ?? 0;
  }
  return crawler.activityStats?.[key] ?? 0;
};

/**
 * The stats that stand out most for a crawler: each stat is scored by how far it is above the party's
 * average, so a healer-ish crawler with few kills shows what they're good at instead. Stats at 0 never
 * outrank ones with a value; the rest of the list fills in, in the usual order, to always show `count`.
 */
export function getHighlightStats(crawler: Crawler, party: Crawler[], statsById: CrawlerStatsById = {}, count = 5): CrawlerStatKey[] {
  const others = party.length > 0 ? party : [crawler];
  const scored = CRAWLER_STAT_KEYS.map((key, order) => {
    const value = getCrawlerStatValue(crawler, key, statsById[crawler.id]);
    const average = others.reduce((sum, c) => sum + getCrawlerStatValue(c, key, statsById[c.id]), 0) / others.length;
    return { key, order, value, score: value > 0 ? value / Math.max(average, 1) : 0 };
  });
  return scored
    .sort((a, b) => (b.score - a.score) || (a.order - b.order))
    .slice(0, count)
    .map(s => s.key);
}

// Ruler scale: one grid square (the size of a token) is 5 feet
export const FEET_PER_GRID_SQUARE = 5;

// Distance in feet between two map points given as percentages of the map image
export function getMapDistanceFeet(
  from: { x: number; y: number },
  to: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
  gridSize: number,
): number {
  if (gridSize <= 0) return 0;
  const dx = ((to.x - from.x) / 100) * imageWidth;
  const dy = ((to.y - from.y) / 100) * imageHeight;
  return (Math.sqrt(dx * dx + dy * dy) / gridSize) * FEET_PER_GRID_SQUARE;
}

export type StatModifiers = Partial<Record<'str' | 'dex' | 'con' | 'int' | 'cha' | 'hp' | 'maxHP' | 'mana' | 'maxMana' | 'moveSpeed', number>>;

// Effective movement speed: base speed (or the default) plus equipment modifiers
export function getEffectiveMoveSpeed(crawler: Crawler, inventory: InventoryItem[]): number {
  const mods = getEquippedModifiers(crawler, inventory);
  const athletics = 5 * Math.floor(getSkillRank(crawler, 'athletics') / 3);
  return Math.max(0, (crawler.moveSpeed ?? DEFAULT_MOVE_SPEED) + (mods.moveSpeed ?? 0) + athletics);
}

// Automatic achievement: when exactly one crawler is the slowest in the campaign, their
// speed is raised to match the second slowest crawler and they earn this trophy.
export const NO_CHILD_LEFT_BEHIND_TROPHY = 'This Is For You, Bud, No Child Left Behind';
export const NO_CHILD_LEFT_BEHIND_DESCRIPTION = 'Was the slowest crawler in the campaign, so their speed was raised to keep up with the party.';

// Returns the base moveSpeed that lifts the sole slowest crawler to the second slowest
// effective speed, or null when there is a tie for slowest or fewer than two crawlers.
export function getNoChildLeftBehindBump(
  crawlers: Crawler[],
  getInventory: (crawlerId: string) => InventoryItem[],
): { crawlerId: string; moveSpeed: number; fromSpeed: number; toSpeed: number } | null {
  if (crawlers.length < 2) return null;
  const speeds = crawlers
    .map(c => ({ crawler: c, speed: getEffectiveMoveSpeed(c, getInventory(c.id)) }))
    .sort((a, b) => a.speed - b.speed);
  const [slowest, secondSlowest] = speeds;
  if (slowest.speed === secondSlowest.speed) return null;
  const mods = getEquippedModifiers(slowest.crawler, getInventory(slowest.crawler.id));
  return {
    crawlerId: slowest.crawler.id,
    moveSpeed: Math.max(0, secondSlowest.speed - (mods.moveSpeed ?? 0)),
    fromSpeed: slowest.speed,
    toSpeed: secondSlowest.speed,
  };
}

// Weapon system types
export const DAMAGE_TYPES = ['Basic', 'Poison', 'Disease', 'Spiritual', 'Radiation', 'Fire', 'Electric', 'Emotional'] as const;
export type DamageType = typeof DAMAGE_TYPES[number];

export const WEAPON_TYPES = ['Arcane', 'Body Upgrade', 'Bows', 'Crossbows', 'Firearms', 'Heavy weapons', 'Improvised', 'Light weapons', 'Mechanical', 'Polearms', 'Throwing', 'Whips'] as const;
export type WeaponType = typeof WEAPON_TYPES[number];
/** Every weapon proficiency: Unarmed Strike's Hand to Hand, then the weapon types. */
export const PROFICIENCY_TYPES: string[] = [HAND_TO_HAND, ...WEAPON_TYPES];

export interface WeaponDie {
  count: number; // number of dice (e.g. 2 for 2d6)
  sides: number; // sides per die (e.g. 6 for d6)
}

export interface WeaponData {
  hitDie?: WeaponDie; // bonus die added to the d20 attack roll
  damageDice: WeaponDie[]; // one or more damage dice
  hitModifiers?: StatModifiers; // stat modifiers applied to hit roll
  damageModifiers?: StatModifiers; // stat modifiers applied to damage roll
  damageType: DamageType;
  weaponType: WeaponType;
  isRanged: boolean;
  normalRange?: number; // feet, only if ranged
  maxRange?: number; // feet, only if ranged
  specialEffect?: string; // optional text for special effects
  splashDamage?: boolean; // if true, damage can target multiple enemies
}

// Spell system types
export const SPELL_SCHOOLS = ['Evocation', 'Necromancy', 'Illusion', 'Conjuration', 'Abjuration', 'Divination', 'Transmutation', 'Enchantment'] as const;
export type SpellSchool = typeof SPELL_SCHOOLS[number];

export const SPELL_ACTION_TYPES = ['Action', 'Bonus Action', 'Reaction'] as const;
export type SpellActionType = typeof SPELL_ACTION_TYPES[number];

export const SPELL_DAMAGE_TYPES = [...DAMAGE_TYPES, 'Healing'] as const;
export type SpellDamageType = typeof SPELL_DAMAGE_TYPES[number];

export interface SpellDuration {
  combatTurns?: number;
  noncombatTurns?: number;
  description?: string; // free-form label, e.g. "Until dispelled"
}

// Preset conditions a spell can put on its targets (the DM can also type a custom one)
export const SPELL_CONDITIONS = [
  'Burning', 'Poisoned', 'Bleeding', 'Frozen', 'Stunned', 'Paralyzed', 'Blinded', 'Charmed',
  'Frightened', 'Slowed', 'Restrained', 'Prone', 'Silenced', 'Blessed', 'Shielded', 'Hasted', 'Regenerating',
] as const;

// What a spell leaves on each target it hits, lasting a number of the target's combat turns
export interface SpellEffect {
  condition: string;          // e.g. "Burning"
  turns: number;              // how many of the target's turns it lasts
  description?: string;       // what it does, in plain words, e.g. "Disadvantage on attacks"
  perTurnDice?: WeaponDie[];  // rolled at the start of each of the target's turns
  perTurnType?: 'damage' | 'healing';
}

// A spell effect currently on a combatant
export interface ActiveCondition {
  id: string;
  name: string;
  turnsLeft: number;
  description?: string;
  source: string;      // spell name
  casterName?: string;
  perTurnDice?: WeaponDie[];
  perTurnType?: 'damage' | 'healing';
}

// Short label for a spell effect, e.g. "Burning for 3 turns (1d6 damage each turn)"
export const describeSpellEffect = (effect: Pick<SpellEffect, 'condition' | 'perTurnDice' | 'perTurnType'> & { turns: number }): string => {
  const dice = (effect.perTurnDice ?? []).filter(d => d.count > 0).map(d => `${d.count}d${d.sides}`).join(' + ');
  const perTurn = effect.perTurnType && dice ? ` (${dice} ${effect.perTurnType} each turn)` : '';
  return `${effect.condition} for ${effect.turns} turn${effect.turns === 1 ? '' : 's'}${perTurn}`;
};

export interface SpellData {
  manaCost: number;
  spellLevel: number; // 1–9 (D&D spell level)
  school: SpellSchool;
  actionType: SpellActionType;
  range: number | 'Self' | 'Touch'; // feet or keyword
  canTargetSelf: boolean; // whether caster can target themselves
  target: 'Single' | 'Area' | 'Self' | 'Multiple';
  areaOfEffect?: { shape: 'sphere' | 'cone' | 'line' | 'cube'; size: number };
  damageDice?: WeaponDie[]; // reuses existing WeaponDie type
  damageType?: SpellDamageType;
  hitDie?: WeaponDie; // bonus die on spell attack roll
  hitModifiers?: StatModifiers;
  damageModifiers?: StatModifiers;
  duration?: SpellDuration;
  savingThrow?: string; // e.g. 'DEX', 'CON'
  specialEffect?: string;
  effect?: SpellEffect; // condition put on each target the spell lands on (combat only)
  splashDamage?: boolean;
  reactionTrigger?: string; // For Reaction spells: describes what triggers the reaction (e.g. "when you are hit by an attack")
  grantsLanguage?: string;  // Casting it lets the caster know this language for the spell's duration (Speak with Animals → Beast)
  questionLimit?: number;   // With grantsLanguage: lines the caster can say in it per casting (Speak with Dead: 5)
}

export interface Spell {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  spellData: SpellData;
  iconId?: string;           // References an entry in the global iconLibrary collection
  createdBy?: string;        // Firebase uid of creator
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Whether visible to players outside the campaign
  upgradeXp?: UpgradeXpSettings; // How this spell earns upgrade XP (unset fields use the spell defaults)
}

/** A pixel-art icon in the global `iconLibrary` collection, shared by every campaign. */
export interface IconLibraryEntry {
  id: string;
  image: string;       // small PNG data URL (48x48 icon, or 128x128 mob portrait)
  tags: string[];      // normalized descriptor tags used to match icons to new items/spells/mobs
  kind: 'item' | 'spell' | 'mob';
  sourceName: string;  // name of the item or spell the icon was generated for
  prompt?: string;
  createdAt: string;
  createdBy?: string;
}

export const SPELL_LEARNED_FROM = ['tome', 'quest', 'level', 'race', 'class', 'granted'] as const;
export type SpellLearnedFrom = typeof SPELL_LEARNED_FROM[number];

export interface KnownSpell {
  spellId: string;
  spellName: string; // denormalized for display
  learnedFrom: SpellLearnedFrom;
  learnedAt: string; // ISO timestamp
  castCount: number; // total casts, drives mastery level
  customSpell?: Spell; // full spell data for one-off tome spells that aren't in the library
  upgrades?: ItemUpgrade[]; // upgrades to this crawler's copy, applied on top of the library spell when read
  upgradePath?: UpgradePath; // milestones reached, the trees offered and the one picked
}

// Mastery threshold: level N requires 5*N*(N+1) total casts (10, 30, 60, 100, ...)
export function getSpellMasteryLevel(castCount: number): number {
  let level = 0;
  while (5 * (level + 1) * (level + 2) <= castCount) {
    level++;
  }
  return level;
}

// Effective mana cost: each mastery level reduces base cost by ceil(base * 5%), floored at 0
export function getEffectiveManaCost(baseCost: number, masteryLevel: number): number {
  const reductionPerLevel = Math.ceil(baseCost * 0.05);
  return Math.max(0, baseCost - reductionPerLevel * masteryLevel);
}

// Casts remaining until the next mastery level
export function getCastsUntilNextMastery(castCount: number): number {
  const currentLevel = getSpellMasteryLevel(castCount);
  const nextThreshold = 5 * (currentLevel + 1) * (currentLevel + 2);
  return nextThreshold - castCount;
}

export const ITEM_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export type ItemRarity = typeof ITEM_RARITIES[number];

export const getItemRarityColor = (rarity: ItemRarity): string => {
  switch (rarity) {
    case 'Common': return '#9CA3AF';
    case 'Uncommon': return '#22C55E';
    case 'Rare': return '#3B82F6';
    case 'Epic': return '#A855F7';
    case 'Legendary': return '#F59E0B';
  }
};

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  rarity?: ItemRarity;
  effects?: string; // What the item does, in plain words (shown on the item card)
  equipSlot?: EquipmentSlot; // Which slot this item can be equipped to
  goldValue?: number; // Value of the item in gold
  equipped?: boolean; // Deprecated - use equippedItems in Crawler instead
  statModifiers?: StatModifiers; // Stat adjustments when equipped
  tags?: string[]; // Custom tags for filtering (e.g., "magic", "cursed", "quest")
  weaponData?: WeaponData; // Weapon-specific data (only for items with "weapon" tag or weapon equipSlot)
  isUpgraded?: boolean; // Whether this item has been upgraded by a crawler
  upgradeXp?: UpgradeXpSettings; // How this item earns upgrade XP (unset fields use the defaults for its kind)
  isSpellTome?: boolean; // Consumable that teaches a spell when used
  iconId?: string; // References an entry in the global iconLibrary collection
  spellTomeData?: {
    entries: Array<{
      spellId?: string; // References a spell in the library
      customSpell?: Spell; // Embedded one-off spell (not in library)
    }>;
  };
  createdBy?: string;        // Firebase uid of creator
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Whether visible to players outside the campaign
  language?: string;         // Written in this language: the description is scrambled for crawlers who don't know it
  grantsLanguage?: string;   // While equipped, the crawler knows this language (a druid's charm grants Beast)
  armorData?: ArmorData;     // Armor rating, damage reduction, resistances and vulnerabilities (set by upgrades for now)
  upgrades?: ItemUpgrade[];  // Upgrades given to this crawler's copy, oldest first (see src/lib/upgrades.ts)
  upgradePath?: UpgradePath; // Milestones reached, the trees the Dungeon AI offered and the one picked
}

export interface ArmorData {
  rating?: number;        // adds to the wearer's DC
  reduction?: number;     // taken off each hit
  resist?: string[];      // damage or weapon types that do half damage
  vulnerable?: string[];  // damage or weapon types that do double damage
}

// ---- Upgrades: effects the game applies to one crawler's copy of an item or spell ----
export type UpgradeEffect =
  | { type: 'dice'; target: 'damage' | 'hit'; step?: number; addDie?: WeaponDie }   // step: die sizes up (d8 -> d10 is 1)
  | { type: 'property'; rangeFt?: number; damageType?: string; splash?: boolean; durationTurns?: number }
  | { type: 'stat'; mods: StatModifiers }
  | { type: 'onHit'; chance: number; condition?: string; turns?: number; extraDie?: WeaponDie }
  | { type: 'action'; name: string; uses: 'perCombat' | 'perDay' | 'atWill'; damage?: WeaponDie; text?: string }
  | { type: 'defense'; armorRating?: number; reduction?: number; resist?: string[]; vulnerable?: string[] }
  | { type: 'language'; language: string }
  | { type: 'strange'; text: string };
export type UpgradeEffectType = UpgradeEffect['type'];

export type UpgradeDrawback =
  | { type: 'statPenalty'; mods: StatModifiers }
  | { type: 'destroyOnUnequip' }
  | { type: 'locked' }
  | { type: 'cost'; hp?: number; mana?: number }
  | { type: 'strange'; text: string };

/** One step of an upgrade tree: what the item gains when the step is claimed. */
export interface UpgradeStep {
  name: string;
  flavor?: string;
  newName?: string;
  effects: UpgradeEffect[];
  drawback?: UpgradeDrawback;
}

export interface UpgradeTree {
  name: string;
  pitch?: string;
  steps: UpgradeStep[]; // 3 steps, claimed one milestone at a time
}

/** Where a crawler's copy of an item or spell is on its upgrade journey (see src/lib/upgradeTrees.ts). */
export interface UpgradePath {
  tiersUsed: number;    // milestones that have already started a meditation or unlocked a step
  status?: 'meditating' | 'choosing' | 'ready'; // waiting on the Dungeon AI / player picks a tree / player claims the next step
  trees?: UpgradeTree[]; // offered while choosing
  tree?: UpgradeTree;    // the tree picked
  stepsTaken?: number;   // steps of `tree` already applied
  offeredAt?: number;    // tier the offered trees were written for (their step 1)
  meditatingSince?: number; // epoch ms; 0 asks any DM tab to start now (re-roll)
  log?: { at: string; source: 'ai' | 'preset'; model?: string; prompt?: string; reply?: string; error?: string }; // last request, for the DM
}

export interface ItemUpgrade {
  id: string;
  name: string;
  flavor?: string;
  effects: UpgradeEffect[];
  drawback?: UpgradeDrawback;  // a cursed bargain
  source: 'dm' | 'ai' | 'preset';
  treeName?: string;
  newName?: string;            // renames this crawler's copy ("Rusty Sword" -> "Gravemaker")
  appliedAt: string;           // ISO timestamp
  before?: Record<string, unknown>; // the item's changed fields before this upgrade, so the DM can undo it
}

// Compute total stat modifiers from all equipped items on a crawler
export function getEquippedModifiers(crawler: Crawler, inventory: InventoryItem[]): StatModifiers {
  const equipped = crawler.equippedItems ?? {};
  const totals: StatModifiers = {};
  for (const itemId of Object.values(equipped)) {
    const item = inventory.find(i => i.id === itemId);
    if (!item?.statModifiers) continue;
    for (const [stat, val] of Object.entries(item.statModifiers)) {
      totals[stat as keyof StatModifiers] = (totals[stat as keyof StatModifiers] ?? 0) + (val as number);
    }
  }
  return totals;
}

/** Creatures are templates you can place many times (Goblin); characters are unique and part of the story (Grimble). */
export type MobKind = 'creature' | 'character';

export interface Mob {
  id: string;
  name: string;
  level: number;
  type: "normal" | "boss" | "npc"; // Legacy; kept in step with kind/boss so older copies still read right
  kind?: MobKind;      // Absent on old mobs: read with getMobKind()
  boss?: boolean;      // Absent on old mobs: read with isBossMob()
  speciesId?: string;  // Characters: the creature they are ("Grimble is a Goblin")
  description: string;
  encountered: boolean;
  hidden: boolean;
  image?: string;
  weaknesses?: string;
  strengths?: string;
  hitPoints?: number;
  hideWeaknesses?: boolean;
  hideStrengths?: boolean;
  hideHitPoints?: boolean;
  defaultInventory?: InventoryItem[]; // Default items this mob type carries
  defaultGold?: number; // Default gold this mob type carries
  lootDestructionChance?: number; // % chance each stackable item copy or coin is smashed when looted (default DEFAULT_LOOT_DESTRUCTION_CHANCE)
  equippedItems?: EquippedItems; // Equipment mapping (slot → item ID)
  createdBy?: string;        // Firebase uid of creator (absent = made in this campaign by its DM)
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Shared to the community (publicMobs)
  personality?: NpcPersonality; // DM-only: drives AI dialogue for talking NPCs
  languages?: string[];      // Language ids it speaks, native first; none set = Worldspeech
  silent?: boolean;          // Never talks in Game Chat (oozes, constructs...)
  merchant?: MerchantConfig;  // NPCs that buy and sell items with crawlers
  attacks?: MobAttack[];     // Natural attacks the DM rolls in combat (claws, bites...)
  spellIds?: string[];       // Spells from the campaign spell library this mob can cast
}

// ======== Mob combat actions ========

/** A natural attack on a mob, set up in the mob creator. Mobs have no ability scores, so the bonuses are flat. */
export interface MobAttack {
  id: string;
  name: string;
  actionType: SpellActionType;
  hitBonus?: number;    // added to the d20 to-hit roll
  damageDice: WeaponDie[];
  damageBonus?: number; // added to the damage roll
  damageType?: DamageType;
  range?: number;       // feet; absent = melee
  notes?: string;
}

/** One thing a mob can do in combat: a natural attack, an equipped weapon or a spell. */
export interface MobCombatAction {
  key: string;
  source: 'attack' | 'weapon' | 'spell';
  name: string;
  actionType: SpellActionType;
  hitBonus: number;
  hitDie?: WeaponDie;
  damageDice: WeaponDie[];
  damageBonus: number;
  damageType?: string;
  healing: boolean;
  splash: boolean;
  range?: number | string;
  notes?: string;
}

/** Everything a mob can do in combat: its attacks, its equipped weapons (from its default inventory) and its spells. */
export function getMobCombatActions(mob: Mob, spells: Spell[]): MobCombatAction[] {
  const actions: MobCombatAction[] = (mob.attacks ?? []).map(a => ({
    key: `attack:${a.id}`,
    source: 'attack' as const,
    name: a.name || 'Attack',
    actionType: a.actionType,
    hitBonus: a.hitBonus ?? 0,
    damageDice: a.damageDice ?? [],
    damageBonus: a.damageBonus ?? 0,
    damageType: a.damageType,
    healing: false,
    splash: false,
    range: a.range,
    notes: a.notes,
  }));
  const equippedIds = new Set(Object.values(mob.equippedItems ?? {}).filter(Boolean));
  for (const item of mob.defaultInventory ?? []) {
    if (!item.weaponData || !equippedIds.has(item.id)) continue;
    const wd = item.weaponData;
    actions.push({
      key: `weapon:${item.id}`,
      source: 'weapon',
      name: item.name,
      actionType: 'Action',
      hitBonus: 0,
      hitDie: wd.hitDie && wd.hitDie.count > 0 ? wd.hitDie : undefined,
      damageDice: wd.damageDice ?? [],
      damageBonus: 0,
      damageType: wd.damageType,
      healing: false,
      splash: !!wd.splashDamage,
      range: wd.isRanged ? wd.normalRange : undefined,
      notes: wd.specialEffect,
    });
  }
  for (const id of mob.spellIds ?? []) {
    const spell = spells.find(s => s.id === id);
    if (!spell) continue;
    const sd = spell.spellData;
    actions.push({
      key: `spell:${spell.id}`,
      source: 'spell',
      name: spell.name,
      actionType: sd.actionType,
      hitBonus: 0,
      hitDie: sd.hitDie && sd.hitDie.count > 0 ? sd.hitDie : undefined,
      damageDice: sd.damageDice ?? [],
      damageBonus: 0,
      damageType: sd.damageType,
      healing: sd.damageType === 'Healing',
      splash: !!sd.splashDamage || sd.target === 'Area' || sd.target === 'Multiple',
      range: sd.range,
      notes: sd.specialEffect || spell.description,
    });
  }
  return actions;
}

/** "2d6 + 1d4 + 3" */
export function formatDamageDice(dice: WeaponDie[], bonus = 0): string {
  const parts = dice.filter(d => d.count > 0).map(d => `${d.count}d${d.sides}`);
  if (bonus) parts.push(String(bonus));
  return parts.join(' + ') || '—';
}

// ======== Merchants ========

export interface MerchantStockEntry {
  item: InventoryItem;
  quantity: number;
}

/** DM settings on the mob. Restocking copies these into the live MerchantState. */
export interface MerchantConfig {
  enabled: boolean;
  stock: MerchantStockEntry[];
  startingGold: number;
  scroogeFactor: number; // Each level: buy prices +10%, sell prices -10%
  haggleDC?: number;     // Persuasion (d20 + CHA mod) needed to ask the DM for a lower Scrooge level
}

export type MerchantHaggleState = 'pending' | 'approved' | 'denied' | 'failed';

export interface MerchantHaggle {
  state: MerchantHaggleState;
  crawlerName: string;
  total: number;
  dc: number;
  at: number;
}

/** Live stock and gold, shared by everyone in the room: rooms/{roomId}/merchants/{mobId} */
export interface MerchantState {
  id: string; // = mobId
  stock: MerchantStockEntry[];
  gold: number;
  discounts?: Record<string, number>;      // crawlerId -> Scrooge levels taken off by haggling
  haggles?: Record<string, MerchantHaggle>; // crawlerId -> their haggle attempt since the last restock
  restockedAt?: number;
}

export const MERCHANT_TRADE_RANGE_FEET = 20;
export const DEFAULT_HAGGLE_DC = 15;
export const DEFAULT_MERCHANT_CONFIG: MerchantConfig = { enabled: true, stock: [], startingGold: 100, scroogeFactor: 0 };

/** Any mob can be a merchant; this doesn't depend on its type. */
export const isMerchant = (mob: Pick<Mob, 'merchant'> | undefined): boolean => !!mob?.merchant?.enabled;

/** A fresh live state from the DM's settings. Items get new ids so restocks never collide. */
export const createMerchantState = (mobId: string, config: MerchantConfig): MerchantState => ({
  id: mobId,
  stock: (config.stock || [])
    .filter(e => e.quantity > 0)
    .map(e => ({ item: { ...e.item, id: `merch-${crypto.randomUUID()}` }, quantity: Math.floor(e.quantity) })),
  gold: Math.max(0, Math.floor(config.startingGold || 0)),
  discounts: {},
  haggles: {},
  restockedAt: Date.now(),
});

/** The Scrooge level a crawler trades at after any haggling discount and their Barter rank. Never below 0. */
export const getEffectiveScrooge = (config: MerchantConfig | undefined, state: MerchantState | undefined, crawlerId?: string, barterRank = 0): number =>
  Math.max(0, Math.floor(config?.scroogeFactor ?? 0) - (crawlerId ? state?.discounts?.[crawlerId] ?? 0 : 0) - getBarterScroogeReduction(barterRank));

// Worked in tenths so 100 gold at +10% is exactly 110, not 110.00000000000001 rounded up to 111
export const getMerchantBuyPrice = (goldValue: number | undefined, scrooge: number): number =>
  Math.max(0, Math.ceil(Math.round((goldValue ?? 0) * (10 + scrooge)) / 10));

export const getMerchantSellPrice = (goldValue: number | undefined, scrooge: number): number =>
  Math.max(0, Math.floor(Math.round((goldValue ?? 0) * (10 - scrooge)) / 10));

/**
 * Haggling uses an action, like the Actions tab: in combat it takes the crawler's action on
 * their turn; between fights it uses one of their rolls for this noncombat turn.
 * Returns why the crawler can't act right now, or null if they can.
 */
export const getHaggleBlocker = (
  crawlerId: string,
  combatState: Pick<CombatState, 'active' | 'phase' | 'combatants' | 'currentTurnIndex'> | null | undefined,
  noncombatTurnState: Pick<NoncombatTurnState, 'rollsUsed' | 'maxRolls'> | null | undefined,
): string | null => {
  if (combatState?.active && combatState.phase !== 'ended') {
    if (combatState.phase !== 'combat' || combatState.combatants[combatState.currentTurnIndex]?.id !== crawlerId) {
      return 'Haggling uses your action. Wait for your turn.';
    }
    if (combatState.combatants.find(c => c.id === crawlerId)?.hasUsedAction) return 'You already used your action this turn.';
    return null;
  }
  if (noncombatTurnState && (noncombatTurnState.rollsUsed?.[crawlerId] ?? 0) >= noncombatTurnState.maxRolls) {
    return 'Haggling uses a roll, and you have none left this turn.';
  }
  return null;
};

// ======== Item stacks & mob loot ========

/** Copies of the same item share this key and are shown as one stack. */
export const getItemStackKey = (item: InventoryItem): string => {
  const modifiersStr = item.statModifiers
    ? JSON.stringify(Object.entries(item.statModifiers).filter(([, v]) => v !== 0).sort())
    : '';
  // An upgraded copy never stacks with the plain item, or with copies upgraded differently
  const upgradeStr = item.isUpgraded ? `|upgraded:${JSON.stringify(item.weaponData ?? null)}` : '';
  return `${item.name}|${item.description || ''}|${item.equipSlot || ''}|${item.goldValue ?? 0}|${modifiersStr}${upgradeStr}`;
};

/** An upgraded item's name without the "Upgraded" suffix, which is drawn separately (older upgrades saved it in the name). */
export const baseItemName = (item: Pick<InventoryItem, 'name' | 'isUpgraded'>): string =>
  item.isUpgraded ? item.name.replace(/\s+upgraded$/i, '') : item.name;

export interface ItemStack {
  key: string;
  item: InventoryItem; // first copy, used for display
  count: number;
  ids: string[];
}

/** Groups copies of the same item, keeping the order each item first appears in. */
export const stackItems = (items: InventoryItem[]): ItemStack[] => {
  const stacks = new Map<string, ItemStack>();
  for (const item of items) {
    const key = getItemStackKey(item);
    const stack = stacks.get(key);
    if (stack) {
      stack.count++;
      stack.ids.push(item.id);
    } else {
      stacks.set(key, { key, item, count: 1, ids: [item.id] });
    }
  }
  return Array.from(stacks.values());
};

/** Inventory document holding items looted by the party that nobody has taken yet. */
// (Firestore reserves ids like __name__, so this one has no underscores)
export const PARTY_INVENTORY_ID = 'party-loot';

/** The campaign's item library is the inventory entry with this crawlerId. */
export const SHARED_LIBRARY_ID = '__shared__';
/** Document ID for a new item library (Firestore rejects SHARED_LIBRARY_ID itself as a document ID). */
export const SHARED_LIBRARY_DOC_ID = 'shared-library';

export interface MobLootSplit {
  gold: Record<string, number>; // crawlerId → gold received
  items: Record<string, InventoryItem[]>; // crawlerId → items received
  party: InventoryItem[]; // items for the party inventory
  destroyedGold: number;
  destroyed: InventoryItem[]; // stackable copies smashed while looting
}

// ---- Looting skill ----
// Like spell mastery: Looting level N is reached after 5·N·(N+1) mobs looted (10, 30, 60, 100…),
// and each level cuts the crawler's chance of loot being smashed by a tenth, up to level 10.
export const DEFAULT_LOOT_DESTRUCTION_CHANCE = 25;
export const MAX_LOOTING_LEVEL = 10;

export const getLootingLevel = (mobsLooted = 0): number => {
  let level = 0;
  while (level < MAX_LOOTING_LEVEL && mobsLooted >= 5 * (level + 1) * (level + 2)) level++;
  return level;
};

/** Mobs left to loot before the next Looting level, or null at the max level. */
export const getLootsUntilNextLevel = (mobsLooted = 0): number | null => {
  const level = getLootingLevel(mobsLooted);
  return level >= MAX_LOOTING_LEVEL ? null : 5 * (level + 1) * (level + 2) - mobsLooted;
};

/** % chance a crawler's loot is smashed, given the mob's base chance and their Looting level. */
export const getLootDestructionChance = (baseChance: number, lootingLevel: number): number =>
  Math.max(0, baseChance * (1 - Math.min(lootingLevel, MAX_LOOTING_LEVEL) / MAX_LOOTING_LEVEL));

/**
 * Splits a defeated mob's loot between the crawlers who fought it. Gold is split evenly, with
 * leftover coins going one each in `crawlerIds` order. Items the mob carries several copies of
 * are dealt out evenly and leftovers go to the party; single items go to the party.
 * Each coin and each copy of a stackable item then rolls against `chanceFor(crawlerId)` (in %)
 * to be smashed instead; party leftovers roll against the best (lowest) chance in the fight.
 * Single items are never smashed. Every item gets a fresh id so copies never collide.
 */
export const splitMobLoot = (
  items: InventoryItem[],
  gold: number,
  crawlerIds: string[],
  chanceFor: (crawlerId: string) => number = () => 0,
  random: () => number = Math.random,
): MobLootSplit => {
  const split: MobLootSplit = { gold: {}, items: {}, party: [], destroyedGold: 0, destroyed: [] };
  const fresh = (item: InventoryItem): InventoryItem => {
    const { equipped: _eq, ...rest } = item;
    return { ...rest, id: `item-${crypto.randomUUID()}` };
  };
  const smashed = (chance: number) => chance > 0 && random() * 100 < chance;
  const n = crawlerIds.length;
  if (n === 0) {
    split.party = items.map(fresh);
    return split;
  }
  const partyChance = Math.min(...crawlerIds.map(chanceFor));
  const coins = Math.max(0, Math.floor(gold || 0));
  crawlerIds.forEach((id, i) => {
    const dealt = Math.floor(coins / n) + (i < coins % n ? 1 : 0);
    const chance = chanceFor(id);
    let share = dealt;
    for (let c = 0; c < dealt; c++) {
      if (smashed(chance)) { share--; split.destroyedGold++; }
    }
    if (share > 0) split.gold[id] = share;
  });
  for (const stack of stackItems(items)) {
    const copies = items.filter(i => getItemStackKey(i) === stack.key);
    if (stack.count === 1) {
      split.party.push(fresh(copies[0]));
      continue;
    }
    const each = Math.floor(stack.count / n);
    crawlerIds.forEach((id, i) => {
      const chance = chanceFor(id);
      for (const copy of copies.slice(i * each, (i + 1) * each)) {
        if (smashed(chance)) split.destroyed.push(copy);
        else split.items[id] = [...(split.items[id] ?? []), fresh(copy)];
      }
    });
    for (const copy of copies.slice(each * n)) {
      if (smashed(partyChance)) split.destroyed.push(copy);
      else split.party.push(fresh(copy));
    }
  }
  return split;
};

/** Two items count as the same stock line when everything but the id matches. */
export const merchantItemKey = (item: InventoryItem): string => {
  const { id: _id, equipped: _eq, ...rest } = item;
  const stable = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(stable)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, stable((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(stable(rest));
};

// ======== Talking NPCs (local AI) ========

/** DM-only personality card. The secret is never sent to the AI until the DM unlocks it. */
export interface NpcPersonality {
  voice?: string;      // Voice and manner
  wants?: string;
  knows?: string;
  secret?: string;
  revealWhen?: string; // Plain-words reveal condition, e.g. "the party pays or bribes him"
  attitude?: string;   // Attitude toward the party
  persuasionDC?: number; // A Persuasion roll this high (d20 + CHA mod) asks the DM to unlock the secret
}

export const hasNpcPersonality = (mob: Pick<Mob, 'personality'>): boolean =>
  !!mob.personality && Object.values(mob.personality).some(v => typeof v === 'string' && v.trim() !== '');

/** Shared copies of a mob keep its personality but never its secret. */
export const stripNpcSecret = <T extends { personality?: NpcPersonality }>(mob: T): T => {
  if (!mob.personality) return mob;
  const { secret: _s, revealWhen: _r, ...rest } = mob.personality;
  return { ...mob, personality: rest };
};

/** One line in the in-game chat: rooms/{roomId}/chatMessages/{id} */
export interface ChatMessage {
  id: string;
  authorType: 'crawler' | 'dm' | 'npc';
  authorId: string;     // crawler id, 'dm', or mob id
  authorName: string;
  text: string;
  createdAt: number;    // epoch ms
  episodeId?: string;
  // NPC lines: where the speaking token stood, for the speech bubble
  mapId?: string;
  x?: number;
  y?: number;
  viaVoice?: boolean;   // Sent with the hold-to-talk mic
  toMobIds?: string[];  // Mobs picked with @ in the chat box
  nearMobIds?: string[]; // Player messages: mobs within talking range of the crawler when sent
  language?: string;     // Spoken in this language (none = everyone understands, e.g. the DM narrating)
  translationOf?: string; // A translator's version of another line, shown to party members who can't read it
  gesture?: string;      // Beast, Plant and Dead lines: the sounds and body language seen by those who don't know the language
  preset?: boolean;      // NPC line picked from presets (nobody in the party knew its language), not written by the AI
  // NPC lines read aloud (made in the DM's browser, short-lived clips in Firestore npcClips/)
  audioUrl?: string;          // the real words
  audioScrambledUrl?: string; // the scrambled words, for players who don't know the language (may be the same clip)
}

/** Players can only talk to mobs this close to their crawler. */
export const NPC_TALK_RANGE_FEET = 20;

/** A personality the AI wrote for a mob that had none: rooms/{roomId}/npcAi/personalities → { [mobId]: ... } */
export interface NpcGeneratedPersonality extends NpcPersonality {
  generatedAt?: number;
  traits?: Record<string, string | number>; // the random ingredients it was built from
}

/** The personality a mob talks with: the DM's card if filled in, else the generated one. */
export const withNpcPersonality = (mob: Mob, generated: Record<string, NpcGeneratedPersonality>): Mob & { personalityGenerated?: boolean } => {
  if (hasNpcPersonality(mob) || !generated[mob.id]) return mob;
  return { ...mob, personality: generated[mob.id], personalityGenerated: true };
};

/** Which Mobs subtab a mob is listed under: bosses first, then mobs (creatures) or characters. */
export type MobSection = 'boss' | MobKind;
export const mobSection = (mob: Mob): MobSection => (mobIsBoss(mob) ? 'boss' : mobKindOf(mob) as MobKind);

/** The legacy type field that matches a kind and boss flag. */
export const legacyMobType = (kind: MobKind, boss: boolean): Mob['type'] =>
  boss ? 'boss' : kind === 'character' ? 'npc' : 'normal';

/**
 * A speaker as a mob the chat can show: its own id and name ("Goblin B"), and the DM's card if
 * the mob has one, else the personality the AI wrote for this speaker.
 */
export const speakerAsMob = (speaker: NpcSpeaker, generated: Record<string, NpcGeneratedPersonality>): Mob & { personalityGenerated?: boolean } =>
  withNpcPersonality({ ...speaker.mob, id: speaker.id, name: speaker.name }, generated);

/**
 * What a speaker remembers from earlier conversations: rooms/{roomId}/npcAi/memories → { [speakerId]: NpcMemory }.
 * Written by the NPC brain when a conversation goes quiet; the DM can edit or clear it.
 */
export interface NpcMemory {
  notes: string[];
  feelings?: Record<string, { name: string; score: number }>; // crawlerId → -3 (hostile) … 3 (fond)
  name?: string;            // speaker name when it was written
  episodeId?: string;       // creature copies: the episode this memory belongs to
  updatedAt?: number;
}

export const NPC_MEMORY_MAX_NOTES = 8;

/** A feeling score in words (same wording as feelingWord in src/lib/npc/brain.mjs). */
export const npcFeelingWord = (score: number): string =>
  score <= -3 ? 'hostile' : score === -2 ? 'dislikes them' : score === -1 ? 'wary'
    : score === 0 ? 'neutral' : score === 1 ? 'warming to them' : score === 2 ? 'friendly' : 'fond of them';

export type NpcModelChoice = 'quality' | 'fast';

/** DM settings: rooms/{roomId}/npcAi/settings */
export interface NpcAiSettings {
  id: 'settings';
  enabled?: boolean;        // NPC voices on (default) / off
  model?: NpcModelChoice;   // default 'quality'
  mutedAll?: boolean;
  mutedMobIds?: string[];
  brain?: NpcBrain;         // where NPC lines are written; default 'online'
  speech?: boolean;         // Spoken voices: the DM's browser reads NPC lines aloud (default off)
  voices?: Record<string, NpcSpeechVoice>; // DM's voice picks by mob id (creature copies share one)
}

/** The DM's voice picks for an NPC, one per voice service, and its speaking speed (1 = normal). */
export interface NpcSpeechVoice {
  voice?: string;      // Kokoro voice
  gemini?: string;     // Gemini voice name
  groq?: string;       // Groq (Orpheus) voice
  elevenlabs?: string; // ElevenLabs voice id (an NPC with one is read by ElevenLabs first)
  speed?: number;
  sound?: string;      // creature sound effect id ('none' turns off the one picked from notes)
}

/** 'online': the DM's browser using free Groq/Gemini keys. 'laptop': the NPC script with Ollama. */
export type NpcBrain = 'online' | 'laptop';

/** Written by the NPC script on the DM's computer: rooms/{roomId}/npcAi/status */
export interface NpcAiStatus {
  id: 'status';
  heartbeatAt?: number;     // epoch ms; online if recent
  activeModel?: string;     // e.g. 'qwen3:14b'
  note?: string;            // e.g. 'Close other apps for Best quality'
  busy?: boolean;           // laptop can't run any model right now
  runner?: NpcBrain;        // which brain wrote this status
  onlineOutUntil?: number;  // free online limits used up until then; the laptop covers if running
  thinking?: { mobId: string; mapId?: string; x?: number; y?: number; since: number } | null;
}

export type NpcSecretState = 'locked' | 'pending' | 'unlocked';

/** Per-NPC secret state: rooms/{roomId}/npcAi/secrets → { [mobId]: NpcSecretEntry } */
export interface NpcSecretEntry {
  state: NpcSecretState;
  reason?: string;          // what the player said that looked like the reveal condition
  at?: number;
}

export const NPC_STATUS_STALE_MS = 90_000;
export const isNpcAiOnline = (status: NpcAiStatus | null | undefined, now = Date.now()): boolean =>
  !!status?.heartbeatAt && now - status.heartbeatAt < NPC_STATUS_STALE_MS;

export interface EpisodeMobPlacement {
  mobId: string;
  mapId: string; // The map this mob is placed on (index as string)
  x: number; // Percentage of map width (0-100)
  y: number; // Percentage of map height (0-100)
  scale?: number; // Optional scale multiplier for display (1 = normal size)
  currentHP?: number; // Per-placement HP override (persisted after combat, episode-specific)
  inventoryOverride?: InventoryItem[]; // Per-placement inventory override (episode-specific)
  goldOverride?: number; // Per-placement gold override (episode-specific)
  letterIndex?: number; // Stable letter assignment (0=A, 1=B, etc.) — survives deletion of other placements
  hostile?: boolean; // DM's call for this token; absent = creatures hostile, characters friendly (isPlacementHostile)
}

export interface CrawlerPlacement {
  crawlerId: string;
  mapId: string; // The map this crawler is placed on
  x: number; // Percentage of map width (0-100)
  y: number; // Percentage of map height (0-100)
}

export interface MapData {
  id: string;
  name: string;
  imageUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FogOfWarData {
  enabled: boolean;
  // Array of revealed areas as circles (x, y, radius in percentages)
  revealedAreas: { x: number; y: number; radius: number }[];
}

export interface MapSettings {
  fogOfWar: FogOfWarData;
  scale: number; // Scale percentage (100 = normal)
}

// Loot Box Types
export type LootBoxTier = 'Dirt' | 'Copper' | 'Silver' | 'Gold';

// An achievement a loot box adds to the crawler's trophies when their box is unlocked
export interface LootBoxAchievement {
  name: string;
  description?: string;
}

export interface LootBoxTemplate {
  id: string;
  name: string;
  tier: LootBoxTier;
  items: InventoryItem[];
  gold?: number;
  achievement?: LootBoxAchievement | null; // null clears it on edit
}

export interface SentLootBox {
  id: string;
  episodeId: string;
  crawlerId: string;
  name: string;
  tier: LootBoxTier;
  items: InventoryItem[];
  gold?: number;
  achievement?: LootBoxAchievement | null;
  locked: boolean;
  sentAt: string;
  unlockedAt?: string;
}

export const getLootBoxTierColor = (tier: LootBoxTier): string => {
  switch (tier) {
    case 'Dirt': return '#8B4513';
    case 'Copper': return '#B87333';
    case 'Silver': return '#C0C0C0';
    case 'Gold': return '#FFD700';
  }
};

export const getLootBoxTierBorder = (tier: LootBoxTier): string => {
  switch (tier) {
    case 'Dirt': return 'border-[#8B4513]';
    case 'Copper': return 'border-[#B87333]';
    case 'Silver': return 'border-[#C0C0C0]';
    case 'Gold': return 'border-[#FFD700]';
  }
};

// Noncombat turn state - synced via Firebase
export interface NoncombatTurnState {
  id: string; // always 'current'
  turnNumber: number;
  rollsUsed: Record<string, number>; // crawlerId -> number of rolls used
  maxRolls: number; // rolls per player per turn (default 3)
  feetMoved?: Record<string, number>; // crawlerId -> feet moved this noncombat turn
  episodeId?: string; // tracks which episode this turn state belongs to
}

// Game clock state - synced via Firebase (singleton doc, id = 'current')
export interface GameClockState {
  id: string; // always 'current'
  gameTime: number; // epoch milliseconds representing in-game time
}

// Combat system types
export type CombatPhase = 'initiative' | 'combat' | 'ended';

export interface CombatantEntry {
  id: string; // crawlerId or mob combatant ID (e.g. 'mobId:0' for duplicates)
  sourceId?: string; // original mob/crawler document ID for data lookups (defaults to id)
  type: 'crawler' | 'mob';
  name: string;
  initiative: number; // d20 roll result + modifier
  hasRolledInitiative: boolean;
  hasUsedAction: boolean;
  hasUsedBonusAction: boolean;
  avatar?: string; // Deprecated: no longer saved (images made combat docs too big); look up the crawler/mob instead
  currentHP?: number; // per-combatant HP tracking (used for mob instances)
  feetMovedThisTurn?: number; // crawler movement used this turn (reset when the turn ends)
  looted?: boolean; // mob only: its items and gold were already handed out when it went down
  conditions?: ActiveCondition[]; // spell effects on this combatant; they tick down at the end of its turns
}

// Combat state - synced via Firebase (singleton doc, id = 'current')
export interface CombatState {
  id: string; // always 'current'
  active: boolean;
  phase: CombatPhase;
  combatants: CombatantEntry[];
  currentTurnIndex: number;
  combatRound: number;
  episodeId?: string; // ties combat to a specific episode
  combatCount?: number; // how many times combat has been started (cumulative counter)
  turnTimerMode?: 'countdown' | 'stopwatch'; // default: 'countdown'
  turnTimerDuration?: number; // countdown seconds, default: 60
  turnTimerPaused?: boolean; // DM can pause the timer
  turnStartedAt?: number; // epoch ms when current turn started
  turnSnapshot?: CombatTurnSnapshot | null; // checkpoint of the current turn, used to undo it
}

// What the game looked like when a combat turn started, so the player can undo the turn.
// Only small, mutable fields are kept (combatant avatars are not copied) to stay well
// under the Firestore document size limit.
export interface CombatTurnSnapshot {
  combatantId: string; // whose turn this checkpoint belongs to
  takenAt: number; // epoch ms
  combatants: {
    id: string;
    currentHP?: number;
    hasUsedAction: boolean;
    hasUsedBonusAction: boolean;
    feetMovedThisTurn?: number;
    conditions?: ActiveCondition[];
  }[];
  // HP, mana and activity stats of every crawler in the fight (damage and healing can hit anyone)
  crawlers: Record<string, { hp: number; mana: number; activityStats?: CrawlerActivityStats; stats?: CrawlerStats }>;
  knownSpells?: KnownSpell[]; // the active crawler's spells (cast counts change when casting)
  startPosition?: { episodeId: string; mapId: string; x: number; y: number } | null; // token spot before the first move
}

export interface Episode {
  id: string;
  name: string;
  description: string;
  mapIds: string[]; // Indices of maps in the maps array
  mobPlacements: EpisodeMobPlacement[]; // Mobs with positions
  crawlerPlacements?: CrawlerPlacement[]; // Pre-placed crawlers with positions
  mapSettings?: { [mapId: string]: MapSettings }; // Per-map settings
  defaultFogOfWar?: boolean; // Default fog of war setting for new maps
  lootBoxes?: LootBoxTemplate[]; // Deprecated: embedded templates (for backwards compatibility)
  lootBoxIds?: string[]; // IDs of loot box templates assigned to this episode
  questIds?: string[]; // IDs of quests assigned to this episode
  startingGameTime?: number; // epoch ms for the game clock starting time
  createdBy?: string;        // Firebase uid of creator (absent = made in this campaign by its DM)
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Shared to the community (publicEpisodes)
  createdAt?: string;
  updatedAt?: string;
}

// ── Public (community) content ──────────────────────────────────────────────
// Stored in root-level collections, not scoped to a campaign room.
// Public doc IDs are `${sourceCampaignId}__${sourceId}` so copies of a campaign never collide.

/** A map document in a campaign's `maps` collection, aligned with the `maps: string[]` index. */
export interface CampaignMapDoc {
  id: string;
  name: string;
  image: string;
  createdBy?: string;
  createdByUsername?: string;
  isPublic?: boolean;
}

/** publicMaps/{id} */
export interface PublicMap {
  id: string;
  sourceId: string;
  sourceCampaignId: string;
  name: string;
  image: string;
  createdBy: string;
  createdByUsername?: string;
  publishedAt: number;
}

/** publicMobs/{id} — a mob type (no placements or campaign state) */
export interface PublicMob extends Mob {
  sourceId: string;
  sourceCampaignId: string;
  publishedAt: number;
}

/**
 * publicEpisodes/{id} — a self-contained, playable episode.
 * Heavy assets live in subcollections so the doc stays under Firestore's 1 MB limit:
 *   publicEpisodes/{id}/maps/{index}  → { index, name, image }
 *   publicEpisodes/{id}/mobs/{mobId}  → Mob
 * Inside the bundle, map IDs are bundle indices ("0", "1", ...).
 */
export interface PublicEpisode {
  id: string;
  sourceId: string;
  sourceCampaignId: string;
  name: string;
  description: string;
  createdBy: string;
  createdByUsername?: string;
  publishedAt: number;
  mapNames: string[];
  mobNames: string[];
  mobPlacements: EpisodeMobPlacement[];
  mapSettings?: { [bundleMapIndex: string]: MapSettings };
  defaultFogOfWar?: boolean;
  startingGameTime?: number;
  lootBoxTemplates: LootBoxTemplate[];
  quests?: Quest[]; // Progress (claimedBy/completedBy/notes) cleared; absent on episodes shared before quests were supported
}

export interface PublicEpisodeAssets {
  maps: { name: string; image: string }[]; // ordered by bundle index
  mobs: Mob[];
}

// Quest system types
export type QuestRewardTier = 'Dirt' | 'Copper' | 'Silver' | 'Gold';

export interface QuestReward {
  id: string;
  item: InventoryItem;
  tier: QuestRewardTier;
  visible: boolean; // DM can show/hide rewards
  claimedBy?: string[]; // crawlerIds that have claimed this reward
}

export interface QuestActionItem {
  id: string;
  description: string;
  visible: boolean; // DM can show/hide action items
  completedBy: string[]; // crawlerIds that have completed this action item
}

export interface QuestNote {
  id: string;
  crawlerId: string;
  crawlerName: string;
  text: string;
  createdAt: string;
  language?: string; // Written in this language: scrambled for crawlers who don't know it
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  rewards: QuestReward[];
  actionItems: QuestActionItem[];
  notes: QuestNote[];
  xpReward?: number;      // XP each crawler gets for finishing every visible action item; missing = XP_REWARDS.questDefault
  createdAt: string;
  updatedAt: string;
}

// Campaign-wide game settings (singleton doc, id = 'current')
export interface GameSettings {
  id: string;
  xpScale?: number; // multiplies all automatic XP; 1 = 100%
  dungeonFloor?: number; // the floor the party is on; raises skill check DCs (1 if missing)
  hideItemLibrary?: boolean; // DM switch: players can't see the Item Library on the Inventory page
  hideSpellLibrary?: boolean; // DM switch: players can't see the Spell Library on the Spells page
}

// ---- Skill check difficulty ----
// DCs rise 2 per dungeon floor so the d20 keeps mattering as bonuses grow.
// A natural 1 always fails and a natural 20 always succeeds.
export const CHECK_DIFFICULTIES = [
  { id: 'easy', name: 'Easy', base: 10 },
  { id: 'medium', name: 'Medium', base: 15 },
  { id: 'hard', name: 'Hard', base: 20 },
] as const;
export type CheckDifficultyId = typeof CHECK_DIFFICULTIES[number]['id'];
export const DC_PER_FLOOR = 2;

export const getCheckDC = (difficulty: CheckDifficultyId, floor = 1): number =>
  (CHECK_DIFFICULTIES.find(d => d.id === difficulty)?.base ?? 15) + DC_PER_FLOOR * (Math.max(1, Math.floor(floor)) - 1);

export const isCheckSuccess = (rawRoll: number, total: number, dc: number): boolean =>
  rawRoll === 1 ? false : rawRoll === 20 ? true : total >= dc;

export interface AssignedQuest {
  id: string;
  questId: string;
  crawlerIds: string[]; // which crawlers have this quest
  isPartyQuest: boolean; // true if all crawlers participate
  episodeId?: string; // optional episode link
  assignedAt: string;
  completedAt?: string;
  // Progress for this handout. Older handouts lack these and fall back to the quest's own fields.
  visibleActionIds?: string[];
  completedActions?: Record<string, string[]>; // actionItemId -> crawlerIds
  visibleRewardIds?: string[];
  claimedRewards?: Record<string, string[]>; // rewardId -> crawlerIds
  notes?: QuestNote[];
  xpAwardedTo?: string[]; // crawlerIds already given this handout's quest XP, so un-ticking and re-ticking can't repeat it
}

export interface QuestProgress {
  visibleActionIds: string[];
  completedActions: Record<string, string[]>;
  visibleRewardIds: string[];
  claimedRewards: Record<string, string[]>;
  notes: QuestNote[];
}

/** Fresh progress for a new handout: the quest's show/hide settings are the starting point. */
export const newQuestProgress = (quest: Quest): QuestProgress => ({
  visibleActionIds: (quest.actionItems || []).filter(a => a.visible).map(a => a.id),
  completedActions: {},
  visibleRewardIds: (quest.rewards || []).filter(r => r.visible).map(r => r.id),
  claimedRewards: {},
  notes: [],
});

/** Progress for one handout, reading the quest's legacy fields for handouts made before progress moved. */
export const getQuestProgress = (quest: Quest, assigned: AssignedQuest): QuestProgress => ({
  visibleActionIds: assigned.visibleActionIds
    ?? (quest.actionItems || []).filter(a => a.visible).map(a => a.id),
  completedActions: assigned.completedActions
    ?? Object.fromEntries((quest.actionItems || []).map(a => [a.id, a.completedBy || []])),
  visibleRewardIds: assigned.visibleRewardIds
    ?? (quest.rewards || []).filter(r => r.visible).map(r => r.id),
  claimedRewards: assigned.claimedRewards
    ?? Object.fromEntries((quest.rewards || []).map(r => [r.id, r.claimedBy || []])),
  notes: assigned.notes ?? quest.notes ?? [],
});

export interface WikiPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  category: string;
  order: number;
  updatedAt?: string;
  updatedBy?: string;
}

// User profile — one per authenticated Firebase user (root-level collection)
export interface UserProfile {
  id: string;             // Firebase Auth uid
  username: string;       // Unique tag e.g. "DragonSlayer42"
  displayName: string;    // Freeform display name
  avatarUrl?: string;     // Optional avatar (from Google or uploaded)
  email?: string;         // Stored for reference (populated from auth)
  createdAt: number;      // Epoch ms
  updatedAt: number;
  showPublicContent?: boolean; // Whether to show public content from other players
}

// Campaign — groups players into a room with a single DM (root-level collection)
export interface Campaign {
  id: string;             // Auto-generated
  name: string;           // Campaign name
  description?: string;   // Optional description
  ownerId: string;        // Firebase uid of campaign creator (the DM)
  ownerName: string;      // Denormalized display name for UI
  memberIds: string[];    // Firebase uids of players who have joined (max 10)
  maxMembers: number;     // Max player count (default 10)
  inviteCode: string;     // Short unique code for invite links
  lastJoinCode?: string;  // Invite code the latest joiner used (security rules check it matches inviteCode)
  createdAt: number;
  updatedAt: number;
}

export const MAX_CAMPAIGN_MEMBERS = 10;

// Friend request — sent between users (root-level collection)
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;               // Auto-generated
  fromUserId: string;        // Firebase uid of sender
  fromUsername: string;       // Denormalized for display
  fromDisplayName: string;   // Denormalized for display
  fromAvatarUrl?: string;    // Denormalized for display
  toUserId: string;          // Firebase uid of recipient
  toUsername: string;         // Denormalized for display
  toDisplayName: string;     // Denormalized for display
  toAvatarUrl?: string;      // Denormalized for display
  status: FriendRequestStatus;
  createdAt: number;
  updatedAt: number;
}

// Audit record for significant user decisions/setting changes (root-level collection)
export interface UserDecision {
  id: string;
  userId: string;
  username?: string;          // Denormalized for display in reports
  action: string;             // e.g. 'enable_public_content', 'disable_public_content'
  label: string;              // Human-readable description
  oldValue?: unknown;         // Previous value (for toggles/settings)
  newValue?: unknown;         // New value
  context?: string;           // Optional extra context (e.g. campaign id)
  timestamp: number;          // Epoch ms
}

export const defaultCrawlers: Crawler[] = [
  {
    id: "1",
    name: "Carl",
    race: "Human",
    job: "Brawler",
    level: 3,
    hp: 85,
    maxHP: 100,
    mana: 30,
    maxMana: 50,
    str: 14,
    dex: 12,
    con: 16,
    int: 10,
    cha: 15,
    achievements: "Survivor. First Blood. Gnome Slayer.",
    gold: 75,
  },
  {
    id: "2",
    name: "Princess Donut",
    race: "Cat",
    job: "Royal Companion",
    level: 3,
    hp: 45,
    maxHP: 50,
    mana: 80,
    maxMana: 100,
    str: 4,
    dex: 18,
    con: 8,
    int: 14,
    cha: 20,
    achievements: "Royalty. Fan Favorite. Precious.",
    gold: 52,
  },
];

export const defaultInventory: { crawlerId: string; items: InventoryItem[] }[] = [
  {
    crawlerId: "1",
    items: [
      { id: "1", name: "Dirty Underpants", description: "Legendary protection", equipped: true },
      { id: "2", name: "Spiked Knuckles", description: "+2 Unarmed DMG", equipped: true },
      { id: "3", name: "Health Potion", description: "Restores 25 HP" },
    ],
  },
  {
    crawlerId: "2",
    items: [
      { id: "4", name: "Tiara of Authority", description: "+5 CHA, +3 Intimidation", equipped: true },
      { id: "5", name: "Royal Collar", description: "Mark of Nobility", equipped: true },
    ],
  },
];

export const defaultMobs: Mob[] = [
  {
    id: "1",
    name: "Gnome Decapitator",
    level: 2,
    type: "normal",
    description: "Nasty little buggers with a fondness for ankles and heavy blades.",
    encountered: true,
    hidden: false,
    weaknesses: "Being stepped on, fire",
    strengths: "Speed, ambush tactics",
    hitPoints: 25,
  },
  {
    id: "2",
    name: "The Newbie Killer",
    level: 5,
    type: "boss",
    description: "A terrifying creature that haunts the first floor. Many crawlers have fallen to its claws.",
    encountered: false,
    hidden: true,
    weaknesses: "Unknown",
    strengths: "Unknown",
    hitPoints: 150,
  },
  {
    id: "3",
    name: "Biscuit Monster",
    level: 3,
    type: "normal",
    description: "A twisted creature made of what appears to be baked goods. Surprisingly deadly.",
    encountered: true,
    hidden: false,
    weaknesses: "Water, milk",
    strengths: "Hardened crust armor",
    hitPoints: 40,
  },
];
