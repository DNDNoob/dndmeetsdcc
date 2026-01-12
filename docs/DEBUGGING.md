# Debugging Guide

How to diagnose and fix issues in the application.

## Common Issues & Solutions

### Data Not Persisting

#### Symptom
Changes don't save after reload

#### Diagnosis

1. **Check console for Firebase logs**:
   ```
   Look for: [FirebaseStore] ✅ Added item
   Bad: [FirebaseStore] ❌ Add error
   ```

2. **Verify Firestore listener**:
   ```
   Look for: [FirebaseStore] 🔄 Real-time update: {collection}
   If missing: Listeners may not be set up
   ```

3. **Check network tab**:
   - DevTools > Network
   - Look for requests to `firestore.googleapis.com`
   - Should see POST requests with collection names

#### Solutions

**Solution 1: Verify authentication**
```typescript
// In browser console
import { getAuth } from 'firebase/auth';
const auth = getAuth();
console.log('Current user:', auth.currentUser);
// Should show uid like: "XXXXXXXXXXXXXXXXx" (anonymous)
```

**Solution 2: Check if isLoaded flag is true**
```typescript
// In browser console
import { useGameState } from '@/hooks/useGameState';
const { isLoaded } = useGameState();
console.log('isLoaded:', isLoaded);
// Should be true after ~1 second
```

**Solution 3: Verify Firestore security rules**
- Go to Firebase Console > Firestore > Rules
- Should allow anonymous auth:
  ```javascript
  match /{document=**} {
    allow read, write: if request.auth != null;
  }
  ```

**Solution 4: Clear browser cache**
```bash
# Clear all storage and reload
# DevTools > Application > Storage > Clear site data
# Then refresh page
```

**Solution 5: Check Firebase project**
```bash
# Verify .env has correct values
grep VITE_FIREBASE .env

# Should show valid API key and project ID
VITE_FIREBASE_PROJECT_ID=dndmeetsdcc
VITE_FIREBASE_API_KEY=AIzaSy...
```

---

### Real-Time Updates Not Syncing

#### Symptom
Changes in one browser don't appear in another

#### Diagnosis

1. **Check listener status**:
   ```
   Look for: [FirebaseStore] 🔄 Real-time update
   If missing: Listeners not active
   ```

2. **Verify roomId is set**:
   ```typescript
   // In browser console
   import { useGame } from '@/contexts/GameContext';
   const { roomId } = useGame();
   console.log('Current roomId:', roomId);
   // Should be null (global) or a room ID string
   ```

3. **Check for update logs**:
   ```
   After making change in window 1:
   Look for [FirebaseStore] 🔄 Real-time update in window 2
   If missing: Update not reaching this client
   ```

#### Solutions

**Solution 1: Verify both browsers are connected**
- Both should show `[FirebaseStore] 🔄 Real-time update` after making changes
- If not, one browser may be offline

**Solution 2: Check browser offline status**
- DevTools > Network > Offline checkbox
- Should be unchecked (not offline)
- Turn on/off to test

**Solution 3: Verify same project/room**
- Both browsers should be in same room
- Or both should have roomId = null (global mode)
- If different rooms, updates won't sync

**Solution 4: Check network connectivity**
- Look for failed requests in Network tab
- Verify no CORS errors
- Check firewall/proxy isn't blocking Firebase

**Solution 5: Force refresh listeners**
- Close and reopen page
- Listeners should re-establish automatically
- Check for `[FirebaseStore] 📂 Setting up real-time sync...`

---

### "Cannot read properties of undefined" Error

#### Symptom
```
TypeError: Cannot read properties of undefined (reading 'map')
  at ProfilesView.tsx:123
```

#### Diagnosis

Usually means data isn't loaded yet, but component is trying to render it.

1. **Find the error line**:
   - Error stack shows file and line number
   - Check that file and line

2. **Check if isLoaded**:
   ```typescript
   // Does component check isLoaded?
   if (!isLoaded) return <Loading />;
   ```

#### Solutions

**Solution 1: Add loading check**
```typescript
import { useGameState } from '@/hooks/useGameState';

const MyView = () => {
  const { crawlers, isLoaded } = useGameState();
  
  // Add this!
  if (!isLoaded) {
    return <div>Loading...</div>;
  }
  
  // Now safe to use crawlers
  return crawlers.map(...);
};
```

**Solution 2: Use optional chaining**
```typescript
// Instead of:
return crawlers.map(...)

// Use:
return crawlers?.map(...) || <div>No data</div>;
```

**Solution 3: Check collection is initialized**
```typescript
const items = getCollection('mobs') as Mob[];
if (!items || items.length === 0) {
  return <div>No mobs found</div>;
}
```

