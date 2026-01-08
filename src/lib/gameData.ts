export interface Crawler {
  id: string;
  name: string;
  race: string;
  job: string;
  level: number;
  hp: number;
  maxHP: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  achievements: string;
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
  type: "normal" | "boss";
  description: string;
  encountered: boolean;
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
    str: 14,
    dex: 12,
    con: 16,
    int: 10,
    wis: 8,
    cha: 15,
    achievements: "Survivor. First Blood. Gnome Slayer.",
  },
  {
    id: "2",
    name: "Princess Donut",
    race: "Cat",
    job: "Royal Companion",
    level: 3,
    hp: 45,
    maxHP: 50,
    str: 4,
    dex: 18,
    con: 8,
    int: 14,
    wis: 12,
    cha: 20,
    achievements: "Royalty. Fan Favorite. Precious.",
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
    description: "Nasty little buggers with a fondness for ankles and heavy blades. Weakness: Being stepped on.",
    encountered: true,
  },
  {
    id: "2",
    name: "The Newbie Killer",
    level: 5,
    type: "boss",
    description: "A terrifying creature that haunts the first floor. Many crawlers have fallen to its claws.",
    encountered: false,
  },
  {
    id: "3",
    name: "Biscuit Monster",
    level: 3,
    type: "normal",
    description: "A twisted creature made of what appears to be baked goods. Surprisingly deadly.",
    encountered: true,
  },
];

export const partyGold = 127.5;
