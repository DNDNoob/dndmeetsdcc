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
}

export type StatModifiers = Partial<Record<'str' | 'dex' | 'con' | 'int' | 'cha' | 'hp' | 'maxHP' | 'mana' | 'maxMana', number>>;

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  equipSlot?: EquipmentSlot; // Which slot this item can be equipped to
  goldValue?: number; // Value of the item in gold
  equipped?: boolean; // Deprecated - use equippedItems in Crawler instead
  statModifiers?: StatModifiers; // Stat adjustments when equipped
  tags?: string[]; // Custom tags for filtering (e.g., "magic", "cursed", "quest")
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
}

export interface EpisodeMobPlacement {
  mobId: string;
  mapId: string; // The map this mob is placed on (index as string)
  x: number; // Percentage of map width (0-100)
  y: number; // Percentage of map height (0-100)
  scale?: number; // Optional scale multiplier for display (1 = normal size)
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
  createdAt?: string;
  updatedAt?: string;
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