---

### Authentication Failed

#### Symptom
```
FirebaseError: Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)
```

Or in console:
```
[FirebaseStore] ❌ Setup error: FirebaseError: Firebase: Error ...
```

#### Diagnosis

1. **Check .env file exists**:
   ```bash
   cat .env
   ```

2. **Verify API key is present**:
   ```bash
   grep "VITE_FIREBASE_API_KEY" .env
   ```

3. **Check API key is valid**:
   - Should be long alphanumeric string
   - Should start with "AIza..."

#### Solutions

**Solution 1: Check .env file**
```bash
# Verify all Firebase env vars present
echo "API Key: $(grep VITE_FIREBASE_API_KEY .env)"
echo "Project: $(grep VITE_FIREBASE_PROJECT_ID .env)"
echo "Auth Domain: $(grep VITE_FIREBASE_AUTH_DOMAIN .env)"
```

**Solution 2: Update from Firebase Console**
1. Go to Firebase Console
2. Project Settings > General
3. Copy "Web API Key"
4. Update .env:
   ```
   VITE_FIREBASE_API_KEY=<paste key here>
   ```

**Solution 3: Verify Firebase Console**
- Go to Project Settings > Service Accounts
- Verify project ID matches .env
- Check if authentication is enabled

**Solution 4: Clear browser cache and reload**
```bash
# Clear cache completely
# DevTools > Application > Storage > Clear site data
# Restart dev server: npm run dev
```

---

### Image Upload Fails

#### Symptom
```
Image not saving, or console shows:
[FirebaseStore] ⚠️ Image too large; stripping before save
```

#### Diagnosis

1. **Check image size**:
   ```typescript
   // In browser console
   const image = document.querySelector('img[alt="Avatar"]');
   const base64 = image.src; // if it's data URI
   console.log('Size:', (base64.length / 1024 / 1024).toFixed(2), 'MB');
   ```

2. **Check if image is being stripped**:
   - Look for warning in console
   - If present: Image too large

#### Solutions

**Solution 1: Compress image before upload**
```typescript
const compressImage = async (base64: string, maxSize = 1_000_000) => {
  if (base64.length <= maxSize) return base64;
  
  // Create canvas and compress
  const img = new Image();
  img.src = base64;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Reduce dimensions
  canvas.width = img.width * 0.5;
  canvas.height = img.height * 0.5;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  return canvas.toDataURL('image/jpeg', 0.7);
};
```

**Solution 2: Use external image URL**
```typescript
// Instead of base64
const crawler = {
  id: 'crawler-1',
  name: 'Carl',
  avatar: 'https://example.com/avatar.png'  // ← URL instead of base64
};
```

