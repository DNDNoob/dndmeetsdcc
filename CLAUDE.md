# CLAUDE.md - AI Development Instructions

> This project is exclusively coded by AI. Follow these instructions precisely to prevent errors.

## Quick Reference

- **Build**: `npm run build` (Vite)
- **Lint**: `npm run lint` (ESLint)
- **Dev server**: `npm run dev` (Vite HMR)
- **No test runner configured** — manual testing and Firebase CRUD tests only (`npm run test:firebase`)
- **Import alias**: Use `@/` for `src/` (e.g., `import { Crawler } from '@/lib/gameData'`)

---

## Project Architecture

```
React UI (Views/Components)
    ↓ props + callbacks
useGameState (game logic, memoized collections, diffing)
    ↓ calls
useFirebaseStore (CRUD, real-time sync, image validation, cleanObject)
    ↓ writes/reads
Firebase Firestore (NoSQL, real-time onSnapshot listeners)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useFirebaseStore.ts` | Low-level Firebase CRUD (addItem, updateItem, deleteItem, batchWrite) |
| `src/hooks/useGameState.ts` | Game logic layer (updateCrawler, setMobs, performShortRest, etc.) |
| `src/lib/gameData.ts` | Type definitions (Crawler, Mob, Episode, InventoryItem, etc.) and defaults |
| `src/lib/firebase.ts` | Firebase initialization, auth, `getCollectionRef()` |
| `src/contexts/GameContext.tsx` | React context wrapping useFirebaseStore |
| `src/types/collections.ts` | `CollectionName` type union and `PersistedItem` interface |
| `src/pages/Index.tsx` | Main page — wires useGameState to Views via props |
| `src/views/*.tsx` | Page-level view components (ProfilesView, MobsView, etc.) |
| `src/components/ui/` | Reusable UI components (DungeonButton, DungeonCard, shadcn-ui) |

---

## CRITICAL: Firebase Data Safety Rules

### Never Overwrite Existing Documents

When modifying existing documents, you **MUST** use `type: 'update'` (not `type: 'add'`) to avoid data loss:

```typescript
// ✅ CORRECT — preserves all other fields
await batchWrite([{
  type: 'update',
  collection: 'crawlers',
  id: crawlerId,
  data: { hp: newHP, mana: newMana }
}]);

// ✅ ALSO CORRECT
await updateCrawler(crawlerId, { hp: newHP });
await updateItem('crawlers', crawlerId, { hp: newHP });
```

```typescript
// ❌ WRONG — REPLACES the entire document, wiping all other fields!
await batchWrite([{
  type: 'add',  // <-- DANGER: uses batch.set() which overwrites everything
  collection: 'crawlers',
  id: existingCrawlerId,
  data: { hp: 50 }  // All other data (name, stats, image) will be DELETED
}]);
```

### Operation Types Summary

| Type | Firebase Call | Behavior | Use When |
|------|-------------|----------|----------|
| `'add'` | `batch.set()` | Creates new OR **completely replaces** existing | Creating new documents only (never use if document might already exist) |
| `'update'` | `batch.update()` | **Merges** fields, preserving unlisted fields | Modifying existing documents |
| `'delete'` | `batch.delete()` | Removes document entirely | Deleting documents |

### Helper Functions (prefer these over raw addItem/updateItem)

| Function | Uses | Purpose |
|----------|------|---------|
| `addCrawler(crawler)` | `addItem` | Creates crawler + empty inventory entry |
| `updateCrawler(id, updates)` | `updateItem` | Merges partial updates into crawler |
| `deleteCrawler(id)` | `deleteItem` | Deletes crawler + its inventory |
| `updateCrawlerInventory(crawlerId, items)` | `updateItem` / `addItem` | Replaces items array for a crawler |
| `addEpisode(episode)` | `addItem` | Creates episode with timestamps |
| `updateEpisode(id, updates)` | `updateItem` | Merges updates + updatedAt timestamp |

---

## State Management Layers

### Layer 1: Components/Views (UI only)
- Views receive data and callbacks as **props** — they never call Firebase directly
- Use `useState` only for local UI state (edit mode, selection, modals)
- Use controlled components (`value` + `onChange`) for all form inputs

### Layer 2: useGameState (game logic)
- Accessed via `useGameState()` hook in `Index.tsx`
- Provides memoized collections with defaults: `crawlers`, `mobs`, `maps`, `episodes`, `inventory`
- Provides game-specific functions: `updateCrawler`, `setMobs`, `performShortRest`, etc.
- Handles diffing for batch persistence (setMobs, setMaps)

