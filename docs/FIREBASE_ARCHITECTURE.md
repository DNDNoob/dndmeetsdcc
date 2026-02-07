# Firebase & Firestore Architecture

Technical details about Firebase setup, configuration, and usage.

## Firebase Project Setup

### Configuration

Environment variables needed (`.env` file):
```bash
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**Location**: `src/lib/firebase.ts`
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

---

## Authentication

### Anonymous Auth

All users sign in anonymously. No accounts or passwords.

```typescript
export const initAuth = () => {
  // Called once on app start
  if (authInitialized) return authPromise;
  
  authPromise = new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        authInitialized = true;
        resolve();
      } else {
        try {
          await signInAnonymously(auth);
          authInitialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  });
  
  return authPromise;
};
```

**Flow**:
1. App starts
2. `useFirebaseStore` calls `initAuth()`
3. Anonymous user created in Firebase Auth
4. Same browser = same user (persistent)
5. Different browser = different user

### Extending to User Accounts

To add real user accounts:

1. Add `createUserWithEmailAndPassword()` instead of anonymous
2. Update Firestore security rules to require `auth.uid`
3. Store user profile in `users/{uid}` collection
4. Map Crawler/Mobs/etc to user instead of room

---

## Firestore Structure

### Schema Design

Two supported architectures:

#### 1. Global Collections (Current)

```
firestore/
├── crawlers/
│   ├── crawler-1: { id, name, level, ... }
│   ├── crawler-2: { id, name, level, ... }
├── mobs/
│   ├── mob-1: { id, name, type, ... }
├── inventory/
│   ├── crawler-1: { crawlerId, items: [...] }
│   ├── crawler-2: { crawlerId, items: [...] }
└── maps/
    ├── map-1: { url, name }
```

**Pros**: Simple, centralized, easy to query across all data
**Cons**: No data isolation between games/users

#### 2. Room-Based Collections (Multiplayer-Ready)

```
firestore/
├── rooms/
│   ├── room-abc123/
│   │   ├── crawlers/
│   │   │   ├── crawler-1: { ... }
│   │   ├── mobs/
│   │   │   ├── mob-1: { ... }
│   │   ├── inventory/
│   │   ├── maps/
│   ├── room-xyz789/
│   │   ├── crawlers/
│   │   ├── mobs/
│   │   ├── inventory/
│   │   ├── maps/
```

**Pros**: Perfect for multiplayer, data isolation, multiple games simultaneously
**Cons**: Slightly more complex queries

### Collection Reference

```typescript
// src/lib/firebase.ts
export const getCollectionRef = (collectionName: string, roomId?: string) => {
  if (roomId) {
    // Room-scoped: rooms/{roomId}/{collectionName}
    return collection(db, `rooms/${roomId}/${collectionName}`);
  }
  // Global: /{collectionName}
  return collection(db, collectionName);
};
```

---

## Real-Time Synchronization

### How It Works

Each collection gets a real-time listener via `onSnapshot`:

```typescript
// useFirebaseStore.ts
for (const collectionName of collections) {
  const collectionRef = getCollectionRef(collectionName, roomId || undefined);

  const unsubscribe = onSnapshot(
    collectionRef,
    (snapshot) => {
      // Called immediately, then on every change
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`[FirebaseStore] 🔄 Real-time update: ${collectionName}`, items.length);

      setData(prevData => ({
        ...prevData,
        [collectionName]: items
      }));
    },
    (err) => {
      console.error(`[FirebaseStore] ❌ Listener error for ${collectionName}:`, err);
      setError(err.message);
    }
  );

  unsubscribers.push(unsubscribe);
}
```

**Behavior**:
1. Listener attached to collection
2. Initial snapshot delivered immediately
3. Every document change triggers callback
4. All connected browsers get instant updates
5. Perfect for local multiplayer testing!

### Cleanup

Listeners are removed on component unmount or roomId change:

```typescript
useEffect(() => {
  // ... setup listeners

  // Cleanup on unmount
  return () => {
    console.log('[FirebaseStore] 🧹 Cleaning up listeners');
    unsubscribers.forEach(unsub => unsub());
  };
}, [roomId]); // Re-run if roomId changes
```

---

## Write Operations

### CRUD Operations

#### Create (addItem)

```typescript
const addItem = useCallback(async (collection: CollectionName, item: any) => {
  try {
    const itemId = item.id || crypto.randomUUID();
    const itemWithId = { ...item, id: itemId };
    
    if (roomId) {
      itemWithId.roomId = roomId;  // Tag with room for clarity
    }

    // Validate and clean image fields
    if (itemWithId.image === undefined || itemWithId.image === null) {
      delete itemWithId.image;
    } else if (typeof itemWithId.image === 'string' && 
               itemWithId.image.length > MAX_IMAGE_LENGTH) {
      console.warn('[FirebaseStore] ⚠️ Image too large; stripping before save');
      delete itemWithId.image;
    }

    const collectionRef = getCollectionRef(collection, roomId || undefined);
    const docRef = doc(collectionRef, itemId);
    const cleaned = cleanObject(itemWithId);

    await setDoc(docRef, cleaned);
    console.log('[FirebaseStore] ✅ Added item:', collection, itemId);
  } catch (err) {
    console.error('[FirebaseStore] ❌ Add error:', err);
    throw err;
  }
}, [roomId]);
```

**Usage**:
```typescript
await addItem('crawlers', {
  id: 'crawler-1',
  name: 'Carl',
  level: 5,
  // ...
});
```

#### Read (getCollection / onSnapshot)

```typescript
// Get current state
const crawlers = getCollection('crawlers');

