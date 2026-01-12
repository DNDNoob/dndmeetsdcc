# Data Types Reference

Complete guide to all data types and their relationships.

## Core Data Types

### Crawler (Player Character)

```typescript
interface Crawler {
  id: string;                    // Unique identifier (UUID or timestamp)
  name: string;                  // Character name (e.g., "Carl", "Princess Donut")
  race: string;                  // Race (e.g., "Human", "Cat", "Elf")
  job: string;                   // Class/Job (e.g., "Brawler", "Wizard")
  level: number;                 // Experience level (1-20+)
  hp: number;                    // Current hit points
  maxHP: number;                 // Maximum hit points
  mana: number;                  // Current mana
  maxMana: number;               // Maximum mana
  str: number;                   // Strength attribute (1-20)
  dex: number;                   // Dexterity attribute (1-20)
  con: number;                   // Constitution attribute (1-20)
  int: number;                   // Intelligence attribute (1-20)
  cha: number;                   // Charisma attribute (1-20)
  achievements: string;          // Comma-separated achievements (free-form text)
  gold: number;                  // Currency amount
  avatar?: string;               // Base64 encoded image or URL (optional)
}
```

**Storage**: Firestore collection `crawlers`
**Default Data**: See `src/lib/gameData.ts` (Carl, Princess Donut, etc.)
**Lifecycle**: Created by users in ProfilesView, persisted immediately

---

### InventoryItem

```typescript
interface InventoryItem {
  id: string;                    // Unique identifier (usually timestamp)
  name: string;                  // Item name (e.g., "Health Potion")
  description: string;           // Item description/stats
  equipped?: boolean;            // Whether item is equipped (default: false)
}
```

**Storage**: Part of InventoryEntry (see below)
**Example**: 
```json
{
  "id": "1",
  "name": "Dirty Underpants",
  "description": "Legendary protection",
  "equipped": true
}
```

---

### InventoryEntry (Wrapper)

```typescript
interface InventoryEntry {
  id?: string;                   // Optional, usually omitted
  crawlerId: string;             // Foreign key to Crawler (DOCUMENT ID MUST MATCH)
  items: InventoryItem[];        // Array of items this crawler owns
}
```

**⚠️ CRITICAL**: The Firestore document ID MUST be the `crawlerId`:
```
Collection: inventory
├── Document ID: "crawler-1" (matches crawler.id)
│   └── { crawlerId: "crawler-1", items: [...] }
├── Document ID: "crawler-2"
│   └── { crawlerId: "crawler-2", items: [...] }
```

**Storage**: Firestore collection `inventory`
**Default Data**: See `src/lib/gameData.ts`
**Lifecycle**: Created automatically when new Crawler added, items updated in InventoryView

---

### Mob (Enemy/NPC)

```typescript
interface Mob {
  id: string;                    // Unique identifier
  name: string;                  // Mob name (e.g., "Dragon", "Goblin")
  level: number;                 // Difficulty level
  type: "normal" | "boss" | "npc";  // Mob classification
  description: string;           // Flavor text
  encountered: boolean;          // Has player met this mob?
  hidden: boolean;               // Should DM hide from players?
  image?: string;                // Base64 image or URL (optional)
  weaknesses?: string;           // Weakness description (optional)
  strengths?: string;            // Strength description (optional)
  hitPoints?: number;            // Current/max HP (optional)
  hideWeaknesses?: boolean;      // DM option to hide weaknesses (default: false)
  hideStrengths?: boolean;       // DM option to hide strengths (default: false)
  hideHitPoints?: boolean;       // DM option to hide HP (default: false)
}
```

**Storage**: Firestore collection `mobs`
**Types**:
- `normal`: Regular monster
- `boss`: Boss encounter (usually stronger, special rewards)
- `npc`: Friendly NPC or quest giver

**Default Data**: Gnome Decapitator, The Newbie Killer, Biscuit Monster

**Visibility Logic** (see MobsView.tsx):
- Admins see all mobs
- Players see only non-hidden (`!mob.hidden`) mobs
- Optional fields can be hidden via boolean flags

---

### Map

```typescript
type Map = string;  // Base64 encoded PNG/JPG image
```

**Storage**: Firestore collection `maps` (array of strings)
**Example**:
```typescript
[
  "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
]
```

