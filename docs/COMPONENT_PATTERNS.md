# Component Patterns & Guidelines

Standard patterns and conventions for building components in this project.

## View Components (Page-Level)

Views are located in `src/views/` and represent major sections of the game.

### Pattern

```typescript
import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";

interface MyViewProps {
  data: SomeType[];
  onUpdate: (id: string, updates: Partial<SomeType>) => void;
  onAdd: (item: SomeType) => void;
  onDelete: (id: string) => void;
}

const MyView: React.FC<MyViewProps> = ({ data, onUpdate, onAdd, onDelete }) => {
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <h2 className="font-display text-2xl text-primary text-glow-cyan mb-6">
          MY VIEW
        </h2>

        {/* Content here */}
      </DungeonCard>
    </motion.div>
  );
};

export default MyView;
```

### Key Principles

1. **Props Only**: Views receive ALL data and callbacks as props (no `useGame()` calls)
2. **Controlled Components**: Inputs use `value` + `onChange` handlers
3. **Local State**: Use `useState` for UI state (edit mode, selection, etc.)
4. **Callback Handlers**: Create local handlers that call prop callbacks
5. **Animations**: Always wrap in `motion.div` with fade-in animation
6. **Styling**: Use DungeonCard/DungeonButton for consistency

### Props Pattern

Every view follows a consistent prop shape:

```typescript
interface ViewProps {
  // Data (always arrays or single items)
  crawlers: Crawler[];
  mobs: Mob[];
  
  // Callbacks (onAction: (id, updates) => void)
  onUpdateCrawler: (id: string, updates: Partial<Crawler>) => void;
  onAddCrawler: (crawler: Crawler) => void;
  onDeleteCrawler: (id: string) => void;
  
  // Optional admin flags
  isAdmin?: boolean;
}
```

### How Views Get Data

In `src/pages/Index.tsx`:

```typescript
const { crawlers, updateCrawler, addCrawler, deleteCrawler } = useGameState();

<ProfilesView
  crawlers={crawlers}
  onUpdateCrawler={updateCrawler}
  onAddCrawler={addCrawler}
  onDeleteCrawler={deleteCrawler}
/>
```

The view never calls Firebase directly. All data flows through props.

---

## UI Components (Reusable)

UI components are located in `src/components/ui/` and are purely presentational.

### shadcn-ui Pattern

Most UI components are built on shadcn-ui. They're modular and composable:

```typescript
// Example: Button component
import { Button } from "@/components/ui/button";

<Button variant="default" size="lg" onClick={handleClick}>
  Click Me
</Button>
```

### Custom Components (DungeonButton, DungeonCard)

These wrap shadcn components with project-specific styling:

#### DungeonButton

```typescript
import { DungeonButton } from "@/components/ui/DungeonButton";

<DungeonButton variant="admin" size="sm">
  <Save className="w-4 h-4 mr-1" /> Save
</DungeonButton>

<DungeonButton variant="default">Attack</DungeonButton>

<DungeonButton variant="ghost">Cancel</DungeonButton>
```

**Variants**: `default`, `admin`, `ghost`

#### DungeonCard

```typescript
import { DungeonCard } from "@/components/ui/DungeonCard";

<DungeonCard glowColor="red">
  <h2 className="text-2xl text-destructive">Title</h2>
  {/* Content */}
</DungeonCard>

<DungeonCard>
  {/* No glow, standard styling */}
</DungeonCard>
```

**Props**: 
- `glowColor`: `"cyan"`, `"red"`, `"gold"`, etc.
- `children`: Rendered inside the card

#### HealthBar

```typescript
import { HealthBar } from "@/components/ui/HealthBar";

<HealthBar
  current={50}
  max={100}
  label="HP"
  theme="red"  // "red" for enemies, "green" for allies
/>
```

### Creating New UI Components

1. **Create file** in `src/components/ui/MyComponent.tsx`
2. **Keep it presentational**: Props in, UI out
3. **No business logic**: Let parents handle state/logic
4. **Use Tailwind**: Apply styles with className
5. **Export from index**: Add to `src/components/ui/index.ts` if needed

Example:

```typescript
import { ReactNode } from "react";

interface StatDisplayProps {
  label: string;
  value: number | string;
  color?: "red" | "blue" | "green";
}

export const StatDisplay: React.FC<StatDisplayProps> = ({ 
  label, 
  value, 
  color = "blue" 
}) => {
  const colorClass = {
    red: "text-destructive",
    blue: "text-primary",
    green: "text-green-500"
  }[color];

  return (
    <div className="border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
};
```

---

## Hooks (Business Logic & State)

### useGameState (Game Logic)

High-level game operations:

```typescript
import { useGameState } from "@/hooks/useGameState";

export function MyComponent() {
  const {
    crawlers,
    updateCrawler,
    addCrawler,
    deleteCrawler,
    mobs,
    setMobs,
    maps,
    setMaps,
    inventory,
    getCrawlerInventory,
    updateCrawlerInventory,
    isLoaded,
    partyGold
  } = useGameState();

  if (!isLoaded) return <div>Loading...</div>;

  // Use data and functions
  const handleLevelUp = (crawlerId: string) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (crawler) {
      updateCrawler(crawlerId, { level: crawler.level + 1 });
    }
  };
}
```

### useGame (Context Accessor)

Lower-level Firebase access (rarely used in components):

