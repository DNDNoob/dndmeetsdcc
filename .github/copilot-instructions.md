# GitHub Copilot Instructions for dndmeetsdcc

> This project is exclusively coded by AI. See `CLAUDE.md` at the repo root for the full, authoritative reference.

## Quick Reference

- **Build**: `npm run build` (Vite)
- **Lint**: `npm run lint` (ESLint)
- **Dev server**: `npm run dev` (Vite HMR)
- **No test runner configured** — manual testing and Firebase CRUD tests only (`npm run test:firebase`)
- **Import alias**: Use `@/` for `src/` (e.g., `import { Crawler } from '@/lib/gameData'`)

## Architecture (3 Layers)

```
Views/Components (props only — never call Firebase)
    ↓ props + callbacks
useGameState (game logic, memoized collections)
    ↓ calls
useFirebaseStore (CRUD, real-time sync, cleanObject)
    ↓ writes/reads
Firebase Firestore
```

- **Views** (`src/views/`) receive data + callbacks as props from `Index.tsx` — never import Firebase or `useGame()` directly
- **useGameState** (`src/hooks/useGameState.ts`) provides `updateCrawler`, `setMobs`, `performShortRest`, etc.
- **useFirebaseStore** (`src/hooks/useFirebaseStore.ts`) provides raw CRUD: `addItem`, `updateItem`, `deleteItem`, `batchWrite`

## CRITICAL: Firebase Data Safety

```typescript
// ✅ CORRECT — update merges fields, preserving everything else
await batchWrite([{ type: 'update', collection: 'crawlers', id, data: { hp: 50 } }]);
await updateCrawler(id, { hp: 50 });

// ❌ WRONG — add uses batch.set() which OVERWRITES the entire document!
await batchWrite([{ type: 'add', collection: 'crawlers', id: existingId, data: { hp: 50 } }]);
```

**Always use `type: 'update'` for existing documents. Use `type: 'add'` only for brand-new documents.**

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| `type: 'add'` on existing document | Use `type: 'update'` |
| `useState` for persisted data | Use `addItem` / `updateItem` via game state |
| Calling Firebase from a View | Pass callbacks as props from `Index.tsx` |
| Auto-generating inventory doc IDs | Use `crawlerId` as the document ID |
| Forgetting equipment bonuses in rest/heal | Use `getEquippedModifiers()` for effective stats |
| Not adding collection to `collections` array | Add to array in `useFirebaseStore.ts` |

## Styling

- **Colors**: `text-primary` (cyan), `text-destructive` (red), `text-accent` (gold)
- **Glow**: `text-glow-cyan`, `text-glow-red`, `text-glow-gold`
- **Components**: Use `DungeonCard` and `DungeonButton` for consistency
- **Animations**: Framer Motion (`motion.div` with fade-in)
- **Icons**: `lucide-react`

## Full Reference

See **`CLAUDE.md`** at the repository root for complete documentation including:
- All type definitions and collection schemas
- Singleton document patterns
- Diff-based collection persistence
- Equipment system details
- Image size limits
- Environment setup
