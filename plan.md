# Plan: Campaign System with User Accounts

## Overview

Replace the current open-access room model with a **campaign-based system** where:

1. Any **authenticated user** can create a campaign, making them the **DM** (with full DM console access)
2. Other users can **join** a campaign via an invite link — but must **log in first**
3. Campaigns are **isolated** — you can only see campaigns you created or are a member of
4. The old "Dungeon AI login" password system is **removed** — campaign ownership determines DM access

---

## Architecture

### New Firestore Collections (root-level)

| Collection | Doc ID | Purpose |
|-----------|--------|---------|
| `userProfiles` | Firebase `uid` | Display name, username tag, avatar, preferences |
| `campaigns` | Auto-generated | Campaign metadata, owner, member list |

### Data Model

```typescript
// New types in gameData.ts

interface UserProfile {
  id: string;             // Firebase Auth uid
  username: string;       // Unique tag e.g. "DragonSlayer42" — used for lookups
  displayName: string;    // Freeform display name
  avatarUrl?: string;     // Optional avatar (from Google or uploaded)
  email?: string;         // Stored for reference (populated from auth)
  createdAt: number;      // Epoch ms
  updatedAt: number;
}

interface Campaign {
  id: string;             // Auto-generated
  name: string;           // Campaign name (e.g. "Curse of the Crimson Throne")
  description?: string;   // Optional description
  ownerId: string;        // Firebase uid of campaign creator (the DM)
  ownerName: string;      // Denormalized display name for UI
  memberIds: string[];    // Firebase uids of players who have joined
  inviteCode?: string;    // Short unique code for invite links
  createdAt: number;
  updatedAt: number;
}
```

### Campaign ↔ Room Mapping

Each campaign maps to a **room** in the existing room-scoped Firestore structure:

- Campaign `id` = `roomId` used in `getCollectionRef(name, roomId)`
- All game data (crawlers, mobs, maps, episodes, etc.) lives under `rooms/{campaignId}/...`
- This reuses the existing room-scoped architecture — no migration needed

### Access Control Model

| Role | How Determined | Can See Campaign? | DM Console Access? |
|------|---------------|-------------------|---------------------|
| **Owner (DM)** | `campaign.ownerId === user.uid` | Yes | Yes — full access to DungeonAI, mob creation, episode management, etc. |
| **Member (Player)** | `campaign.memberIds.includes(user.uid)` | Yes | No — player-only views (profiles, inventory, showtime, wiki) |
| **Non-member** | Neither owner nor member | No — campaign is invisible | No |

### Invite Link Flow

1. DM creates campaign → system generates an `inviteCode` (e.g. `abc123`)
2. DM shares link: `https://app.example.com/join/abc123`
3. Visitor clicks link → if not logged in, **prompted to log in first**
4. After authentication, the invite code is validated
5. User is added to `campaign.memberIds`
6. User is redirected to the campaign's game view

---

## Implementation Steps

### Step 1: Types & Collections

**Files to modify:**

1. **`src/lib/gameData.ts`** — Add `UserProfile` and `Campaign` types

2. **`src/types/collections.ts`** — Add `'userProfiles' | 'campaigns'` to `CollectionName`

3. **`src/hooks/useFirebaseStore.ts`** — Add `'userProfiles'` and `'campaigns'` to the `collections` array (these are root-level, not room-scoped)

### Step 2: User Profiles & Username Setup

4. **`src/contexts/AuthContext.tsx`** — Extend to:
   - Load/create `UserProfile` doc on sign-in (if none exists, prompt for username)
   - Expose `userProfile` in context
   - Expose `updateUserProfile()` method

5. **`src/components/UsernameSetupModal.tsx`** (NEW) — Modal after first sign-in:
   - Requires unique username (validated against Firestore)
   - Display name field (pre-filled from Google `displayName` or email)
   - Blocks app interaction until username is set

### Step 3: Campaign CRUD & Selection

6. **`src/hooks/useCampaigns.ts`** (NEW) — Hook that:
   - Subscribes to campaigns where `ownerId == myUid` OR `memberIds` contains `myUid`
   - Provides: `createCampaign(name, description?)`, `deleteCampaign(id)`, `updateCampaign(id, updates)`
   - Provides: `generateInviteCode(campaignId)`, `joinCampaign(inviteCode)`
   - Provides: `leaveCampaign(campaignId)`, `removeMember(campaignId, userId)`
   - Exposes: `myCampaigns[]` (owned), `joinedCampaigns[]` (member of)

7. **`src/views/CampaignSelectView.tsx`** (NEW) — Campaign selection screen:
   - Lists "My Campaigns" (owned — shows DM badge) and "Joined Campaigns" (member)
   - "Create New Campaign" button with name/description form
   - Click campaign → enters game with that campaign's roomId
   - Shows invite link/code for owned campaigns

