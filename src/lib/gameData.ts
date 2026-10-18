import type { NpcSpeaker } from './npc/speakers.mjs';
export { getMobKind, isBossMob, isPlacementHostile, baseMobId, mapSpeakers } from './npc/speakers.mjs';
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
  return Math.max(0, (crawler.moveSpeed ?? DEFAULT_MOVE_SPEED) + (mods.moveSpeed ?? 0));
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
  splashDamage?: boolean;
  reactionTrigger?: string; // For Reaction spells: describes what triggers the reaction (e.g. "when you are hit by an attack")
}

export interface Spell {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  spellData: SpellData;
  createdBy?: string;        // Firebase uid of creator
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Whether visible to players outside the campaign
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

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  equipSlot?: EquipmentSlot; // Which slot this item can be equipped to
  goldValue?: number; // Value of the item in gold
  equipped?: boolean; // Deprecated - use equippedItems in Crawler instead
  statModifiers?: StatModifiers; // Stat adjustments when equipped
  tags?: string[]; // Custom tags for filtering (e.g., "magic", "cursed", "quest")
  weaponData?: WeaponData; // Weapon-specific data (only for items with "weapon" tag or weapon equipSlot)
  isUpgraded?: boolean; // Whether this item has been upgraded by a crawler
  isSpellTome?: boolean; // Consumable that teaches a spell when used
  spellTomeData?: {
    entries: Array<{
      spellId?: string; // References a spell in the library
      customSpell?: Spell; // Embedded one-off spell (not in library)
    }>;
  };
  createdBy?: string;        // Firebase uid of creator
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Whether visible to players outside the campaign
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
  equippedItems?: EquippedItems; // Equipment mapping (slot → item ID)
  createdBy?: string;        // Firebase uid of creator (absent = made in this campaign by its DM)
  createdByUsername?: string; // Denormalized for display
  isPublic?: boolean;        // Shared to the community (publicMobs)
  personality?: NpcPersonality; // DM-only: drives AI dialogue for talking NPCs
  merchant?: MerchantConfig;  // NPCs that buy and sell items with crawlers
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

/** The Scrooge level a crawler trades at after any haggling discount. */
export const getEffectiveScrooge = (config: MerchantConfig | undefined, state: MerchantState | undefined, crawlerId?: string): number =>
  Math.max(0, Math.floor(config?.scroogeFactor ?? 0) - (crawlerId ? state?.discounts?.[crawlerId] ?? 0 : 0));

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

/** The legacy type field that matches a kind and boss flag. */
export const legacyMobType = (kind: MobKind, boss: boolean): Mob['type'] =>
  boss ? 'boss' : kind === 'character' ? 'npc' : 'normal';

/**
 * A speaker as a mob the chat can show: its own id and name ("Goblin B"), and the DM's card if
 * the mob has one, else the personality the AI wrote for this speaker.
 */
export const speakerAsMob = (speaker: NpcSpeaker, generated: Record<string, NpcGeneratedPersonality>): Mob & { personalityGenerated?: boolean } =>
  withNpcPersonality({ ...speaker.mob, id: speaker.id, name: speaker.name }, generated);

export type NpcModelChoice = 'quality' | 'fast';

/** DM settings: rooms/{roomId}/npcAi/settings */
export interface NpcAiSettings {
  id: 'settings';
  enabled?: boolean;        // NPC voices on (default) / off
  model?: NpcModelChoice;   // default 'quality'
  mutedAll?: boolean;
  mutedMobIds?: string[];
  brain?: NpcBrain;         // where NPC lines are written; default 'online'
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

export interface LootBoxTemplate {
  id: string;
  name: string;
  tier: LootBoxTier;
  items: InventoryItem[];
  gold?: number;
}

export interface SentLootBox {
  id: string;
  episodeId: string;
  crawlerId: string;
  name: string;
  tier: LootBoxTier;
  items: InventoryItem[];
  gold?: number;
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
  }[];
  // HP, mana and activity stats of every crawler in the fight (damage and healing can hit anyone)
  crawlers: Record<string, { hp: number; mana: number; activityStats?: CrawlerActivityStats }>;
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
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  rewards: QuestReward[];
  actionItems: QuestActionItem[];
  notes: QuestNote[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignedQuest {
  id: string;
  questId: string;
  crawlerIds: string[]; // which crawlers have this quest
  isPartyQuest: boolean; // true if all crawlers participate
  episodeId?: string; // optional episode link
  assignedAt: string;
  completedAt?: string;
}

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

export const createEmptyCrawler = (): Crawler => ({
  id: Date.now().toString(),
  name: "New Crawler",
  race: "Human",
  job: "Adventurer",
  level: 1,
  hp: 50,
  maxHP: 50,
  mana: 25,
  maxMana: 25,
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  cha: 10,
  achievements: "",
  gold: 0,
});

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
