# CLAUDE.md - AI Development Instructions

## Firebase Data Safety Rules

### CRITICAL: Updating Existing Documents

When modifying existing documents in Firebase (crawlers, inventory, mobs, etc.), you MUST use the correct operation type to avoid data loss:

**Use `type: 'update'` for existing documents:**
```typescript
// CORRECT - preserves all other fields
await batchWrite([{
  type: 'update',
  collection: 'crawlers',
  id: crawlerId,
  data: { hp: newHP, mana: newMana }
}]);

// ALSO CORRECT - updateCrawler uses updateDoc internally
await updateCrawler(crawlerId, { hp: newHP });
```

**NEVER use `type: 'add'` for existing documents:**
```typescript
// WRONG - This REPLACES the entire document, wiping all other fields!
await batchWrite([{
  type: 'add',  // <-- DANGER: uses batch.set() which overwrites everything
  collection: 'crawlers',
  id: existingCrawlerId,
  data: { hp: 50 }  // All other data (name, stats, image) will be DELETED
}]);
```

### Operation Types Summary
- `type: 'add'` → Creates new document OR completely replaces existing (uses `batch.set()`)
- `type: 'update'` → Merges fields into existing document, preserving unlisted fields (uses `batch.update()`)
- `type: 'delete'` → Removes document entirely

### When to Use Each
- **Creating a new crawler/item/mob**: Use `addCrawler()`, `addItem()`, or `type: 'add'`
- **Modifying HP, mana, stats, or any field on existing document**: Use `updateCrawler()`, `updateItem()`, or `type: 'update'`
- **Batch updates (like rest mechanics)**: Use `batchWrite()` with `type: 'update'` for each operation

## Project Structure

- `src/hooks/useFirebaseStore.ts` - Low-level Firebase operations (addItem, updateItem, batchWrite)
- `src/hooks/useGameState.ts` - Game logic layer (updateCrawler, performShortRest, etc.)
- `src/lib/gameData.ts` - Type definitions (Crawler, InventoryItem, Episode, etc.)
- `src/contexts/GameContext.tsx` - React context provider for game state

## Key Patterns

### Updating Crawler Stats
```typescript
// Single field
await updateCrawler(id, { hp: newValue });

// Multiple fields
await updateCrawler(id, { hp: newHP, mana: newMana, str: 16 });

// Batch multiple crawlers
const operations = crawlerIds.map(id => ({
  type: 'update' as const,
  collection: 'crawlers' as const,
  id,
  data: { hp: fullHP }
}));
await batchWrite(operations);
```

### Getting Effective Stats (with equipment bonuses)
```typescript
import { getEquippedModifiers } from '@/lib/gameData';

const crawlerInv = getCrawlerInventory(crawlerId);
const mods = getEquippedModifiers(crawler, crawlerInv);
const effectiveMaxHP = crawler.maxHP + (mods.maxHP ?? 0);
```
