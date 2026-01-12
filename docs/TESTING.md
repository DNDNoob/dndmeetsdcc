# Testing Guide

How to test the application, verify data persistence, and validate functionality.

## Automated Tests

### Data Persistence Test

Comprehensive test of all data types (CREATE, READ, UPDATE, DELETE):

```bash
node test-data-persistence.mjs
```

**What it tests**:
- ✅ Crawlers (character data)
- ✅ Inventory (items per crawler)
- ✅ Mobs (enemies/NPCs)
- ✅ Maps (dungeon maps)

**Output**:
```
🔥 Firebase Data Persistence Test Suite

Testing all user-created data types...

🔐 Authenticating...
✅ Authenticated

📦 Testing crawlers...
  ➕ Adding Crawler...
  ✅ Added Crawler with ID: TEST_PERSIST_crawler_1768159198768
  📖 Reading Crawler...
  ✅ Crawler successfully retrieved
  ✏️  Updating Crawler...
  ✅ Crawler successfully updated
  🗑️  Deleting Crawler...
  ✅ Crawler successfully deleted

✅ crawlers - ALL TESTS PASSED

... (same for inventory, mobs, maps) ...

📊 Results: 4/4 tests passed

🎉 ALL DATA TYPES ARE BEING SAVED CORRECTLY!
```

### Firebase CRUD Test

Lower-level Firestore operation test:

```bash
npm run test:firebase
```

**Checks**: Basic read/write operations, authentication

---

## Manual Testing Checklist

### 1. Character Management (ProfilesView)

```
☐ Create new crawler
  └─ Verify saved to Firebase
  └─ Reload page - crawler persists

☐ Edit crawler
  └─ Change name, stats, level
  └─ Verify changes saved in real-time
  └─ Reload page - changes persist

☐ Delete crawler
  └─ Verify inventory deleted too
  └─ Reload page - crawler gone

☐ Upload avatar
  └─ Select image file
  └─ Verify displays
  └─ Reload page - avatar persists

☐ Add multiple crawlers
  └─ Switch between them
  └─ Verify each has own data
```

### 2. Inventory Management (InventoryView)

```
☐ Add item to crawler
  └─ Enter name and description
  └─ Verify shows in list
  └─ Reload page - item persists

☐ Equip/unequip item
  └─ Toggle equipped flag
  └─ Verify state changes immediately

☐ Delete item
  └─ Click delete
  └─ Verify item removed
  └─ Reload page - item gone

☐ Gold management
  └─ Add gold to crawler
  └─ Verify party gold sums correctly
  └─ Reload page - gold persists

☐ Multiple crawlers
  └─ Add items to each crawler
  └─ Switch crawlers
  └─ Verify each has own inventory
```

### 3. Mob Management (MobsView)

```
☐ View mobs
  └─ See all non-hidden mobs
  └─ Verify stats display correctly

☐ Mob visibility (Admin)
  └─ Login as DM (Dungeon AI)
  └─ See all mobs including hidden
  └─ Toggle mob hidden status
  └─ Verify players don't see hidden

☐ Mob images
  └─ Mobs with images display correctly
  └─ Reload page - images persist

☐ Hidden fields
  └─ HP, weaknesses, strengths can be hidden
  └─ Toggle hidden flags
  └─ Verify visibility changes
```

### 4. Map Management (MapsView)

```
☐ View maps
  └─ See all uploaded maps
  └─ Verify images display

☐ Upload map (Admin)
  └─ Add new map image
  └─ Verify size <1MB
  └─ Reload page - map persists

☐ Map visibility (Admin)
  └─ Toggle map visibility
  └─ Players can't see hidden maps
  └─ Admins always see all maps

☐ Multiple maps
  └─ Add several maps
  └─ Verify all display correctly
  └─ Reload page - all persist
```

### 5. Admin Features (DungeonAIView)

```
☐ DM Login
  └─ Click "DUNGEON AI" button
  └─ Verify logged in as admin
  └─ See all hidden content

☐ Create/Edit Mobs
  └─ Add new mob
  └─ Edit mob stats
  └─ Verify changes persist
  └─ Hidden flag works

☐ Manage Maps
  └─ Upload maps
  └─ Toggle visibility
  └─ Delete maps

☐ Logout
  └─ Click logout
  └─ Return to character selection
  └─ Verify previous player restored
```

### 6. Real-Time Sync

```
☐ Multiple browsers
  └─ Open app in 2 browser windows
  └─ Modify data in window 1
  └─ Verify updates instantly in window 2
  └─ No page reload needed

☐ Network latency
  └─ Open DevTools network throttling
  └─ Make changes (should still work)
  └─ Verify eventual consistency

☐ Offline then back online
  └─ Disable network
  └─ Make changes (uses localStorage)
  └─ Re-enable network
  └─ Verify changes sync to Firestore
```

### 7. Error Scenarios

```
☐ Large image upload
  └─ Try uploading image >1MB
  └─ Verify image stripped (logged as warning)
  └─ Rest of data still saves

☐ Invalid data
  └─ Try invalid stats (e.g., negative gold)
  └─ Verify handled gracefully

☐ Network error
  └─ Block Firebase domain in DevTools
  └─ Try to save
  └─ Verify error message shown
  └─ Re-enable, verify retries work

☐ Missing fields
  └─ Try saving crawler without name
  └─ Verify validation or defaults work
```

### 8. Browser Storage