**Size Limit**: Each map must be <1MB when encoded
- Larger images are stripped before save (see `useFirebaseStore` cleanObject)
- Typically 750KB of base64 = ~1MB raw

**Usage** (MapsView.tsx):
```typescript
<img src={map} alt={`Map ${index + 1}`} />
```

---

## Collection Registration

All collections that are auto-synced must be registered in `useFirebaseStore.ts`:

```typescript
const collections: CollectionName[] = [
  'crawlers',
  'mobs', 
  'maps',
  'inventory'
];
```

### Extending Collections

To add a new data type (e.g., quests):

1. **Define the type** in appropriate location:
```typescript
// src/types/collections.ts or src/lib/gameData.ts
export interface Quest {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  reward: number;
}
```

2. **Add to CollectionName type** (src/types/collections.ts):
```typescript
export type CollectionName = 
  | 'crawlers'
  | 'mobs'
  | 'maps'
  | 'inventory'
  | 'quests'  // ← Add here
  | string;
```

3. **Register in useFirebaseStore**:
```typescript
const collections: CollectionName[] = [
  'crawlers',
  'mobs', 
  'maps',
  'inventory',
  'quests'  // ← Add here
];
```

4. **Use it in components**:
```typescript
const { addItem, getCollection } = useGame();

// Get all quests
const quests = getCollection('quests') as Quest[];

// Add a quest
addItem('quests', {
  id: crypto.randomUUID(),
  name: 'Defeat the Dragon',
  description: 'Slay the evil dragon on Level 5',
  completed: false,
  reward: 1000
});
```

**That's it!** The new collection auto-syncs with Firestore. ✅

---

## Relationships & Foreign Keys

### Crawler → InventoryEntry (One-to-Many)
```
Crawler (id: "crawler-1")
  ↓
InventoryEntry (crawlerId: "crawler-1", items: [...])
  ↓
  ├── InventoryItem (id: "item-1")
  ├── InventoryItem (id: "item-2")
  └── InventoryItem (id: "item-3")
```

**How to fetch**:
```typescript
const getCrawlerInventory = (crawlerId: string) => {
  return inventory.find((i) => i.crawlerId === crawlerId)?.items || [];
};
```

### Crawler → Mob (Many-to-Many, no enforced relationship)
- Crawlers can fight multiple mobs
- Mobs can be fought by multiple crawlers
- Relationship is implicit (Mob.encountered tracks if someone encountered it)

---

## Default Data

All collections ship with default data for testing:

### defaultCrawlers
- Carl (Human Brawler, Level 3)
- Princess Donut (Cat Royal Companion, Level 3)

### defaultInventory
- Carl: Dirty Underpants, Spiked Knuckles, Health Potion
- Princess Donut: Tiara of Authority, Royal Collar

### defaultMobs
- Gnome Decapitator (normal, level 2, encountered)
- The Newbie Killer (boss, level 5, hidden)
- Biscuit Monster (normal, level 3, encountered)

**How they load** (useGameState.ts):
```typescript
const crawlers = useMemo(() => {
  const stored = getCollection('crawlers') as Crawler[];
  if (!isLoaded || stored.length === 0) return defaultCrawlers;
  return stored;
}, [getCollection('crawlers'), isLoaded]);
```

If Firestore is empty or not yet loaded, defaults are shown.

---

## Type Safety

All types are fully TypeScript and exported from `src/lib/gameData.ts`:

```typescript
import {
  Crawler,
  InventoryItem,
  Mob,
  defaultCrawlers,
  defaultInventory,
  defaultMobs,
  createEmptyCrawler
} from '@/lib/gameData';
```

### Creating Typed Collections

```typescript
const crawlers = getCollection<Crawler>('crawlers');
const mobs = getCollection<Mob>('mobs');
const quests = getCollection<Quest>('quests');
```

---

## Data Size Considerations

| Type | Typical Size | Notes |
|------|--------------|-------|
| Crawler | ~500 bytes | No images included |
| InventoryEntry | ~2KB | Average ~10 items per crawler |
| Mob | ~2KB | Image optional, may be stripped |
| Map | 500KB-1MB | Base64 encoded image |

**Total per game**: ~50-100KB data (excludes large images)

**Firestore Limits**:
- Document size: 1MB max (enforced)
- Collection size: Unlimited
- Real-time listeners: 100 per app instance
- Write rate: 1 write per document per second

Current project uses 4 collections × multiple docs = safe well within limits.