**Solution 3: Upload to Firebase Storage**
```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

const uploadImage = async (file: File) => {
  const storageRef = ref(storage, `avatars/${crypto.randomUUID()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Usage:
const url = await uploadImage(file);
await updateCrawler(crawlerId, { avatar: url });
```

---

### Room/Multiplayer Not Working

#### Symptom
```
- setRoomId() called but data doesn't change
- Different windows show same data (should be isolated)
- Room data from previous room showing
```

#### Diagnosis

1. **Check if roomId is set**:
   ```typescript
   // In browser console
   import { useGame } from '@/contexts/GameContext';
   const { roomId } = useGame();
   console.log('Current room:', roomId);
   ```

2. **Check Firestore path**:
   - If roomId is set: Should listen to `rooms/{roomId}/crawlers`
   - If null: Should listen to `crawlers` (global)

3. **Look for listener setup logs**:
   ```
   [FirebaseStore] 📂 Setting up real-time sync...
   If no update after roomId change: May not have re-subscribed
   ```

#### Solutions

**Solution 1: Ensure roomId changes trigger update**
```typescript
// In RoomManager or where you call setRoomId
const handleJoinRoom = (roomId: string) => {
  console.log('Joining room:', roomId);
  setRoomId(roomId);  // This should trigger re-subscription
};
```

**Solution 2: Verify room exists in Firestore**
- Go to Firebase Console
- Navigate to `rooms > {roomId}`
- Should see subcollections: crawlers, mobs, maps, inventory

**Solution 3: Create room if it doesn't exist**
```typescript
const createRoom = async (roomId: string) => {
  const roomRef = doc(db, 'rooms', roomId);
  await setDoc(roomRef, { createdAt: new Date().toISOString() });
};
```

**Solution 4: Check useEffect dependencies**
- Verify useFirebaseStore has `[roomId]` in dependency array
- If missing: Won't re-subscribe on room change

---

### Performance Issues

#### Symptom
- Page is slow or laggy
- Lots of re-renders
- High CPU/memory usage

#### Diagnosis

1. **Check for unnecessary re-renders**:
   ```typescript
   // Add to component
   console.log('ProfilesView rendering');
   ```

2. **Monitor performance**:
   - DevTools > Performance > Record
   - Do an action
   - Stop recording
   - Look for bottlenecks

3. **Check listener count**:
   - Should have 4 active listeners (one per collection)
   - More than 4 = listeners not being cleaned up

#### Solutions

**Solution 1: Add React.memo**
```typescript
const ProfilesView = React.memo(({ crawlers, ... }: ProfilesViewProps) => {
  // Component won't re-render if props haven't changed
});
```

**Solution 2: Memoize expensive calculations**
```typescript
const partyGold = useMemo(() => {
  return crawlers.reduce((sum, c) => sum + (c.gold || 0), 0);
}, [crawlers]);
```

**Solution 3: Verify listeners are cleaned up**
```typescript
// In useFirebaseStore useEffect, should have cleanup:
return () => {
  console.log('[FirebaseStore] 🧹 Cleaning up listeners');
  unsubscribers.forEach(unsub => unsub());
};
```

**Solution 4: Reduce collection size**
- Add pagination for large collections
- Only load needed data
- Consider adding indexes in Firestore

---

### Network Errors in Console

#### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `CORS error` | Blocked by browser | Firestore should auto-handle, check domain |
| `PERMISSION_DENIED` | Security rules block access | Update Firestore rules |
| `UNAUTHENTICATED` | Not signed in | initAuth() must complete first |
| `UNAVAILABLE` | Firebase service down | Check Firebase status page |
| `INVALID_ARGUMENT` | Bad query/data | Check data structure matches types |

#### Solutions

**For CORS errors**:
```bash
# Usually resolves on its own
# If persists: Check Firebase Console > Settings > Authorized domains
# Add your domain to whitelist
```

**For PERMISSION_DENIED**:
```javascript
// Update Firestore rules to:
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

**For UNAUTHENTICATED**:
```typescript
// Ensure auth is initialized
await initAuth();  // Wait for this first
```

---

## Debugging Tools

### Browser Console

```typescript
// Check current state
import { useGame } from '@/contexts/GameContext';
const { getCollection, roomId, data } = useGame();
console.log('All data:', data);
console.log('Current room:', roomId);
console.log('Crawlers:', getCollection('crawlers'));
```

### Firebase Console

1. **View data**: Firestore Database > Browse collections
2. **Monitor requests**: Usage tab shows read/write counts
3. **Test rules**: Rules tab > Test Rules feature
4. **View logs**: Cloud Functions > Logs (if using functions)

### DevTools Network Tab

1. Filter by `firestore`
2. Look for requests to `firestore.googleapis.com`
3. Check request/response payloads
4. Verify status codes (200 = success, 40x = error)

### DevTools Performance

1. Click Record
2. Do an action
3. Stop recording
4. Look for:
   - Long tasks (>50ms)
   - Forced reflows
   - Component renders

### React DevTools

1. Install React DevTools extension
2. Inspect components
3. Check props and state
4. Look for unnecessary re-renders (highlight updates)

---

## Getting Help

### Check These First

1. **Look for `[FirebaseStore]` logs** - Tells you what's happening
2. **Check .env file** - Firebase config correct?
3. **Reload the page** - Clears stale state
4. **Clear browser cache** - Removes old cached code
5. **Check Firebase Console** - Data there?

### Enable Debug Mode

```typescript
// At top of useFirebaseStore.ts
const DEBUG = true;

const log = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(`[FirebaseStore] ${message}`, data);
  }
};
```

### Create Minimal Reproduction

```typescript
// In browser console
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const config = { /* firebase config */ };
const app = initializeApp(config);
const db = getFirestore(app);

const snap = await getDocs(collection(db, 'crawlers'));
console.log('Crawlers:', snap.docs.map(d => d.data()));
```

If this works but app doesn't = problem in app logic
If this fails = problem with Firebase connection

---

## Performance Profiling

### Memory Leaks

```typescript
// Check for listener leaks
// Open DevTools > Sources > Event Listeners tab
// Should see ~4 "snapshot" listeners (one per collection)
// More than that = leak
```

### Bundle Size

```bash
# Check bundle size
npm run build

# Look at dist/index.js size
# Should be <200KB for production
```

### Network Requests

```typescript
// Monitor Firestore requests
// DevTools > Network > Filter by "firestore"
// Each operation should be <200ms
```

