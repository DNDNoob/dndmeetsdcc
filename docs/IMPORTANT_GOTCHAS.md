# Important Gotchas & Implementation Details

Critical details and common mistakes to avoid.

## ⚠️ Inventory Document ID Gotcha

### The Problem

Inventory is stored as documents where `crawlerId` is the **document ID**, not just a field.

### ❌ Wrong

```typescript
// This structure won't work properly:
collection('inventory').add({
  crawlerId: 'crawler-1',
  items: [...]
});
// → Document ID is auto-generated (e.g., "abc123")
// → getCrawlerInventory('crawler-1') won't find it!
```

### ✅ Correct

```typescript
const docRef = doc(collection('inventory'), 'crawler-1');
await setDoc(docRef, {
  crawlerId: 'crawler-1',
  items: [...]
});
// → Document ID is 'crawler-1' (matches crawlerId)
// → getCrawlerInventory('crawler-1') finds it!
```

### Firestore Structure

```
collection: inventory
├── document id: "crawler-1"
│   ├── crawlerId: "crawler-1" (field, for clarity)
│   └── items: [...]
├── document id: "crawler-2"
│   ├── crawlerId: "crawler-2"
│   └── items: [...]
```

### Implementation

In `useGameState.ts`:

```typescript
const addCrawler = (crawler: Crawler) => {
  addItem('crawlers', crawler);
  // IMPORTANT: Use crawlerId as document ID
  addItem('inventory', { 
    crawlerId: crawler.id, 
    items: [] 
  });
};

const deleteCrawler = (id: string) => {
  deleteItem('crawlers', id);
  deleteItem('inventory', id);  // ← Uses id as doc ID
};

const updateCrawlerInventory = (crawlerId: string, items: InventoryItem[]) => {
  // Find existing, then update
  const existing = inventory.find((i) => i.crawlerId === crawlerId);
  if (existing) {
    updateItem('inventory', crawlerId, { items });  // ← Uses crawlerId as doc ID
  }
};
```

---

## ⚠️ Undefined Value Stripping

### The Problem

Firestore treats `undefined` as a delete operation. Saving `{ name: "Carl", level: undefined }` will DELETE the level field.

### Solution

The `cleanObject()` function removes all undefined values:

```typescript
const cleanObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj
      .map((v) => (typeof v === 'object' && v !== null ? cleanObject(v) : v))
      .filter((v) => v !== undefined);
  }
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;  // Skip undefined
      out[key] = typeof value === 'object' && value !== null ? cleanObject(value) : value;
    }
    return out;
  }
  return obj;
};
```

### Usage

```typescript
// Before saving to Firestore
const cleaned = cleanObject({
  name: 'Carl',
  level: 5,
  description: undefined,  // ← Will be removed
  avatar: null,            // ← Will be kept (not undefined)
  inventory: [
    { id: '1', name: 'Sword', equipped: undefined }  // ← equipped removed
  ]
});

// After: { name: 'Carl', level: 5, avatar: null, inventory: [{ id: '1', name: 'Sword' }] }
```

### When to Use

Always call before `setDoc()` or `updateDoc()`:

```typescript
const cleaned = cleanObject(itemWithId);
await setDoc(docRef, cleaned);
```

---

## ⚠️ Image Size Limits (1MB)

### The Problem

Firestore has a 1MB per-document limit. Base64 images can easily exceed this.

**Example**: A 750KB image becomes ~1MB when base64 encoded.

### Solution

Images are validated and stripped if too large:

```typescript
const MAX_IMAGE_LENGTH = 1_000_000; // ~750 KB of raw image data

if (itemWithId.image === undefined || itemWithId.image === null) {
  delete itemWithId.image;
} else if (typeof itemWithId.image === 'string' && 
           itemWithId.image.length > MAX_IMAGE_LENGTH) {
  console.warn('[FirebaseStore] ⚠️ Image too large; stripping before save');
  delete itemWithId.image;  // ← Remove oversized image
}
```

### Workarounds

**Option 1: Compress before uploading**
```typescript
const compressImage = (base64: string) => {
  // Use canvas or image library to reduce size
  return compressedBase64;
};
```

**Option 2: Host externally**
```typescript
// Store URL instead of base64
const mobData = {
  id: 'mob-1',
  name: 'Dragon',
  image: 'https://example.com/dragon.png'  // ← External URL
};
```

**Option 3: Use Firebase Storage**
```typescript
// Upload image to Storage, store reference in Firestore
const storageRef = ref(storage, `mobs/mob-1.png`);
await uploadBytes(storageRef, imageFile);
const url = await getDownloadURL(storageRef);

await addItem('mobs', {
  id: 'mob-1',
  imageUrl: url  // ← Reference to Storage
});
```

---

## ⚠️ Collection Update Pattern (setMobs)

### The Problem

For complex collections, you can't just call `updateItem()` for every change. You need to diff and persist changes intelligently.

### Example: Setting Mobs

