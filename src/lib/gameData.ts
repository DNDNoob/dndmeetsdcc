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
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  equipped?: boolean;
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
  x: number; // Percentage of map width (0-100)
  y: number; // Percentage of map height (0-100)
  scale?: number; // Optional scale multiplier for display (1 = normal size)
}

export interface MapData {
  id: string;
  name: string;
  imageUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Episode {
  id: string;
  name: string;
  description: string;
  mapIds: string[]; // Indices of maps in the maps array
  mobPlacements: EpisodeMobPlacement[]; // Mobs with positions
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