### Step 4: Replace Admin Login with Campaign Ownership

8. **`src/pages/Index.tsx`** — Major changes:
   - Remove `isDungeonAILoggedIn` state and `STORAGE_KEY_DUNGEON_AI_LOGIN`
   - Remove DM login password flow entirely
   - Compute `isAdmin` from campaign ownership: `campaign.ownerId === user.uid`
   - Add campaign selection as a required step before entering game views
   - Store active campaign in state; pass `roomId = campaign.id` to `useGameState`
   - Gate DM-only views (DungeonAI) on `isAdmin` (campaign owner), not password

9. **`src/components/MainMenu.tsx`** — Remove DM login/logout buttons; replace with campaign-aware menu:
   - DM sees full menu (all views including DungeonAI)
   - Players see player-only menu items
   - Show current campaign name

10. **`src/components/Navigation.tsx`** — Remove DM login toggle from nav; add "Back to Campaigns" option

### Step 5: Invite Link Routing

11. **`src/App.tsx`** — Add route for `/join/:inviteCode`:
    - If user is authenticated → validate invite code, join campaign, redirect to game
    - If user is NOT authenticated → show login screen, then process invite after auth

12. **`src/pages/JoinCampaign.tsx`** (NEW) — Page component for invite link:
    - Shows campaign name/description
    - "Join Campaign" button (if authenticated)
    - "Log In to Join" button (if not authenticated) → redirects to auth, then back here
    - Handles already-a-member case gracefully

### Step 6: Update Existing Components

13. **`src/views/ShowTimeView.tsx`** — `isAdmin` prop already used extensively; no changes needed to the view itself, just ensure the prop is correctly set from campaign ownership

14. **`src/components/PingPanel.tsx`** — Same as above; `isAdmin` prop already controls DM features

15. **All other views** — Review and ensure they respect the `isAdmin` prop correctly (most already do)

### Step 7: Cleanup & Polish

16. **Remove old DM login infrastructure:**
    - Remove `dcc_dungeon_ai_login` localStorage key usage
    - Remove password prompt in MainMenu
    - Remove DM login/logout handlers

17. **`changelog.json`** — Add entries for campaign system

18. **`src/lib/wikiDefaults.ts`** — Add/update wiki pages for:
    - Campaign system (new)
    - Creating & managing campaigns (new)
    - Joining campaigns via invite link (new)
    - DM vs Player roles (update existing)
    - Accounts & Sign-In (update existing)

---

## Key Design Decisions

1. **Campaign ID = Room ID** — Reuses the existing room-scoped Firestore architecture. All game data already supports `rooms/{roomId}/...` paths via `getCollectionRef()`. A campaign is just a room with ownership metadata.

2. **DM = Campaign Owner** — No more password-based admin login. The user who creates the campaign is the DM and has full access to DungeonAI, mob management, episode control, etc. This is simpler and more secure.

3. **Campaign Isolation** — Users can only see and access campaigns they own or have joined. The campaign list query filters by `ownerId` and `memberIds`. No "browse all campaigns" feature.

4. **Invite Links Require Auth** — When a user clicks a campaign invite link, they must authenticate before joining. This ensures every campaign member has a real account, not an anonymous session.

5. **`userProfiles` and `campaigns` are root-level** — Not room-scoped. User identity and campaign membership exist independently of game data.

6. **Username required after first sign-in** — A blocking modal ensures every authenticated user has a discoverable username before they can interact.

7. **No friends system initially** — The original plan included friends and content visibility/sharing. Campaign isolation replaces this: you share content by inviting people to your campaign. Friends can be added later if needed.

---

## Open Questions

1. **Can a campaign have multiple DMs?** — Current plan assumes single owner = single DM. Should we support co-DMs (e.g. an `adminIds` array)?

2. **Campaign deletion** — Should deleting a campaign delete all its game data (crawlers, mobs, maps, etc.)? Or just the campaign metadata, leaving the room data orphaned?

3. **Player limits** — Should campaigns have a maximum number of members?

4. **DM transfer** — Can a DM transfer ownership of a campaign to another member?

---

## What Needs Firestore Rules Updates

The `userProfiles` and `campaigns` collections need security rules:

- `userProfiles`: Authenticated users can read/write their own profile; any authenticated user can read any profile (for display names)
- `campaigns`: Only the owner can update/delete; members can read; the `joinCampaign` operation needs a rule allowing any authenticated user to add themselves to `memberIds` if they have a valid invite code
- Room-scoped collections (`rooms/{campaignId}/*`): Only campaign owner and members can read/write
