# Plan: User-Generated Content, Friends, and Privacy System

## Overview

Add a social layer so users can:
1. Create content (crawlers, mobs, maps, episodes, etc.) that is **private by default** (only visible to themselves and their friends)
2. Send/accept friend requests to share content with specific people
3. Optionally opt-in to see **all** user-generated content via a setting
4. Set a unique **username/tag** for discoverability (required for both Google and email accounts)

---

## Architecture

### New Firestore Collections (global, NOT room-scoped)

These collections live at the **root level** (not under `rooms/`), since they represent cross-game user identity:

| Collection | Doc ID | Purpose |
|-----------|--------|---------|
| `userProfiles` | Firebase `uid` | Display name, username tag, avatar, preferences |
| `friendRequests` | Auto-generated | Pending friend request from one user to another |
| `friendships` | Sorted `uid1_uid2` | Confirmed friendship (single doc per pair for easy querying) |

### Data Model

```typescript
// New type in gameData.ts
interface UserProfile {
  id: string;             // Firebase Auth uid
  username: string;       // Unique tag e.g. "DragonSlayer42" — used for friend lookups
  displayName: string;    // Freeform display name
  avatarUrl?: string;     // Optional avatar (from Google or uploaded)
  email?: string;         // Stored for reference (populated from auth)
  showUserContent: boolean; // Setting: see ALL user content, not just friends'
  createdAt: number;      // Epoch ms
  updatedAt: number;
}

interface FriendRequest {
  id: string;
  fromUserId: string;     // Sender uid
  fromUsername: string;    // Denormalized for display
  toUserId: string;       // Recipient uid
  toUsername: string;      // Denormalized for display
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

interface Friendship {
  id: string;             // `${uid1}_${uid2}` (sorted alphabetically)
  userIds: [string, string];
  createdAt: number;
}
```

### Content Ownership & Visibility

Every document in content collections (crawlers, mobs, maps, episodes, etc.) will gain two new fields:

```typescript
// Added to existing types (Crawler, Mob, MapData, Episode, etc.)
{
  createdByUserId?: string;   // Firebase uid of creator (undefined = legacy/shared data)
  visibility?: 'private' | 'friends' | 'public';  // Default: 'private'
}
```

**Visibility rules:**
- `private` — only visible to the creator
- `friends` — visible to creator + confirmed friends
- `public` — visible to everyone (equivalent to current behavior)
- Documents with **no** `createdByUserId` (legacy data) are treated as `public`

---

## Implementation Steps

### Phase 1: User Profiles & Username Setup

**Files to modify/create:**

1. **`src/lib/gameData.ts`** — Add `UserProfile`, `FriendRequest`, `Friendship` types

2. **`src/types/collections.ts`** — Add `'userProfiles' | 'friendRequests' | 'friendships'`

3. **`src/lib/firebase.ts`** — Add a `getUserProfileRef()` helper that always reads/writes at root level (never room-scoped)

4. **`src/contexts/AuthContext.tsx`** — Extend to:
   - Load/create `UserProfile` doc on sign-in (if none exists, prompt for username)
   - Expose `userProfile` in context
   - Expose `updateUserProfile()` method

5. **`src/components/UsernameSetupModal.tsx`** (NEW) — Modal that appears after first sign-in:
   - Requires the user to pick a unique username (validated against Firestore for uniqueness)
   - Shows display name field (pre-filled from Google `displayName` or email account name)
   - Blocks app interaction until username is set

### Phase 2: Friends System

**Files to create:**

6. **`src/hooks/useFriends.ts`** (NEW) — Hook that:
   - Subscribes to `friendRequests` where `toUserId == myUid` (incoming)
   - Subscribes to `friendRequests` where `fromUserId == myUid` (outgoing)
   - Subscribes to `friendships` where `userIds` contains `myUid`
   - Provides: `sendFriendRequest(username)`, `acceptRequest(id)`, `declineRequest(id)`, `removeFriend(friendshipId)`
   - Exposes: `friends[]`, `incomingRequests[]`, `outgoingRequests[]`