```typescript
const setMobs = async (newMobs: Mob[]) => {
  const existingMobs = getCollection('mobs') as Mob[];

  const newIds = newMobs.map(m => m.id);
  const existingIds = existingMobs.map(m => m.id);

  // Diff to find changes
  const toAdd = newMobs.filter(m => !existingIds.includes(m.id));
  const toUpdate = newMobs.filter(m => existingIds.includes(m.id));
  const toDelete = existingMobs.filter(m => !newIds.includes(m.id));

  console.log('[GameState] 🔄 Persisting mobs', {
    add: toAdd.map(m => m.id),
    update: toUpdate.map(m => m.id),
    delete: toDelete.map(m => m.id),
  });

  // Execute writes sequentially
  for (const mob of toAdd) {
    await addItem('mobs', stripUndefinedDeep(mob));
  }
  for (const mob of toUpdate) {
    await updateItem('mobs', mob.id, stripUndefinedDeep({ ...mob }));
  }
  for (const mob of toDelete) {
    await deleteItem('mobs', mob.id);
  }
};
```

### Why Not Direct updateItem?

Direct `updateItem()` is for single-item changes:

```typescript
// ✅ Good: User edited one mob
await updateItem('mobs', 'mob-123', { level: 10 });

// ❌ Bad: Trying to replace entire collection
await updateItem('mobs', 'all', { mobs: newMobsArray });
// → Firestore will just update a field called "mobs", not replace collection
```

### Usage

```typescript
// In DungeonAIView
const handleUpdateMobs = async (newMobs: Mob[]) => {
  await setMobs(newMobs);  // ← Handles diffing and persistence
};
```

---

## ⚠️ Maps Stored as Strings (Not Objects)

### The Problem

Maps are stored as an array of base64 strings, not objects:

### ❌ Wrong

```typescript
// Trying to store maps as objects
const maps = [
  { url: "data:image/png;base64,..." },
  { url: "data:image/png;base64,..." }
];
```

### ✅ Correct

```typescript
// Maps are just strings
const maps: string[] = [
  "data:image/png;base64,iVBORw0KGgo...",
  "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
];
```

### Implementation

In `src/lib/gameData.ts`:

```typescript
export const defaultMaps: Map[] = [];  // type Map = string

// In MapsView:
const MapsView: React.FC<MapsViewProps> = ({ maps, ... }) => {
  return maps.map((map, index) => (
    <img key={index} src={map} alt={`Map ${index + 1}`} />
  ));
};
```

### Adding a Map

```typescript
const handleUploadMap = (base64Image: string) => {
  const newMaps = [...maps, base64Image];
  setMaps(newMaps);  // ← Save entire array
};
```

### Why Not Objects?

- Simpler schema (just strings)
- Firestore treats arrays specially (efficient updates)
- No nesting (faster queries)
- Direct img src usage (less transformation)

---

## ⚠️ RoomId Changes Trigger Re-subscriptions

### The Problem

Changing `roomId` unsubscribes from old listeners and subscribes to new ones. This can cause brief data loss.

### Flow

```typescript
useEffect(() => {
  const unsubscribers: (() => void)[] = [];

  const setupRealtimeSync = async () => {
    // ... setup listeners with roomId or undefined

    for (const collectionName of collections) {
      const collectionRef = getCollectionRef(collectionName, roomId || undefined);
      // ↑ If roomId changes, this ref changes
      
      const unsubscribe = onSnapshot(collectionRef, ...);
      unsubscribers.push(unsubscribe);
    }
  };

  setupRealtimeSync();

  // Cleanup old listeners when roomId changes
  return () => {
    console.log('[FirebaseStore] 🧹 Cleaning up listeners');
    unsubscribers.forEach(unsub => unsub());
  };
}, [roomId]);  // ← Re-run when roomId changes
```

### Implications

```typescript
// Scenario 1: User joins Room A
setRoomId('room-a');
// → Listens to rooms/room-a/crawlers, etc.
// → Gets Room A data immediately

// Scenario 2: User switches to Room B
setRoomId('room-b');
// → Old listeners cleaned up
// → New listeners set up for rooms/room-b/crawlers, etc.
// → Brief moment where data is loading
```

### Best Practices

```typescript
// In RoomManager.tsx
const handleJoinRoom = (roomId: string) => {
  // Set loading state before switch
  setLoading(true);
  
  // Switch room
  setRoomId(roomId);
  
  // Wait for isLoaded flag
  // Then clear loading state
};
```

---

## ⚠️ Anonymous Auth Must Complete Before Firestore

### The Problem

If you try to access Firestore before `initAuth()` completes, you'll get auth errors.

### Implementation

```typescript
export const initAuth = () => {
  if (authPromise) return authPromise;
  
  authPromise = new Promise((resolve, reject) => {
    if (authInitialized) {
      resolve();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        authInitialized = true;
        unsubscribe();
        resolve();  // ← Called when auth ready
      } else {
        try {
          await signInAnonymously(auth);
          authInitialized = true;
          unsubscribe();
          resolve();  // ← Called when signed in
        } catch (error) {
          reject(error);  // ← Called on error
        }
      }
    });
  });

  return authPromise;
};
```

### Usage in useFirebaseStore

