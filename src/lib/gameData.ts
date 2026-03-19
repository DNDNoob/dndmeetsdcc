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
}

export type StatModifiers = Partial<Record<'str' | 'dex' | 'con' | 'int' | 'cha' | 'hp' | 'maxHP' | 'mana' | 'maxMana', number>>;

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

export const SPELL_ACTION_TYPES = ['Action', 'Bonus Action'] as const;
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

export interface Mob {
  id: string;
  name: string;
  level: number;
  type: "normal" | "boss" | "npc";
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
}

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
  avatar?: string; // cached avatar/image for display
  currentHP?: number; // per-combatant HP tracking (used for mob instances)
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
  createdAt?: string;
  updatedAt?: string;
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
