# GitHub Copilot Instructions for dndmeetsdcc

## Data Persistence Pattern

**ALL user-created data MUST use the DataStore pattern.**

When generating code that creates, updates, or deletes user data:

1. ✅ **DO** use `useGame()` hook and its methods:
   ```typescript
   const { getCollection, addItem, updateItem, deleteItem } = useGame();
   addItem('collectionName', data);
   ```

2. ❌ **DON'T** use local state for user data:
   ```typescript
   const [data, setData] = useState([]); // ❌ Won't persist!
   ```

3. **Reference**: See `docs/DATA_PERSISTENCE.md` for complete guide

## Available Collections

Auto-persisting collections:
- `crawlers`, `mobs`, `maps`, `inventory`
- Any new collection name works automatically (e.g., `quests`, `npcs`, `spells`)

## Example

```typescript
import { useGame } from '@/contexts/GameContext';

function MyComponent() {
  const { getCollection, addItem } = useGame();
  const items = getCollection('newType');
  
  const create = (data) => addItem('newType', { id: crypto.randomUUID(), ...data });
}
```
