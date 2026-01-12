# Project Architecture

## High-Level Overview

**Dungeon Crawler Carl** is a real-time multiplayer D&D-inspired game hub built with modern web technologies. The architecture emphasizes real-time data synchronization, type safety, and clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│                      React + TypeScript UI Layer                │
│  (Pages → Views → Components → shadcn-ui + Tailwind + Framer)   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                     State Management Layer                       │
│  GameContext → useGameState Hook → useFirebaseStore Hook        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                     Firebase Firestore Layer                     │
│  Real-time onSnapshot listeners, Anonymous Auth, Collections    │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite (instant HMR, optimized production builds)
- **UI Library**: shadcn-ui (headless component library built on Radix UI)
- **Styling**: Tailwind CSS + tailwindcss-animate
- **Animations**: Framer Motion (smooth, performant animations)
- **Icons**: lucide-react
- **Forms**: react-hook-form + zod validation
- **Routing**: react-router-dom

### Backend & Data
- **Database**: Firebase Firestore (NoSQL, real-time)
- **Authentication**: Firebase Auth (anonymous)
- **Storage**: Firebase Storage (optional, for large files)
- **Optional Sound Server**: Express + WebSocket (broadcast sound events)

### Development
- **Linting**: ESLint 9
- **Package Manager**: npm/bun
- **Deployment**: Netlify (with serverless functions)

## Project Structure

```
src/
├── App.tsx                    # Main app component
├── main.tsx                   # Vite entry point
├── pages/
│   ├── Index.tsx              # Main game page with navigation/views
│   └── NotFound.tsx           # 404 page
├── views/                     # Page-level components (one per game section)
│   ├── ProfilesView.tsx       # Character management
│   ├── InventoryView.tsx      # Item management
│   ├── MobsView.tsx           # Enemy list
│   ├── MapsView.tsx           # Dungeon maps
│   ├── DungeonAIView.tsx      # Admin/DM panel
│   ├── ShowTimeView.tsx       # Player presentation mode
│   └── SoundEffectsView.tsx   # Audio management
├── components/                # Reusable UI components
│   ├── Navigation.tsx         # Top navigation bar
│   ├── MainMenu.tsx           # Game menu
│   ├── DiceRoller.tsx         # D20 dice roller
│   ├── RoomManager.tsx        # Multiplayer room selector
│   └── ui/                    # shadcn-ui component library
├── contexts/
│   └── GameContext.tsx        # React Context for global game state
├── hooks/
│   ├── useGameState.ts        # Business logic (CRUD operations)
│   ├── useFirebaseStore.ts    # Firebase sync & persistence
│   └── use-*.ts               # Other utility hooks
├── lib/
│   ├── firebase.ts            # Firebase initialization & helpers
│   ├── gameData.ts            # Type definitions & default data
│   └── utils.ts               # Utility functions
└── types/
    └── collections.ts         # TypeScript types for collections
```

## Data Flow

### 1. User Action Flow
```
User clicks button in View
  ↓
Calls handler (onUpdateCrawler, etc.)
  ↓
Handler calls useGameState function (updateCrawler, addItem, etc.)
  ↓
useGameState calls addItem/updateItem from useFirebaseStore
  ↓
Firebase write completes, onSnapshot listener fires
  ↓
Component re-renders with new data from GameContext
```

### 2. Initial Load Flow
```
App mounts
  ↓
GameProvider initializes useFirebaseStore
  ↓
initAuth() runs (anonymous sign-in)
  ↓
useFirebaseStore sets up onSnapshot listeners for all collections
  ↓
Real-time data flows into state
  ↓
UI renders with initial data (or defaults if empty)
```

### 3. Multiplayer Room Flow
```
RoomManager component
  ↓
User selects or creates room
  ↓
setRoomId() called in GameContext
  ↓
useFirebaseStore re-subscribes to room-scoped collections
  ↓
users/{roomId}/crawlers, users/{roomId}/mobs, etc.
  ↓
UI updates to show room-specific data
```

## State Management