```typescript
import { useGame } from "@/contexts/GameContext";

export function AdvancedComponent() {
  const {
    getCollection,
    setCollection,
    addItem,
    updateItem,
    deleteItem,
    setRoomId,
    roomId
  } = useGame();

  // Custom logic
  const customItems = getCollection('customCollection') as CustomType[];
}
```

### Custom Hooks Pattern

To extract component logic:

```typescript
// src/hooks/useCharacterStats.ts
import { useState, useMemo } from "react";
import type { Crawler } from "@/lib/gameData";

export function useCharacterStats(crawler: Crawler) {
  const totalStats = useMemo(() => {
    return crawler.str + crawler.dex + crawler.con + 
           crawler.int + crawler.cha;
  }, [crawler]);

  const statsAverage = useMemo(() => {
    return Math.round(totalStats / 5);
  }, [totalStats]);

  return { totalStats, statsAverage };
}
```

Usage:

```typescript
import { useCharacterStats } from "@/hooks/useCharacterStats";

function CharacterProfile({ crawler }: { crawler: Crawler }) {
  const { totalStats, statsAverage } = useCharacterStats(crawler);
  
  return <div>Average: {statsAverage}</div>;
}
```

---

## Data Flow Pattern

### Complete Example: Adding a New Crawler

```
1. User clicks "New Crawler" button in ProfilesView
   ↓
2. ProfilesView calls onAddCrawler(newCrawler)
   ↓
3. Index.tsx handler: addCrawler(newCrawler)
   ↓
4. useGameState.addCrawler(crawler):
     a. calls addItem('crawlers', crawler)
     b. calls addItem('inventory', { crawlerId: crawler.id, items: [] })
   ↓
5. useFirebaseStore.addItem('crawlers', crawler):
     a. Cleans object (removes undefined)
     b. Validates image size
     c. Calls Firebase setDoc()
   ↓
6. Firebase onSnapshot listener fires
   ↓
7. useFirebaseStore updates state
   ↓
8. GameContext provides new data
   ↓
9. ProfilesView re-renders with new crawler
```

### Code Path

```typescript
// Step 1: User interaction
const handleNewCrawler = () => {
  const newCrawler = createEmptyCrawler();
  onAddCrawler(newCrawler);  // Pass to parent
};

// Step 2: In Index.tsx
<ProfilesView
  onAddCrawler={(crawler) => addCrawler(crawler)}
/>

// Step 3: useGameState
const addCrawler = (crawler: Crawler) => {
  addItem('crawlers', crawler);
  addItem('inventory', { crawlerId: crawler.id, items: [] });
};

// Step 4: useFirebaseStore (auto via GameContext)
const addItem = async (collection, item) => {
  const cleaned = cleanObject(item);
  await setDoc(doc(db, collection, item.id), cleaned);
};

// Step 5: Firebase listener auto-updates state
// Step 6-9: Component re-renders automatically
```

---

## Error Handling Pattern

### In Components

```typescript
const [error, setError] = useState<string | null>(null);

const handleSave = async () => {
  try {
    await updateCrawler(crawlerId, updates);
    // Success - no error
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
    // Show toast or error message to user
  }
};
```

### Firebase Errors

Firebase logs automatically:

```typescript
// In useFirebaseStore
const addItem = async (...) => {
  try {
    // ...
  } catch (err) {
    console.error('[FirebaseStore] ❌ Add error:', err);
    setError(err instanceof Error ? err.message : 'Failed to add item');
    throw err;  // Let caller handle
  }
};
```

### Toast Notifications

For user feedback:

```typescript
import { useToast } from "@/hooks/use-toast";

export function MyComponent() {
  const { toast } = useToast();

  const handleUpdate = async () => {
    try {
      await updateCrawler(id, updates);
      toast({
        title: "Success",
        description: "Crawler updated",
        variant: "default"
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };
}
```

---

## Styling Guidelines

### Color System

Use predefined Tailwind colors:

```tsx
// Primary (cyan)
<div className="text-primary text-glow-cyan">Primary</div>

// Destructive (red)
<div className="text-destructive text-glow-red">Destructive</div>

// Accent (gold)
<div className="text-accent text-glow-gold">Accent</div>

// Muted
<div className="text-muted-foreground">Muted</div>
```

### Typography

```tsx
// Titles
<h2 className="font-display text-2xl text-primary">Title</h2>

// Body
<p className="text-base text-foreground">Body text</p>

// Small
<span className="text-sm text-muted-foreground">Small text</span>
```

### Spacing

Use Tailwind spacing scale (p-4 = 1rem, mb-6 = 1.5rem):

```tsx
<div className="p-4 mb-6 space-y-3">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

### Animations

Use Framer Motion for page transitions:

```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
>
  Content
</motion.div>
```

---

## Component Checklist

When creating a new component, verify:

- [ ] **Props Interface**: All props defined with types
- [ ] **No Direct Firebase**: No `useFirebaseStore` calls
- [ ] **Local State**: Only UI state in component
- [ ] **Callbacks**: All user actions passed to parents
- [ ] **Error Handling**: Try/catch around async operations
- [ ] **Loading States**: Show loading UI while fetching
- [ ] **Type Safety**: No `any` types
- [ ] **Styling**: Use DungeonCard/DungeonButton
- [ ] **Animations**: Fade-in for page components
- [ ] **Documentation**: JSDoc comments for complex logic