### Layer 3: useFirebaseStore (persistence)
- Accessed via `useGame()` hook (wraps GameContext)
- Provides raw CRUD: `addItem`, `updateItem`, `deleteItem`, `batchWrite`, `getCollection`
- Handles: real-time listeners, optimistic updates, cleanObject, image validation, auth

### ❌ Anti-patterns
```typescript
// WRONG: Using local state for persisted data
const [quests, setQuests] = useState([]); // Will be lost on reload!

// WRONG: Calling Firebase directly from a View component
import { db } from '@/lib/firebase'; // Views should not import Firebase

// WRONG: Using useGame() in a View — use useGameState() props instead
const { addItem } = useGame(); // Only Index.tsx should use this
```

---

## Data Types & Collections

### Registered Collections (auto-synced via onSnapshot)

Defined in `useFirebaseStore.ts`:
```
crawlers, mobs, maps, inventory, episodes, soundEffects, diceRolls,
lootBoxes, lootBoxTemplates, noncombatTurns, gameClock
```

### Adding a New Collection

1. Add to `CollectionName` type in `src/types/collections.ts`
2. Add to the `collections` array near the top of `useFirebaseStore.ts`
3. Define the TypeScript interface in `src/lib/gameData.ts`
4. Use via `addItem('myCollection', data)` — auto-persisted and synced

### Core Types (defined in `src/lib/gameData.ts`)

| Type | Key Fields | Notes |
|------|-----------|-------|
| `Crawler` | id, name, race, job, level, hp, maxHP, mana, maxMana, str/dex/con/int/cha, gold, avatar?, equippedItems? | Player character |
| `InventoryItem` | id, name, description, equipSlot?, goldValue?, statModifiers?, tags? | Items in inventory |
| `Mob` | id, name, level, type ("normal"/"boss"/"npc"), hidden, encountered, hitPoints?, image? | Enemies/NPCs |
| `Episode` | id, name, description, mapIds[], mobPlacements[], crawlerPlacements?, mapSettings?, lootBoxIds? | Game episodes |
| `MapData` | id, name, imageUrl | Map metadata |
| `LootBoxTemplate` | id, name, tier (Dirt/Copper/Silver/Gold), items[], gold? | Loot templates |
| `SentLootBox` | id, episodeId, crawlerId, name, tier, items[], locked, sentAt | Awarded loot |
| `NoncombatTurnState` | id ("current"), turnNumber, rollsUsed, maxRolls | Singleton doc |
| `GameClockState` | id ("current"), gameTime (epoch ms) | Singleton doc |

---

## Important Patterns

### Inventory Document ID = crawlerId

Inventory documents use the **crawlerId as the Firestore document ID**, not an auto-generated ID:

```typescript
// ✅ Document ID matches crawlerId
addItem('inventory', { crawlerId: 'crawler-1', items: [...] });
// → Firestore doc ID = 'crawler-1'

// Retrieval works because doc ID == crawlerId
const items = inventory.find(i => i.crawlerId === crawlerId)?.items || [];
```

### Singleton Documents (noncombatTurns, gameClock)

Some collections store a single document with `id: 'current'`:

```typescript
// Check if singleton exists before deciding add vs update
const current = gameClockState;
if (current) {
  await updateItem('gameClock', 'current', { gameTime } as Record<string, unknown>);
} else {
  await addItem('gameClock', { id: 'current', gameTime } as Record<string, unknown>);
}
```

### Diff-Based Collection Persistence (setMobs, setMaps)

When replacing an entire collection, **diff against existing data** to compute adds, updates, and deletes:

```typescript
const existingIds = existingMobs.map(m => m.id);
const newIds = newMobs.map(m => m.id);

const toAdd = newMobs.filter(m => !existingIds.includes(m.id));    // type: 'add'
const toUpdate = newMobs.filter(m => existingIds.includes(m.id));  // type: 'update'
const toDelete = existingMobs.filter(m => !newIds.includes(m.id)); // type: 'delete'
```

### Equipment System

Crawlers have an `equippedItems` map (slot → itemId). Use `getEquippedModifiers()` to calculate effective stats:

```typescript
import { getEquippedModifiers } from '@/lib/gameData';

const crawlerInv = getCrawlerInventory(crawlerId);
const mods = getEquippedModifiers(crawler, crawlerInv);
const effectiveMaxHP = crawler.maxHP + (mods.maxHP ?? 0);
const effectiveMaxMana = crawler.maxMana + (mods.maxMana ?? 0);
```

Always use effective stats when calculating rest healing, damage caps, etc.

### Batch Operations for Multi-Crawler Updates

When updating multiple crawlers (e.g., rest mechanics), use `batchWrite` for atomicity:

```typescript
const operations: BatchOperation[] = crawlerIds.map(id => ({
  type: 'update' as const,
  collection: 'crawlers' as const,
  id,
  data: { hp: newHP, mana: newMana },
}));
if (operations.length > 0) await batchWrite(operations);
```

---

## Image & Data Size Rules

| Field | Max Size | Behavior If Exceeded |
|-------|----------|---------------------|
| `image` (maps) | 5 MB string length (`MAX_IMAGE_LENGTH`) | Silently stripped before save |
| `image` (mobs) | Compressed to ~800 KB | Resized to 512px max, JPEG quality reduced |
| `avatar` (crawlers) | 500 KB string length (`MAX_AVATAR_LENGTH`) | Resized to 512px max, JPEG quality reduced |
| Firestore document | 1 MB total | Write fails |

### Image Compression Policy

The goal is to save Firebase storage space **without reducing resolution where high-res display is needed**:

- **Map images**: Uploaded at **full resolution** — no compression or resizing. Maps are displayed at large sizes and need high resolution. The 5 MB Firestore limit in `useFirebaseStore.ts` is the only constraint.
- **Mob images**: Compressed client-side in `DungeonAIView.tsx` via `resizeImage()` (512px max, JPEG quality 0.7). Mobs are displayed at small sizes on the map.
- **Avatar/profile images**: Compressed client-side in `ProfilesView.tsx` (512px max, JPEG quality 0.8). Avatars are displayed as small thumbnails.

**Never add compression to map uploads.** If a map image exceeds 5 MB, it will be silently stripped by `useFirebaseStore` — the user should be informed to use a smaller image.

- `cleanObject()` in useFirebaseStore automatically strips `undefined` values before every write
- You do **not** need to manually call cleanObject — it's applied in addItem, updateItem, and batchWrite

---

## Component & Styling Conventions

### View Components (`src/views/`)

- Receive all data + callbacks as props from `Index.tsx`
- Never import or call `useGame()` or `useFirebaseStore` directly
- Use `React.FC<MyViewProps>` with a typed props interface
- Wrap content in `<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>`
- Use `DungeonCard` and `DungeonButton` for consistent styling

### UI Components (`src/components/ui/`)

- Purely presentational — no business logic
- Built on shadcn-ui (Radix UI primitives)
- Styled with Tailwind CSS classes

### Styling

- **Colors**: `text-primary` (cyan), `text-destructive` (red), `text-accent` (gold), `text-muted-foreground`
- **Glow effects**: `text-glow-cyan`, `text-glow-red`, `text-glow-gold`
- **Typography**: `font-display` for headings
- **Animations**: Framer Motion for transitions; `framer-motion` is already installed
- **Icons**: `lucide-react` for icons

### Forms

Always use **controlled components** (value + onChange), not refs:

```typescript
const [name, setName] = useState('');
<input value={name} onChange={(e) => setName(e.target.value)} />
```

---

## Common Mistakes to Avoid

| Mistake | Consequence | Fix |
|---------|------------|-----|
| Using `type: 'add'` on existing document | Entire document overwritten, all other fields lost | Use `type: 'update'` for existing docs |
| Using `useState` for persisted data | Data lost on page reload | Use `addItem` / `updateItem` via game state |
| Calling Firebase directly from View | Bypasses optimistic updates, auth, and cleanObject | Pass callbacks as props from Index.tsx |
| Auto-generating inventory document IDs | `getCrawlerInventory()` won't find the document | Use `crawlerId` as the document ID |
| Saving `undefined` values to Firestore | Field gets deleted from document | `cleanObject()` handles this automatically |
| Not checking `isLoaded` before rendering | "Cannot read properties of undefined" errors | Guard with `if (!isLoaded) return <Loading />` |
| Missing `roomId` in useEffect dependencies | Stale data when switching multiplayer rooms | Include `[roomId]` in dependency array |
| Forgetting effective stats in rest/heal calcs | Healing ignores equipment bonuses | Always use `getEquippedModifiers()` |
| Not adding collection to `collections` array | New collection won't be synced in real-time | Add to array in useFirebaseStore.ts |
| Storing maps as objects instead of strings | Map rendering breaks (`<img src={map}>` expects string) | Maps normalize to `string[]` via useGameState |

---

## Environment Setup

Required `.env` variables (see `.env.example`):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase uses **anonymous authentication** — no login required. Auth initializes automatically via `initAuth()` in useFirebaseStore before any Firestore access.

---

## Console Log Prefixes

All Firebase operations log with predictable prefixes for debugging:

| Prefix | Source |
|--------|--------|
| `[FirebaseStore]` | useFirebaseStore.ts (CRUD, auth, listeners) |
| `[GameState]` | useGameState.ts (game logic, diffing) |
| `[Firebase]` | firebase.ts (initialization) |