### GameContext
Central React Context that wraps the entire app. Provides:
- `data`: All collections organized by name
- `loading`: Initial load status
- `error`: Error state
- `addItem()`: Create document in collection
- `updateItem()`: Modify existing document
- `deleteItem()`: Remove document
- `getCollection()`: Retrieve typed collection array
- `setRoomId()`: Switch to different multiplayer room

### useGameState Hook
Business logic layer combining Firebase persistence with game-specific operations:
- `crawlers`: Crawler[] with CRUD
- `mobs`: Mob[] with diffing/persistence
- `maps`: String[] (base64 encoded images)
- `inventory`: { crawlerId, items[] }[]
- `getCrawlerInventory()`: Helper to get items for a crawler
- `updateCrawlerInventory()`: Batch update items
- `setMobs()`: Intelligent diffing before persist

### useFirebaseStore Hook
Firebase integration layer:
- Real-time listeners with `onSnapshot`
- Cleanup of undefined values via `cleanObject()`
- Image size validation (<1MB)
- Anonymous authentication
- Room-based collection scoping

## Component Architecture

### Views (Page-level)
Located in `src/views/`, each manages one major game section:
- Receive data + callbacks as props from parent (Index.tsx)
- Use controlled components for inputs
- Call handlers to update parent state
- Don't directly use Firebase—work through useGameState

**Example**:
```typescript
interface ProfilesViewProps {
  crawlers: Crawler[];
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
  onAddCrawler: (crawler: Crawler) => void;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ crawlers, onUpdateCrawler, ... }) => {
  // Render UI, call handlers on user actions
};
```

### UI Components (Reusable)
Located in `src/components/ui/`, these are presentational:
- No props drilling
- Pure UI (buttons, cards, inputs, etc.)
- Built on shadcn-ui patterns
- Styled with Tailwind CSS

**Examples**: DungeonButton, DungeonCard, HealthBar, etc.

### Hooks (Logic)
- `useGameState()`: Game business logic
- `useFirebaseStore()`: Firebase persistence
- `useGame()`: Context consumer
- `use-toast()`: Toast notifications
- `use-mobile()`: Responsive design detection

## Key Design Decisions

### ✅ Real-time Sync
Using `onSnapshot` listeners means:
- Changes in one browser instantly appear in others
- Perfect for local multiplayer testing
- Scales well for small player counts

### ✅ Anonymous Auth
- No user registration/login
- Simpler implementation
- Per-browser session via Firebase auth
- Can be extended to user accounts later

### ✅ Collection-based Schema
- No complex ORM
- Easy to add new data types
- Automatic sync once included in collections array
- All collections get real-time benefits automatically

### ✅ Props Drilling (Intentional)
Views explicitly receive data they need:
- Clear data dependencies
- Easier to test
- Easier to refactor
- Explicit is better than implicit (Zen of Python)

### ⚠️ Tradeoffs
- No Redux/Zustand (simpler, but less tooling)
- No GraphQL (simpler queries, but less flexible)
- No separate API layer (Firestore is the API)

## Performance Considerations

### 1. Real-time Listeners
- Set up once per collection
- Auto-cleanup on unmount
- Batched updates prevent thrashing

### 2. Memoization
- Components use `useMemo` for expensive calculations
- `useCallback` for stable function references
- Custom useMemo in useGameState for collections

### 3. Image Handling
- Base64 images capped at 1MB
- Larger images stripped before save
- Maps stored as strings to avoid nested objects

### 4. Bundle Size
- Vite tree-shaking removes unused code
- shadcn-ui components are modular
- Production build optimized via SWC

## Extensibility

### Adding New Data Types
1. Add to `collections.ts` type
2. Add to collections array in useFirebaseStore
3. Use `addItem('myCollection', data)`
4. Automatically persisted and synced!

### Adding New Views
1. Create `src/views/MyView.tsx`
2. Get data from useGameState
3. Add to Index.tsx routing
4. Add to Navigation menu

### Adding New Firebase Features
1. Modify `src/lib/firebase.ts`
2. Update `useFirebaseStore.ts` if needed
3. Export from firebase.ts for app-wide use