```
☐ LocalStorage backup
  └─ Open DevTools Storage > LocalStorage
  └─ Verify data stored locally
  └─ Maps excluded from localStorage
  └─ Other collections included

☐ Offline fallback
  └─ Disconnect from Firebase
  └─ View previously loaded data
  └─ Make changes (stored in localStorage)
  └─ Reconnect - changes sync

☐ Clear localStorage
  └─ Clear all localStorage
  └─ Reload page
  └─ Verify fresh defaults load
  └─ Modify data (syncs to Firebase)
```

---

## Performance Testing

### Load Testing

Test with large amounts of data:

```typescript
// In browser console
const { addItem } = useGame();

// Add 100 crawlers
for (let i = 0; i < 100; i++) {
  await addItem('crawlers', {
    id: `test-crawler-${i}`,
    name: `Crawler ${i}`,
    level: Math.random() * 20,
    // ... other fields
  });
}
```

**Monitor**:
- Memory usage (DevTools > Performance > Memory)
- Frame rate (DevTools > Performance > FPS)
- Network requests (DevTools > Network)

### Real-time Listener Performance

```typescript
// Check listener count
// In Firefox: about:memory (search "firestore")
// In Chrome: DevTools > Sources > Event Listeners
```

Should have 4 listeners (one per collection).

---

## Console Logging

All Firebase operations log with `[FirebaseStore]` prefix:

```
[FirebaseStore] 🔐 Initializing authentication...
[FirebaseStore] ✅ Authentication ready
[FirebaseStore] 📂 Setting up real-time sync...
[FirebaseStore] 🔄 Real-time update: crawlers 2
[FirebaseStore] ✅ Added item: crawlers crawler-1
[FirebaseStore] ✏️ Updated item: mobs mob-123
[FirebaseStore] 🗑️ Deleted item: inventory crawler-1
[FirebaseStore] ❌ Listener error for crawlers: Permission denied
```

### Enable Detailed Logging

In browser console:

```typescript
// Set Firebase debug logging
import { enableLogging } from 'firebase/firestore';
enableLogging(true);
```

### Common Log Patterns

| Log | Meaning | Action |
|-----|---------|--------|
| `🔐 Initializing authentication` | Starting auth flow | Wait for ✅ |
| `✅ Authentication ready` | Auth complete | Safe to access Firestore |
| `🔄 Real-time update: crawlers 2` | Listener received update | Working normally |
| `⚠️ Image too large; stripping` | Image >1MB | Logged but data saved |
| `❌ Listener error` | Connection issue | Check network/rules |

---

## Firebase Console Testing

### View Data

1. Go to [Firebase Console](https://console.firebase.google.com/project/dndmeetsdcc/firestore)
2. Select `dndmeetsdcc` project
3. Go to Firestore Database
4. Browse collections:
   - `crawlers` - See all crawlers
   - `mobs` - See all mobs
   - `inventory` - See all inventory entries
   - `maps` - See all map images

### Monitor Activity

1. Go to **Firestore > Usage**
2. See read/write operations
3. Verify operations spike when making changes

### Check Security Rules

1. Go to **Firestore > Rules**
2. View current rules
3. Deploy new rules with **Publish**

### Test Rules

1. Go to **Firestore > Rules > Test Rules**
2. Enter test data
3. Verify read/write allowed/denied

---

## Regression Testing

After making changes, verify:

### Persistence Tests
```bash
npm run test:firebase
node test-data-persistence.mjs
```

### Browser Tests
1. Create crawler → Verify saves
2. Edit crawler → Verify updates
3. Delete crawler → Verify deletes
4. Reload page → Verify data persists

### Multi-Browser Sync
1. Open 2 browser windows
2. Edit in window 1
3. Verify updates in window 2 (no reload)

### Admin Features
1. Login as Dungeon AI
2. Create/edit/delete mobs
3. Toggle visibility
4. Logout and verify

---

## Test Environment Setup

### Local Testing

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# In another terminal, run tests
node test-data-persistence.mjs
npm run test:firebase
```

### CI/CD Testing

Automated tests run on every push:

```yaml
# Example GitHub Actions workflow
name: Tests
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run test:firebase
      - run: node test-data-persistence.mjs
```

---

## Debugging Failed Tests

### Test Fails: "API Key Not Valid"

**Cause**: Firebase config incorrect or expired
**Fix**:
```bash
# Check .env file
cat .env | grep VITE_FIREBASE

# Update if needed from Firebase Console
# Project Settings > General > Web API Key
```

### Test Fails: "Permission Denied"

**Cause**: Firestore security rules too restrictive
**Fix**:
1. Go to Firebase Console
2. Firestore > Rules
3. Ensure anonymous auth allowed:
   ```javascript
   match /{document=**} {
     allow read, write: if request.auth != null;
   }
   ```
4. Publish rules

### Test Fails: "Collection Not Found"

**Cause**: Different project or collection name
**Fix**:
1. Check project ID: `dndmeetsdcc`
2. Check collection names: `crawlers`, `mobs`, `inventory`, `maps`
3. Verify in Firebase Console

### Component Doesn't Update

**Debugging Steps**:
1. Open DevTools Console
2. Search for `[FirebaseStore]` messages
3. Check for error messages
4. Verify isLoaded flag is true
5. Check React DevTools for state changes

---

## Performance Benchmarks

Expected performance metrics:

| Metric | Target | Current |
|--------|--------|---------|
| Page load | <2s | ~1s |
| Firestore write | <500ms | ~200ms |
| Real-time update | <100ms | ~50ms |
| Memory usage | <50MB | ~30MB |
| Bundle size | <200KB | ~150KB |

Track with DevTools > Performance > Record.