7. **`src/components/FriendsPanel.tsx`** (NEW) — UI component with:
   - Search by username field + "Send Request" button
   - Incoming requests list with Accept/Decline buttons
   - Current friends list with Remove button
   - Outgoing pending requests list
   - Badge count for pending incoming requests

### Phase 3: Content Visibility

**Files to modify:**

8. **`src/hooks/useGameState.ts`** — Add a filtering layer:
   - After loading each collection, filter documents based on visibility rules:
     - Always show docs where `createdByUserId` is undefined (legacy/public)
     - Always show docs where `createdByUserId === myUid` (own content)
     - Show `friends` visibility docs if the creator is in the user's friend list
     - Show `public` docs always
     - If `userProfile.showUserContent === true`, show everything regardless
   - The filtering happens in the memoized getters, not at the Firestore query level (simpler, avoids complex compound queries)

9. **Existing content types** (`Crawler`, `Mob`, `MapData`, `Episode`, `LootBoxTemplate`, `WikiPage`, `Quest`) — Add optional `createdByUserId` and `visibility` fields

10. **Content creation flows** — When a signed-in user creates content (e.g., `addCrawler`, `addMob`), automatically stamp `createdByUserId` and set `visibility: 'private'`

11. **Visibility controls on content** — Add a small dropdown/icon on each piece of content (crawler card, mob card, etc.) letting the creator change visibility between `private` / `friends` / `public`

### Phase 4: Settings UI

**Files to create/modify:**

12. **`src/views/SettingsView.tsx`** (NEW) or integrate into existing Navigation — Settings page with:
    - **Account section:** Display name, username (read-only after set? or editable), email, sign out
    - **Content preferences:** Toggle for "Show all user-generated content" (`showUserContent`)
    - **Friends section:** Embedded `FriendsPanel` or link to it

13. **`src/pages/Index.tsx`** — Add `settings` to the game views and route, wire the SettingsView

14. **`src/components/Navigation.tsx`** — Add a Settings nav button (gear icon)

### Phase 5: Cleanup & Polish

15. **`src/components/AuthModal.tsx`** — After successful sign-in/sign-up, if no `UserProfile` exists, automatically open the `UsernameSetupModal`

16. **`changelog.json`** — Add entries for all new features

17. **`src/lib/wikiDefaults.ts`** — Add/update wiki pages for:
    - Accounts & Sign-In (update existing)
    - Friends system (new)
    - Content visibility (new)
    - Settings (new)

---

## Key Design Decisions

1. **Filtering in JS, not Firestore queries** — Firestore doesn't support OR queries well across multiple conditions (own + friends + public). Since the collections are already fully loaded via `onSnapshot`, filtering in `useGameState` is simpler and more reliable.

2. **Usernames stored in `userProfiles` collection** — Uniqueness enforced via a Firestore transaction (read-check-write). Lookups by username use a `where('username', '==', input)` query.

3. **Friendship as a single sorted-ID doc** — Using `uid1_uid2` (sorted) as the document ID means checking friendship is a single `getDoc()` call, and each pair only has one document.

4. **Legacy data treated as public** — All existing documents without `createdByUserId` remain visible to everyone, so nothing breaks.

5. **`userProfiles` collection is root-level (not room-scoped)** — User identity and friends exist independently of game rooms. However, content visibility still applies within rooms.

6. **Username required after first sign-in** — A blocking modal ensures every authenticated user has a discoverable username before they can interact with the app.

---

## What Needs Firestore Rules Updates

The `userProfiles`, `friendRequests`, and `friendships` collections need rules that:
- Allow authenticated users to read/write their own profile
- Allow authenticated users to read any profile (for friend lookups by username)
- Allow creating friend requests only from the authenticated user's own uid
- Allow the recipient to accept/decline their own incoming requests
- Allow either party to delete a friendship
