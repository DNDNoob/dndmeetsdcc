import { baseItemName, type Crawler, type GameSettings, type InventoryItem } from './gameData';

// ======== Encountered items and spells ========
// In "Encountered only" mode players see just the library entries their crawler (or the party) has
// come across. Seen = name, icon, description and type; Known = every detail.
// Stored in rooms/{roomId}/discoveries: one doc per crawler (id = crawlerId) plus a 'party' doc
// holding what crawlers shared and what the DM revealed. Levels only go up, except when the DM hides.

export type LibraryKind = 'items' | 'spells';
export type LibraryMode = 'full' | 'encountered' | 'hidden';
export const LIBRARY_MODES: { id: LibraryMode; label: string; hint: string }[] = [
  { id: 'full', label: 'Full', hint: 'Players see the whole library' },
  { id: 'encountered', label: 'Encountered', hint: 'Players see only what they have come across' },
  { id: 'hidden', label: 'Hidden', hint: 'Players see no library' },
];

export const SEEN = 1;
export const KNOWN = 2;
export type DiscoveryLevel = 0 | typeof SEEN | typeof KNOWN;

export interface ItemTranslation {
  text: string;      // what the party reads
  byId: string;      // translating crawler
  byName: string;
  twisted?: boolean; // the translator changed the meaning; only they and the DM know
  at: number;
}

export interface DiscoveryDoc {
  id: string; // crawlerId, or PARTY_DISCOVERY_ID
  items?: Record<string, number>;  // item key -> level
  spells?: Record<string, number>; // spell id -> level
  sharedBy?: Record<string, string>; // `${kind}:${key}` -> crawler name (party doc only)
  translations?: Record<string, ItemTranslation>; // item key -> shared translation (party doc only)
}

export const PARTY_DISCOVERY_ID = 'party';

/** Library items are matched by name, so every copy (and an upgraded one) shares one key. */
export const itemDiscoveryKey = (item: Pick<InventoryItem, 'name' | 'isUpgraded'>): string => {
  const key = baseItemName(item).trim().toLowerCase();
  // Firestore rejects field names like __x__
  return /^__.*__$/.test(key) ? `_${key}` : key;
};

export const getLibraryMode = (settings: GameSettings | null | undefined, kind: LibraryKind): LibraryMode => {
  const mode = kind === 'items' ? settings?.itemLibraryMode : settings?.spellLibraryMode;
  if (mode) return mode;
  const hidden = kind === 'items' ? settings?.hideItemLibrary : settings?.hideSpellLibrary;
  if (hidden === true) return 'hidden';
  if (hidden === false) return 'full'; // the DM chose "Shown" before modes existed
  return 'encountered';
};

/** What a crawler holds right now: owned items and known spells are Known, spells in tomes they carry are Seen. */
export const getOwnedDiscoveries = (crawler: Crawler, inventory: InventoryItem[]) => {
  const items: Record<string, number> = {};
  const spells: Record<string, number> = {};
  for (const item of inventory) {
    const key = itemDiscoveryKey(item);
    if (key) items[key] = KNOWN;
    for (const entry of item.isSpellTome ? item.spellTomeData?.entries ?? [] : []) {
      if (entry.spellId && !spells[entry.spellId]) spells[entry.spellId] = SEEN;
    }
  }
  for (const ks of crawler.knownSpells ?? []) spells[ks.spellId] = KNOWN;
  return { items, spells };
};

/** Everything one viewer can look up about library entries. The DM's view knows everything. */
export interface DiscoveryView {
  isAdmin: boolean;
  crawler: Crawler | null;
  levelOf: (kind: LibraryKind, key: string) => number;    // best of own + party
  ownLevelOf: (kind: LibraryKind, key: string) => number;
  partyLevelOf: (kind: LibraryKind, key: string) => number;
  sharedByOf: (kind: LibraryKind, key: string) => string | undefined;
  translationOf: (itemKey: string) => ItemTranslation | undefined;
  /** DM: crawlers who know the entry (by name) */
  knownByOf: (kind: LibraryKind, key: string) => string[];
}

export const buildDiscoveryView = (
  docs: DiscoveryDoc[],
  crawlers: Crawler[],
  getInventory: (crawlerId: string) => InventoryItem[],
  viewer: Crawler | null,
  isAdmin: boolean,
): DiscoveryView => {
  const party = docs.find(d => d.id === PARTY_DISCOVERY_ID);
  const docOf = (id: string) => docs.find(d => d.id === id);
  const ownedCache = new Map<string, ReturnType<typeof getOwnedDiscoveries>>();
  const owned = (c: Crawler) => {
    if (!ownedCache.has(c.id)) ownedCache.set(c.id, getOwnedDiscoveries(c, getInventory(c.id)));
    return ownedCache.get(c.id)!;
  };
  const crawlerLevel = (c: Crawler, kind: LibraryKind, key: string) =>
    Math.max(docOf(c.id)?.[kind]?.[key] ?? 0, owned(c)[kind][key] ?? 0);
  const partyLevelOf = (kind: LibraryKind, key: string) => party?.[kind]?.[key] ?? 0;
  const ownLevelOf = (kind: LibraryKind, key: string) => (viewer ? crawlerLevel(viewer, kind, key) : 0);
  return {
    isAdmin,
    crawler: viewer,
    levelOf: (kind, key) => (isAdmin ? KNOWN : Math.max(ownLevelOf(kind, key), partyLevelOf(kind, key))),
    ownLevelOf,
    partyLevelOf,
    sharedByOf: (kind, key) => party?.sharedBy?.[`${kind}:${key}`],
    translationOf: (itemKey) => party?.translations?.[itemKey],
    knownByOf: (kind, key) => crawlers.filter(c => crawlerLevel(c, kind, key) >= KNOWN).map(c => c.name),
  };
};
