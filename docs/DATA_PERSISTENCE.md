# Data Persistence Guide

## ⚠️ IMPORTANT: Adding New Data Types

**ALL user-created data MUST use the DataStore pattern for automatic persistence.**

### ✅ Correct Way (Auto-saves):
```typescript
import { useGame } from '@/contexts/GameContext';

function MyComponent() {
  const { getCollection, addItem, updateItem, deleteItem } = useGame();
  
  // Get data
  const quests = getCollection('quests');
  
  // Create new item - AUTOMATICALLY SAVED!
  const createQuest = (questData) => {
    addItem('quests', {
      id: crypto.randomUUID(),
      ...questData,
      createdAt: new Date().toISOString()
    });
  };
  
  // Update - AUTOMATICALLY SAVED!
  const completeQuest = (questId) => {
    updateItem('quests', questId, { completed: true });
  };
  
  // Delete - AUTOMATICALLY SAVED!
  const removeQuest = (questId) => {
    deleteItem('quests', questId);
  };
}
```

### ❌ Wrong Way (Data will be lost):
```typescript
// DON'T DO THIS - data won't persist!
const [quests, setQuests] = useState([]);
setQuests([...quests, newQuest]); // ⚠️ NOT SAVED!
```

## Supported Collections

Current collections that auto-persist:
- `crawlers` - Player characters
- `mobs` - Enemies/NPCs
- `maps` - Dungeon maps (large files, server-only)
- `inventory` - Items

### Adding a New Collection

Just use it! No setup required:

```typescript
// Want to add quests? Just start using them:
addItem('quests', questData); // ✅ Automatically persisted!

// Want to add spells?
addItem('spells', spellData); // ✅ Automatically persisted!

// Want to add NPCs?
addItem('npcs', npcData); // ✅ Automatically persisted!
```

## Storage Limits

- **Server**: 50MB limit (primary storage)
- **LocalStorage**: Backup only, excludes large data (maps)

## Debugging

Watch the browser console for `[DataStore]` messages:
- `💾 Saving data...` - Save initiated
- `✅ Saved to server` - Server save successful
- `✅ Saved to localStorage` - Backup save successful
- `⚠️ Server save failed` - Server down, but localStorage backup worked

## Examples

See [src/examples/DataStoreExamples.tsx](../src/examples/DataStoreExamples.tsx) for complete examples.