// Subscribe to real-time updates
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'crawlers'),
    (snapshot) => {
      console.log('Crawlers updated:', snapshot.docs.length);
    }
  );
  
  return unsubscribe;
}, []);
```

#### Update (updateItem)

```typescript
const updateItem = useCallback(async (collection: CollectionName, id: string, updates: any) => {
  try {
    const collectionRef = getCollectionRef(collection, roomId || undefined);
    const docRef = doc(collectionRef, id);

    const updatesCopy = { ...updates };
    
    // Same image validation
    if (updatesCopy.image === undefined || updatesCopy.image === null) {
      delete updatesCopy.image;
    } else if (typeof updatesCopy.image === 'string' && 
               updatesCopy.image.length > MAX_IMAGE_LENGTH) {
      console.warn('[FirebaseStore] ⚠️ Image too large; stripping before update');
      delete updatesCopy.image;
    }

    const cleanedFinal = cleanObject(updatesCopy);
    await updateDoc(docRef, cleanedFinal);
    console.log('[FirebaseStore] ✅ Updated item:', collection, id);
  } catch (err) {
    console.error('[FirebaseStore] ❌ Update error:', err);
    throw err;
  }
}, [roomId]);
```

**Usage**:
```typescript
await updateItem('crawlers', 'crawler-1', { level: 6, gold: 100 });
```

#### Delete (deleteItem)

```typescript
const deleteItem = useCallback(async (collection: CollectionName, id: string) => {
  try {
    const collectionRef = getCollectionRef(collection, roomId || undefined);
    const docRef = doc(collectionRef, id);

    await deleteDoc(docRef);
    console.log('[FirebaseStore] ✅ Deleted item:', collection, id);
  } catch (err) {
    console.error('[FirebaseStore] ❌ Delete error:', err);
    throw err;
  }
}, [roomId]);
```

**Usage**:
```typescript
await deleteItem('crawlers', 'crawler-1');
```

---

## Data Cleaning & Validation

### cleanObject()

Removes undefined values before Firestore write (Firestore requirement):

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

**Why**: Firestore treats `undefined` as "delete field", which causes inconsistent behavior.

### Image Validation

```typescript
const MAX_IMAGE_LENGTH = 1_000_000; // ~750 KB of raw base64

if (itemWithId.image && typeof itemWithId.image === 'string') {
  if (itemWithId.image.length > MAX_IMAGE_LENGTH) {
    console.warn('[FirebaseStore] ⚠️ Image too large; stripping before save');
    delete itemWithId.image;  // Strip oversized images
  }
}
```

**Why**: Firestore has 1MB per-document limit. Base64 images can exceed this.

---

## Firestore Security Rules

Current rules allow anonymous read/write (open during development):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anonymous read/write for development
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **For production**: Add proper rules:

```javascript
// Example: Only authenticated users can write
match /{document=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == resource.data.userId;
}

// Example: Users can only modify their own data
match /users/{userId}/{document=**} {
  allow read, write: if request.auth.uid == userId;
}

// Example: Public read for game data
match /public/{document=**} {
  allow read: if true;
  allow write: if request.auth.uid == request.resource.data.adminId;
}
```

---

## Monitoring & Debugging

### Console Logs

All Firebase operations log with `[FirebaseStore]` prefix:

```
[FirebaseStore] 🔐 Initializing authentication...
[FirebaseStore] ✅ Authentication ready
[FirebaseStore] 📂 Setting up real-time sync...
[FirebaseStore] 🔄 Real-time update: crawlers 2
[FirebaseStore] ✅ Added item: mobs mob-123
[FirebaseStore] ✅ Updated item: crawlers crawler-1
[FirebaseStore] ✅ Deleted item: mobs mob-456
```

### Firebase Console

Visit [Firebase Console](https://console.firebase.google.com/project/dndmeetsdcc) to:
- View all Firestore data
- Monitor real-time writes
- Check authentication status
- View error logs

### Test Data Persistence

Run the comprehensive test:

```bash
node test-data-persistence.mjs
```

Tests CREATE, READ, UPDATE, DELETE for all 4 collections.

---

## Limits & Quotas

| Limit | Value | Notes |
|-------|-------|-------|
| Document size | 1 MB | Enforced, images stripped if exceeded |
| Collection size | Unlimited | No practical limit for this project |
| Read rate | 50K/day free | Grows with usage |
| Write rate | 20K/day free | Grows with usage |
| Real-time listeners | Unlimited | ~100 per client is typical |

Current usage: ~100 writes/day (safe)

---

## Troubleshooting

### Listener Errors

If you see `[FirebaseStore] ❌ Listener error`:
1. Check Firebase Console for data structure errors
2. Verify authentication is working
3. Check security rules allow read/write
4. Restart the app

### Silent Failures

If data isn't persisting:
1. Check browser console for `[FirebaseStore]` messages
2. Verify network tab shows POST requests to Firestore
3. Check Firebase Console quota usage
4. Verify security rules aren't blocking writes

### Image Size Errors

If images are being stripped:
1. Ensure images are <1MB when base64 encoded
2. Consider hosting large images externally (Firebase Storage)
3. Compress images before uploading
4. Use `MAP_IMAGE_LENGTH` constant to adjust limit

### RoomId Not Changing

If room-scoped data isn't loading:
1. Verify `setRoomId()` is called before accessing data
2. Wait for `isLoaded` flag to be true
3. Check that room document exists in Firestore
4. Verify room ID format (no special characters)

