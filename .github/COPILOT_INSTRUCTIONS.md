# GitHub Copilot Instructions for dndmeetsdcc

## Testing Requirements

**ALL new features MUST be tested after implementation.**

For every feature, bug fix, or change:

1. ✅ **DO** run the dev server and test locally:
   ```bash
   npm run dev
   ```

2. ✅ **DO** verify the specific feature works:
   - For data features: Create, read, update, delete operations
   - For UI changes: Visual rendering and interactions
   - For multiplayer features: Test in multiple tabs/browsers
   - For Firebase features: Check console for auth/sync messages

3. ✅ **DO** check the browser console (F12) for errors

4. ✅ **DO** verify real-time sync works (multiple tabs/browsers)

5. ✅ **DO** run the build and deployment test:
   ```bash
   npm run build
   ```

6. ⚠️ **ALWAYS** use diagnostic tools if deployment fails:
   ```bash
   ./diagnostic.sh
   ```

7. **Never** assume something works - always test and verify!

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
