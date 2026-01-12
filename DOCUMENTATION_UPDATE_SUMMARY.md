# AI INSTRUCTIONS & DOCUMENTATION UPDATE SUMMARY

## New Documentation Sections to Add:

### 1. **ARCHITECTURE.md** - Project Architecture Overview
Key points to document:
- **Stack**: Vite + React 18 + TypeScript + Firebase Firestore
- **UI**: shadcn-ui components + Tailwind CSS + Framer Motion animations
- **State Management**: React Context (GameContext) + Custom hooks (useGameState, useFirebaseStore)
- **Real-time Sync**: Firebase Firestore with auto-sync listeners per collection
- **Multiplayer**: Room-based architecture with roomId routing to different subcollections

### 2. **DATA_TYPES.md** - Complete Data Model Reference
Important types and their relationships:
- **Crawler**: Player character with stats (str, dex, con, int, cha), level, HP/Mana
- **InventoryItem**: Items belonging to crawlers (id must match crawlerId for doc storage)
- **Mob**: Enemy/NPC with types (normal, boss, npc), optional image, weaknesses/strengths
- **Map**: Dungeon maps (base64 images, stored as strings in 'maps' collection)
- **Collections**: crawlers, inventory, mobs, maps, (extensible for quests, spells, npcs, etc.)

### 3. **FIREBASE_ARCHITECTURE.md** - Firebase/Firestore Details
Critical for future development:
- **Structure**: Root-level collections OR room-based sub-collections
- **Room Support**: `rooms/{roomId}/{collectionName}` enables multiplayer/per-game data isolation
- **Auth**: Anonymous auth only (no user accounts)
- **Real-time**: onSnapshot listeners per collection auto-sync changes
- **Limits**: 1MB doc limit (enforced via cleanObject for base64 images)
- **Testing**: test-data-persistence.mjs validates all 4 data types work

### 4. **COMPONENT_PATTERNS.md** - Component Architecture & Patterns
Standard patterns to follow:
- **Views** (src/views/): Page-level components that consume useGameState hooks
- **UI Components** (src/components/ui/): shadcn-ui reusable components
- **Prop Drilling**: Views receive data and callbacks from Index.tsx
- **State Hook Pattern**: useGameState provides CRUD operations, useFirebaseStore handles Firebase
- **Error Handling**: Firebase errors logged with [FirebaseStore] prefix, auto-cleanup

### 5. **IMPORTANT_GOTCHAS.md** - Critical Implementation Notes
Must-know details:
- ⚠️ **Inventory Documents**: Must use crawlerId as document ID, not collection array
- ⚠️ **Undefined Stripping**: cleanObject() removes undefined values before Firestore writes
- ⚠️ **Image Size Limits**: Images >1MB stripped; use base64 or external URLs only
- ⚠️ **Collection Update Pattern**: Call setMobs() to diff/persist changes, not updateItem directly
- ⚠️ **Maps as Strings**: Maps stored as base64 strings (not objects), collection is root-level array

### 6. **TESTING.md** - Testing Guide
How to validate data persistence:
- `npm run test:firebase` - Firebase CRUD test
- `node test-data-persistence.mjs` - Comprehensive persistence test (crawlers, inventory, mobs, maps)
- Tests verify CREATE, READ, UPDATE, DELETE for all data types
- All 4 tests currently passing ✅

### 7. **DEBUGGING.md** - Debugging Tips
Common debug patterns:
- Console prefix: `[FirebaseStore]` for Firebase logs
- Real-time update logs: `[FirebaseStore] 🔄 Real-time update: {collection}` 
- Authentication: initAuth() must complete before any Firestore operations
- RoomId Flow: Set via setRoomId() in RoomManager, persists in state
- localStorage backup: Maps excluded, other collections backed up

---

## Key Architectural Insights Found:

1. **Hybrid Storage**: Firebase (primary) + localStorage (backup for offline)
2. **No Traditional User System**: Anonymous auth with per-browser sessions
3. **Multiplayer Ready**: Room-based subcollections support per-game isolation
4. **Type Safety**: Full TypeScript, but some interfaces need better documentation
5. **Real-time Architecture**: All collections auto-sync via onSnapshot listeners
6. **Sound System**: Optional local WebSocket server for broadcast sound effects
7. **Component Structure**: Clear separation of views, contexts, and reusable UI components

---

## Recommendations for Future Development:

1. ✅ **Data Persistence**: All working correctly (verified by tests)
2. 🔒 **Authentication**: Consider adding user accounts for persistent game saves
3. 📝 **Quests/NPCs**: Extensible—just use addItem('quests', data)
4. 🎨 **Type Validation**: Add Zod schemas for runtime validation
5. 📱 **Offline Support**: localStorage already acts as backup
6. 🎯 **Performance**: Consider indexes on frequently-queried fields