```typescript
const setupRealtimeSync = async () => {
  console.log('[FirebaseStore] 🔐 Initializing authentication...');

  try {
    await initAuth();  // ← Wait for auth first
    console.log('[FirebaseStore] ✅ Authentication ready');
    
    // Now safe to access Firestore
    console.log('[FirebaseStore] 📂 Setting up real-time sync...');
    
    for (const collectionName of collections) {
      const collectionRef = getCollectionRef(collectionName, roomId || undefined);
      const unsubscribe = onSnapshot(collectionRef, ...);
      unsubscribers.push(unsubscribe);
    }
  } catch (err) {
    console.error('[FirebaseStore] ❌ Setup error:', err);
    setError(err instanceof Error ? err.message : 'Failed to setup Firebase');
  }
};
```

### Error Symptoms

If you see:
- `auth/api-key-not-valid` → Firebase not initialized
- `auth/operation-not-allowed` → Anonymous auth disabled in Firebase Console
- `PERMISSION_DENIED` → Security rules don't allow access

---

## ⚠️ Controlled Components in Forms

### The Problem

React requires controlled components for form inputs (value + onChange).

### ❌ Wrong (Uncontrolled)

```typescript
const MyForm = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const value = inputRef.current?.value;  // ← Bad!
    updateCrawler(id, { name: value });
  };

  return <input ref={inputRef} />;
};
```

### ✅ Correct (Controlled)

```typescript
const MyForm = () => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    updateCrawler(id, { name });
  };

  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
};
```

### Complex Form Example

```typescript
const [editData, setEditData] = useState<Partial<Crawler>>({});

const handleChange = (field: keyof Crawler, value: any) => {
  setEditData(prev => ({
    ...prev,
    [field]: value
  }));
};

const handleSave = async () => {
  await updateCrawler(crawlerId, editData);
  setEditData({});
};

return (
  <>
    <input
      value={editData.name ?? ''}
      onChange={(e) => handleChange('name', e.target.value)}
    />
    <input
      value={editData.level ?? 0}
      onChange={(e) => handleChange('level', parseInt(e.target.value))}
      type="number"
    />
    <button onClick={handleSave}>Save</button>
  </>
);
```

---

## ⚠️ UseEffect Dependencies Matter

### The Problem

Missing dependencies cause stale data or memory leaks.

### ❌ Wrong

```typescript
useEffect(() => {
  // Listener set up without dependencies
  const unsubscribe = onSnapshot(collection(db, 'crawlers'), (snap) => {
    setData(snap.docs);
  });
  
  return unsubscribe;
  // ← Missing roomId dependency!
  // ← Doesn't re-subscribe when roomId changes
}, []);
```

### ✅ Correct

```typescript
useEffect(() => {
  const unsubscribers: (() => void)[] = [];

  for (const collectionName of collections) {
    const collectionRef = getCollectionRef(collectionName, roomId || undefined);
    const unsubscribe = onSnapshot(collectionRef, ...);
    unsubscribers.push(unsubscribe);
  }

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}, [roomId]); // ← Include all external dependencies
```

---

## ⚠️ Memos for Performance

### The Problem

Without memos, expensive calculations or listeners run on every render.

### Solution

```typescript
const crawlers = useMemo(() => {
  const stored = getCollection('crawlers') as Crawler[];
  if (!isLoaded || stored.length === 0) return defaultCrawlers;
  return stored;
}, [getCollection('crawlers'), isLoaded]);

const partyGold = useMemo(() => {
  return crawlers.reduce((sum, c) => sum + (c.gold || 0), 0);
}, [crawlers]);
```

### useCallback for Handlers

```typescript
const addItem = useCallback(async (collection: CollectionName, item: any) => {
  // ... add implementation
}, [roomId]); // ← Must include all external deps

const updateItem = useCallback(async (...) => {
  // ...
}, [roomId]);
```

---

## ⚠️ No Component Renders on Data Deletion

### The Problem

If you delete something while viewing it, the component might not re-render properly.

### Solution

Always check if selected item still exists:

```typescript
const handleDelete = () => {
  if (selected && crawlers.length > 1) {
    const newSelected = crawlers.find(c => c.id !== selected.id);
    deleteCrawler(selected.id);
    if (newSelected) {
      setSelectedId(newSelected.id);  // ← Switch to different item
    }
  }
};
```

---

## Quick Reference: Common Mistakes

| Mistake | Fix | Link |
|---------|-----|------|
| Using auto-generated inventory doc ID | Use `crawlerId` as doc ID | Inventory Gotcha |
| Saving `undefined` values | Use `cleanObject()` | Undefined Stripping |
| Large base64 images | Compress or use external URL | Image Size Limits |
| Direct collection replacement | Use diffing pattern | Collection Update Pattern |
| Storing maps as objects | Store as strings only | Maps as Strings |
| Accessing Firestore before auth | Call `initAuth()` first | Auth Must Complete |
| Uncontrolled form inputs | Use `value` + `onChange` | Controlled Components |
| Missing useEffect dependencies | Add `roomId` and other deps | Dependencies Matter |

