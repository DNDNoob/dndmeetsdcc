import type { WikiPage } from './gameData';

export const defaultWikiPages: Omit<WikiPage, 'updatedAt' | 'updatedBy'>[] = [
  {
    id: 'getting-started',
    slug: 'getting-started',
    title: 'Getting Started',
    category: 'Basics',
    order: 0,
    content: `# Getting Started

Welcome to the Dungeon Crawler Carl companion app! This tool helps a Dungeon Master (DM) run tabletop RPG sessions with real-time maps, combat tracking, dice rolling, and more. Everything syncs across all connected players in real time via Firebase.

## Choosing Your Identity

When you first load the app, you will see a splash screen where you pick who you are. You can select any of the available crawlers (player characters), or choose "Just a Boring NPC" if you want to spectate without being tied to a character.

You can switch your identity at any time by clicking the player name in the top-right corner of the navigation bar. This opens a dropdown with all available crawlers and the NPC option.

## The DM (Dungeon AI)

The DM logs in by selecting the Dungeon AI option from the splash screen or by using the DM Console login on the main menu. Once logged in as the DM, you gain access to the DM Console and a suite of admin-only controls throughout the app.

## Navigation

The navigation bar at the top of the screen gives you quick access to all the main sections:

- **Main Menu** - The hub page with navigation cards
- **Profiles** - View and manage crawler character sheets
- **Maps** - Browse uploaded maps
- **Inventory** - Manage items, equipment, and gold
- **Mobs** - View enemies and NPCs
- **Show Time** - The live game presentation view (where the action happens)
- **Sounds** - Play sound effects for everyone
- **DM Console** - Admin panel (DM only)

During Show Time, the navigation bar auto-collapses to maximize screen space. Hover near the top-left to reveal it, or click the pin button to keep it visible.`,
  },
  {
    id: 'crawlers',
    slug: 'crawlers',
    title: 'Crawlers (Player Characters)',
    category: 'Basics',
    order: 1,
    content: `# Crawlers (Player Characters)

Crawlers are the player characters in the game. Each crawler has a name, race, job, level, and a set of core stats.

## Stats

Every crawler has these core attributes:

| Stat | Abbreviation | What It Does |
|------|-------------|--------------|
| Strength | STR | Physical power, melee attacks |
| Dexterity | DEX | Agility, ranged attacks, dodging |
| Constitution | CON | Toughness, health pool |
| Intelligence | INT | Knowledge, magic power |
| Charisma | CHA | Social skills, some special abilities |

Stats start at a base value and can be modified by equipped items. The modifier for any stat is calculated as: **(stat - 10) / 2**, rounded down. For example, a STR of 14 gives a +2 modifier.

## Health and Mana

- **HP** (Hit Points): Your health pool. When it drops to 0, you are incapacitated.
- **Mana**: Your magic or special ability resource. Used for certain actions.

Both HP and Mana have maximum values that can be boosted by equipment.

## Stat Rolls

Click on any stat value on your profile page to roll a d20 plus your stat modifier. The result appears in the dice roller panel. This is used for ability checks during gameplay.

## Equipment

Crawlers can equip items in the following slots: Head, Chest, Legs, Feet, Left Hand, Right Hand, Ring Finger, and Weapon. Equipped items modify your stats and appear on your character sheet. See the Equipment page for more details.

## Avatars

You can upload a profile image (avatar) for your crawler. Images are automatically compressed to keep things fast. Avatars appear on map icons and in the navigation dropdown.`,
  },
  {
    id: 'equipment',
    slug: 'equipment',
    title: 'Equipment System',
    category: 'Game Mechanics',
    order: 10,
    content: `# Equipment System

The equipment system lets crawlers wear and wield items that modify their stats.

## Equipment Slots

Each crawler has 8 equipment slots arranged on their profile page:

| Slot | Position | Typical Items |
|------|----------|---------------|
| Head | Top | Helmets, hats, crowns |
| Chest | Center | Armor, robes, vests |
| Left Hand | Left of chest | Shields, off-hand weapons |
| Right Hand | Right of chest | Weapons, tools |
| Weapon | Center | Primary weapon (used for attacks) |
| Ring Finger | Side | Rings with magical effects |
| Legs | Below chest | Pants, leg armor |
| Feet | Bottom | Boots, shoes |

## How Equipment Works

1. Items must have an equipment slot assigned (set in the Item Library by the DM)
2. Drag an item from your inventory to the matching equipment slot on your profile
3. The item's stat modifiers immediately apply to your character
4. Equipment bonuses show as orange portions on your health/mana bars

## Stat Modifiers

Equipped items can modify any combination of stats: STR, DEX, CON, INT, CHA, HP, Max HP, Mana, and Max Mana. Positive modifiers appear in green, negative in red.

## Effective Stats

All game mechanics (rest healing, combat rolls, etc.) use your "effective" stats, which are your base stats plus all equipment modifiers. This means equipping a +5 Max HP ring before resting will let you heal to a higher maximum.`,
  },
  {
    id: 'weapons',
    slug: 'weapons',
    title: 'Weapons & Attacks',
    category: 'Game Mechanics',
    order: 11,
    content: `# Weapons & Attacks

Weapons are special equipment items that enable attack actions during combat and exploration.

## Weapon Properties

Each weapon has the following configurable properties:

- **Weapon Type**: Arcane, Body Upgrade, Bows, Crossbows, Firearms, Heavy Weapons, Improvised, Light Weapons, Mechanical, Polearms, Throwing, or Whips
- **Damage Type**: Basic, Poison, Disease, Spiritual, Radiation, Fire, Electric, or Emotional
- **Damage Dice**: One or more sets of dice (e.g., 2d6 + 1d4) rolled for damage
- **Hit Die**: Optional bonus dice added to the d20 attack roll
- **Range**: Melee or Ranged (with normal and max range in feet)
- **Splash Damage**: Whether the attack can hit multiple targets
- **Special Effects**: Custom text describing unique weapon abilities

## Attack Flow

1. **Attack Roll**: Roll d20 (plus any hit die bonus and stat modifiers) to determine if the attack connects
2. **Damage Roll**: If the attack hits, roll the weapon's damage dice plus stat modifiers

## Advantage and Disadvantage

Right-click an equipped weapon to roll with advantage (2d20, take highest) or disadvantage (2d20, take lowest). This affects only the attack roll, not damage.

## Weapon Upgrades

Right-click a weapon in your inventory to upgrade it. Upgrades let you modify the weapon's stats, dice, and name. Upgraded weapons are marked with a special label and are not affected by changes to the original item in the DM's library.

## Unarmed Strike

Every crawler can perform an unarmed strike (STR check, d4 damage) without needing a weapon equipped.`,
  },
  {
    id: 'inventory',
    slug: 'inventory',
    title: 'Inventory & Items',
    category: 'Game Mechanics',
    order: 12,
    content: `# Inventory & Items

The inventory system manages all items, gold, and the shared item library.

## Item Library

The DM creates items in the Item Library on the Inventory page. Library items serve as templates. When an item is added to a crawler's inventory, it gets its own copy. If the DM edits a library item, all non-upgraded copies in crawler inventories update automatically.

Each item can have:
- **Name** and **Description**
- **Equipment Slot** (if equippable)
- **Gold Value**
- **Stat Modifiers** (when equipped)
- **Weapon Data** (for weapons)
- **Tags** (for categorization)

## Managing Inventory

- Click "Edit" on the inventory page to enter edit mode
- Search the item library to find items to add
- Set a quantity before adding (for bulk adds)
- Remove items with the trash icon
- Edit item names and descriptions inline

## Gold

Each crawler has their own gold balance. The total party gold is displayed at the top of the inventory page. In edit mode, you can adjust gold with +10/-10 buttons or type a specific amount.

## Sending Items Between Crawlers

From the Profiles page, you can send gold and items to other crawlers. Select a recipient, choose what to send, and confirm.

## Expandable Item Details

Click any item name in the inventory to expand its full details, including description, gold value, equipment slot, stat modifiers, weapon data, and tags.`,
  },
  {
    id: 'combat',
    slug: 'combat',
    title: 'Combat System',
    category: 'Game Mechanics',
    order: 13,
    content: `# Combat System

The combat system handles turn-based encounters with initiative, action tracking, and damage.

## Starting Combat

The DM starts combat from the game clock panel during Show Time. They select which crawlers and mobs participate. You can also add combatants mid-combat using the "Add to Combat" button.

## Initiative Phase

1. Each participant rolls for initiative (d20 + modifiers)
2. Mobs automatically roll their initiative
3. Crawlers must roll manually by clicking the "Roll Initiative" button on their profile
4. Once everyone has rolled, the DM clicks "Start Combat" to sort by initiative and begin

## Combat Phase

Combat proceeds in turn order (highest initiative first). On your turn:

- **Action**: Perform an attack, use an item, or take another action
- **Bonus Action**: Use an off-hand attack, dash, disengage, or hide
- The current combatant is highlighted in the combat order bar at the top of the map

The DM advances turns with the "Next Turn" button.

## Damage

When you attack a target:

1. Roll your attack dice to see if you hit
2. If the attack connects, select a target from the damage modal
3. Roll damage dice to determine how much damage you deal
4. Damage is applied to the target's HP automatically

Splash damage weapons can target multiple enemies at once.

## Health Tracking

Each combatant's HP is tracked independently during combat. For mobs that appear multiple times (like "Greg A" and "Greg B"), each instance has its own health pool. The DM can manually override any combatant's HP.

## Ending Combat

The DM can end combat at any time. When combat ends, mob health is saved back to the episode, so damage persists across combat encounters.`,
  },
  {
    id: 'episodes',
    slug: 'episodes',
    title: 'Episodes',
    category: 'DM Guide',
    order: 20,
    content: `# Episodes

Episodes are the building blocks of your game sessions. Each episode represents a scene or encounter with its own maps, mob placements, and settings.

## Creating an Episode

From the DM Console, go to the Episodes tab:

1. Give the episode a name and description
2. Select which maps to include (from the Maps page)
3. Place mobs on each map using the visual drag-and-drop editor
4. Configure fog of war settings per map
5. Set map scale for each map
6. Optionally attach loot box templates
7. Optionally attach quests

## Running an Episode (Show Time)

1. Go to Show Time and select your episode
2. Click "Play the Game" to make the episode visible to all players
3. Use the map tools to manage fog of war, place additional mobs/crawlers, and coordinate gameplay
4. Players see the map in real time with all updates synced instantly

## Map Management Within Episodes

Each map in an episode has independent settings:
- **Fog of War**: Separate fog state per map
- **Scale**: Independent zoom level per map
- **Mob Placements**: Mobs are placed on specific maps, not the episode as a whole
- **Crawler Placements**: Player character positions are per-map

## Ending an Episode

The DM can click "Game Over" to end the episode for all players, or "Back to Episodes" to return to the episode selection screen.`,
  },
  {
    id: 'maps',
    slug: 'maps',
    title: 'Maps',
    category: 'DM Guide',
    order: 21,
    content: `# Maps

Maps are the visual backdrop for your game sessions. They display during Show Time and serve as the surface for mob/crawler placement, fog of war, shapes, and pings.

## Uploading Maps

Maps are uploaded from the Maps page or the DM Console. Images are stored at full resolution (no compression) because maps need to look good at large zoom levels. The maximum image size is 15 MB.

## Map Names

Each map can have a custom name. Edit map names by clicking the edit icon next to the map label on the Maps page.

## Map Visibility

The DM can toggle visibility for each map on the Maps page. Hidden maps do not appear in episode map selectors for players.

## Map Scale

During Show Time, the DM can adjust each map's scale from the episode settings. Scale affects the physical size of the map image. At 200%, the map is twice as large, making icons appear relatively smaller. Scale syncs to all players in real time.

## Map Tools (Show Time)

During Show Time, the DM has access to map tools:

- **Fog of War**: Paint to reveal hidden areas; eraser to re-hide areas
- **Shapes/Highlight Boxes**: Add colored transparent boxes for annotations
- **Ping**: Click to send a colored ping visible to all players
- **Grid Overlay**: Toggle a grid on the map for positioning reference
- **Ruler**: Measure distance in feet between two points
- **Place Crawlers/Mobs**: Click to add characters to the map during gameplay`,
  },
  {
    id: 'fog-of-war',
    slug: 'fog-of-war',
    title: 'Fog of War',
    category: 'DM Guide',
    order: 22,
    content: `# Fog of War

Fog of War lets the DM hide portions of the map from players, revealing areas as the party explores.

## How It Works

- Fog covers the entire map with opaque darkness (players cannot see through it)
- The DM sees fog as semi-transparent, so they can still see what's underneath
- The DM paints to reveal areas using a circular brush
- Revealed areas sync to all players in real time
- Fog is per-map, meaning each map in an episode has its own fog state

## Controls

- **Enable/Disable**: Toggle fog of war on or off for the current map
- **Brush Size**: Adjust the reveal brush radius using the slider
- **Eraser Mode**: Toggle eraser to re-hide revealed areas
- **Reset**: Re-cover the entire map with fog

## Fog Persistence

Fog of war state (which areas are revealed) persists in Firebase. If you close and reopen the app, the fog state is preserved. Switching between maps in an episode also preserves each map's fog independently.`,
  },
  {
    id: 'mobs',
    slug: 'mobs',
    title: 'Mobs (Enemies & NPCs)',
    category: 'Basics',
    order: 2,
    content: `# Mobs (Enemies & NPCs)

Mobs are the enemies and non-player characters that populate your game world.

## Mob Types

| Type | Color | Purpose |
|------|-------|---------|
| Normal | Default | Standard enemies |
| Boss | Red accent | Powerful enemies |
| NPC | Blue accent | Non-hostile characters |

## Mob Properties

Each mob has:
- **Name** and **Description**
- **Level**
- **Hit Points** (optional, shown as health bar)
- **Image** (displayed on the map, compressed to ~800KB)
- **Strengths** and **Weaknesses** (can be hidden from players)
- **Default Inventory** (items the mob carries)
- **Default Gold**
- **Equipped Items** (items the mob has equipped, shown with a shield icon)

## Mob Visibility

The DM can choose to hide or show various mob details:
- **Hidden**: The mob doesn't appear to players at all
- **Hide HP**: Health bar is hidden from players
- **Hide Strengths/Weaknesses**: Stat details hidden until the DM reveals them

## Mob Management (DM Console)

From the DM Console Mobs tab, the DM can create, edit, and delete mobs. This includes setting up their inventory, equipping items via double-click or right-click context menu, and configuring their stats.

## Mobs on Maps

When placed on a map during episode setup or Show Time, mobs appear as circular icons. Each mob instance tracks its own HP independently, so duplicate mobs can take different amounts of damage.`,
  },
  {
    id: 'dice-roller',
    slug: 'dice-roller',
    title: 'Dice Roller',
    category: 'Features',
    order: 30,
    content: `# Dice Roller

The dice roller is always available in the bottom-right corner of the screen. It handles all dice rolls and displays roll history for all players.

## Rolling Dice

1. Click the "DICE" button to expand the roller
2. Click dice buttons (D4, D6, D8, D10, D12, D20, D100) to add them to the queue
3. Click "Roll X Dice" to roll everything in the queue
4. Results appear in the roll history

## Roll History

The roll history shows all dice rolls from all connected players, sorted chronologically. Each entry shows:
- The roller's name
- The roll type and result
- A timestamp
- An expand button to see individual die results

## Stat Rolls

When a crawler clicks a stat on their profile, it automatically rolls d20 + stat modifier and shows the result as a "Check" in the roll history.

## Weapon Attack Rolls

Weapon attacks show the specific dice being rolled (not just d20). The display shows:
- **Attack roll**: d20 (the hit check) with modifier
- **Damage**: The actual weapon dice (e.g., 2d12) with each die shown individually

## Synced Rolls

All dice rolls sync across all connected players in real time. When someone rolls dice on their device, everyone sees the result in their roll history.

## System Messages

The dice roller also shows system notifications like game start/stop events and loot box deliveries.`,
  },
  {
    id: 'loot-boxes',
    slug: 'loot-boxes',
    title: 'Loot Boxes',
    category: 'Game Mechanics',
    order: 14,
    content: `# Loot Boxes

Loot boxes are reward packages that the DM sends to crawlers during gameplay.

## Tiers

| Tier | Color | Rarity |
|------|-------|--------|
| Dirt | Brown | Common |
| Copper | Orange | Uncommon |
| Silver | Silver | Rare |
| Gold | Gold | Legendary |

## DM Workflow

1. **Create Templates**: In the DM Console, create loot box templates with a name, tier, items, and optional gold
2. **Send to Crawlers**: During Show Time, select a template and choose which crawlers receive it
3. **Unlock**: When ready, click "Unlock" on a sent loot box to let the crawler open it

## Player Workflow

1. **Notification**: A toast notification appears when you receive a loot box
2. **View**: Go to your profile page to see pending loot boxes
3. **Claim**: Once the DM unlocks the box, click "Claim" to add the items and gold to your inventory
4. **Claim All**: Use the "Claim All" button to instantly claim all unlocked loot boxes

## Loot Box History

Loot box sends appear in the dice roller history, so all players can see when loot is distributed.`,
  },
  {
    id: 'quests',
    slug: 'quests',
    title: 'Quests',
    category: 'Game Mechanics',
    order: 14.5,
    content: `# Quests

Quests are objectives the DM creates and assigns to crawlers. They have action items to complete, tiered rewards, and shared notes.

## Creating Quests (DM)

1. Go to the **DM Console** and click the **Quests** tab
2. Fill in the quest **name** and **description**
3. Add **action items** — tasks for crawlers to complete (hidden from players by default)
4. Add **item rewards** — search from the shared inventory library and assign a tier (Dirt/Copper/Silver/Gold)
5. Rewards are also hidden from players by default — toggle visibility with the eye icon
6. Click **Create Quest** to save

## Linking Quests to Episodes

When creating or editing an episode in the Episodes tab, you can select quests to include. This makes them available for assignment during Show Time.

## Assigning Quests (DM)

During Show Time, the Quest Panel appears in the map selector when the episode has quests linked:

1. Select a quest to assign
2. All crawlers are selected by default — deselect any who shouldn't receive it
3. Click **Assign** to give the quest to the selected crawlers
4. If all crawlers participate, it becomes a **Party Quest**
5. A notification appears in the dice roller and as a toast for players

## Managing Quests During Play (DM)

After assigning a quest, the DM can:

- **Toggle action item visibility**: Click the eye icon to reveal/hide action items for players
- **Mark action items complete**: Click crawler initials next to each action item to check them off
- **Toggle reward visibility**: Reveal rewards when appropriate

Each visibility toggle and completion sends a notification to the dice roller.

## Player Quest View

Players see their assigned quests on the **Quests** tab of their profile page:

- Expandable quest cards showing name, description, and Party Quest badge
- Visible action items with completion status (strikethrough when completed by the DM)
- Visible rewards with tier color — when all visible action items are completed and a reward is revealed, a **Claim** button appears to add the reward item to the crawler's inventory
- **Quest Notes**: A shared notepad where any crawler on the quest can add date-stamped text entries. Notes from other crawlers on the same quest are visible to everyone.

## Notifications

Quest events appear in the dice roller history:
- Quest assigned (with recipient names)
- Action item revealed
- Action item completed
- Reward revealed`,
  },
  {
    id: 'game-clock',
    slug: 'game-clock',
    title: 'Game Clock & Turns',
    category: 'Game Mechanics',
    order: 15,
    content: `# Game Clock & Turns

The game clock and turn system help track time passage during gameplay.

## Game Clock

The game clock displays the current in-game date and time. It appears in the game clock panel during Show Time. The DM can set the clock to any date/time, and it advances automatically during certain actions:

- **Short Rest**: Advances 4 hours
- **Long Rest**: Advances 8 hours
- **Noncombat Turn**: Advances 1 hour

The game clock is episode-dependent. Each episode can have its own starting time.

## Noncombat Turns

During exploration (outside of combat), the DM can track noncombat turns. Each turn:
- The turn counter increments
- The game clock advances 1 hour
- Each crawler gets a limited number of rolls per turn (default: 3)

The DM starts a new noncombat turn from the game clock panel.

## Combat Turns

During combat, the turn system switches to the combat order. Each combatant takes their turn in initiative order. Combat turns and rounds are tracked separately from noncombat turns.

## Rest Mechanics

| Rest Type | HP Recovery | Mana Recovery | Clock Advance |
|-----------|------------|---------------|---------------|
| Short Rest | 50% of max HP | 50% of max Mana | 4 hours |
| Long Rest | Full max HP | Full max Mana | 8 hours |

Rest healing uses effective stats (including equipment bonuses).`,
  },
  {
    id: 'show-time',
    slug: 'show-time',
    title: 'Show Time',
    category: 'Features',
    order: 31,
    content: `# Show Time

Show Time is the main gameplay view where the DM presents maps, mobs, and encounters to players in real time.

## For the DM

1. Select an episode from the episode list
2. Click "Play the Game" to broadcast the episode to all players
3. Use the map tools panel to manage fog, shapes, pings, and placements
4. Navigate between maps using the map selector
5. Manage combat, loot, and turns from the game clock panel
6. Click "Game Over" to end the session

## For Players

1. Navigate to Show Time
2. If the DM has started an episode, you will see the current map
3. If no episode is active, you will see a waiting screen
4. Interact with the map: click to ping, view mob details, see your position
5. Roll dice and perform actions from your profile page

## Map Interaction

- **Zoom**: Scroll to zoom in/out on the map
- **Pan**: The map scrolls naturally within its container
- **Ping**: Click on the map to send a colored ping visible to all players
- **Mob Cards**: Click on mob icons to see their details (strengths, weaknesses, HP)

## Real-Time Sync

Everything in Show Time syncs in real time:
- Map selection and transitions
- Mob and crawler positions (dragged by the DM)
- Fog of war reveals
- Combat state and turn order
- Pings and shape annotations
- Loot box distribution
- Quest assignments and progress`,
  },
  {
    id: 'sound-effects',
    slug: 'sound-effects',
    title: 'Sound Effects',
    category: 'Features',
    order: 32,
    content: `# Sound Effects

The sound effects system lets anyone play sounds that broadcast to all connected players.

## Finding Sounds

The Sounds page has a search bar powered by the Freesound API. Type a query (like "sword clash" or "thunder") to find sound effects. Results are cached for 10 minutes to prevent rate limiting.

## Playing Sounds

Click a sound result to play it. The sound plays for everyone connected to the same session. A stop button appears to halt playback.

## Sound Categories

- **Search Results**: Sounds found via the Freesound API search
- **Recent**: Recently played sounds for quick replay
- **Favorites**: Sounds you have bookmarked (coming soon)
- **Upload**: Upload your own sound files (coming soon)`,
  },
  {
    id: 'dm-console',
    slug: 'dm-console',
    title: 'DM Console',
    category: 'DM Guide',
    order: 23,
    content: `# DM Console

The DM Console is the command center for the Dungeon Master. It is only visible when logged in as the Dungeon AI.

## Tabs

### Mobs Tab
Create and manage mobs (enemies and NPCs). For each mob you can:
- Set name, description, level, and type (normal/boss/NPC)
- Upload an image (auto-compressed)
- Set hit points, strengths, and weaknesses
- Control what information is visible to players
- Manage the mob's default inventory and equipped items

### Episodes Tab
Create and manage game episodes. See the Episodes page for details.

### Maps Tab
Upload maps, set names, and manage map visibility.

### Loot Tab
Create loot box templates and manage the loot distribution system. See the Loot Boxes page for details.

### Quests Tab
Create and manage quests with action items, tiered rewards, and descriptions. Quests can be linked to episodes and assigned to crawlers during Show Time. See the Quests page for details.

### Settings
Configure the game clock, starting time, and other global settings.

## Episode Management

The DM Console provides a full visual editor for episodes, including drag-and-drop mob placement, per-map fog of war defaults, and scale configuration.`,
  },
  {
    id: 'multiplayer',
    slug: 'multiplayer',
    title: 'Real-Time Multiplayer',
    category: 'Features',
    order: 33,
    content: `# Real-Time Multiplayer

The app uses Firebase Firestore for real-time synchronization across all connected players.

## How It Works

Every change made by any player or the DM is instantly reflected on all other connected devices. This includes:

- Map selection and navigation
- Mob and crawler positions
- Dice rolls
- Combat state and turn order
- Fog of war reveals
- Item and gold changes
- Loot box distribution
- Sound effect playback
- Game clock and turn tracking

## No Account Required

The app uses anonymous Firebase authentication. No login, email, or password is needed. Just open the URL and select your character.

## Rooms

The app supports a room-based multiplayer system. All data is scoped to a room, so multiple groups can use the same deployment without interfering with each other.

## Persistence

All data is stored in Firebase Firestore and persists across sessions. Close the browser and come back later; your data is still there.`,
  },
  {
    id: 'wiki-guide',
    slug: 'wiki-guide',
    title: 'Editing the Wiki',
    category: 'Basics',
    order: 3,
    content: `# Editing the Wiki

This wiki is editable by anyone. If you spot something that is wrong, outdated, or missing, feel free to fix it!

## How to Edit

1. Navigate to any wiki page
2. Click the "Edit" button in the top-right area of the page content
3. Modify the content using Markdown formatting
4. Click "Save" to persist your changes

## Markdown Formatting

The wiki supports standard Markdown:

- **Bold**: \`**text**\`
- *Italic*: \`*text*\`
- Headers: \`# H1\`, \`## H2\`, \`### H3\`
- Lists: \`- item\` or \`1. item\`
- Tables: Standard Markdown table syntax
- Code: \`\\\`inline code\\\`\` or fenced code blocks
- Links: \`[text](url)\`

## Content Guidelines

- Keep information accurate and up to date
- Write in a clear, conversational tone
- Focus on what players and DMs need to know
- Include examples where they help clarify a concept`,
  },
  {
    id: 'accounts',
    slug: 'accounts',
    title: 'Accounts & Sign-In',
    category: 'Basics',
    order: 4,
    content: `# Accounts & Sign-In

The app supports user accounts to control who can make changes to the game data.

## How It Works

- **Anonymous users** (not signed in) can browse the app and view all data — maps, profiles, mobs, episodes, etc. — but they **cannot** make any changes.
- **Signed-in users** (via Google or email/password) can read and write: edit profiles, manage inventory, roll dice, run combat, and use all DM features.

This means anyone can visit the site and spectate, but only users with an account can modify game data.

## Creating an Account

1. Click the **Sign In** button — it appears in the top-right on the Splash Screen and Main Menu, or in the navigation bar during gameplay.
2. In the auth modal, click the **CREATE ACCOUNT** tab.
3. Fill in your display name (optional), email address, and a password (at least 6 characters).
4. Click **Create Account**. You're now signed in!

Alternatively, click **Continue with Google** to create an account using your Google account — no password needed.

## Signing In

1. Click the **Sign In** button.
2. Enter your email and password, or click **Continue with Google**.
3. Once signed in, your name appears next to the button, which changes to **Sign Out**.

## Signing Out

Click **Sign Out** to revert to anonymous (read-only) mode. You can sign back in at any time.

## For the DM

Account sign-in is separate from the DM password. To access the DM Console, you still need to enter the DM password as before. However, you must also be signed in with an account to make any writes (creating episodes, placing mobs, sending loot, etc.).`,
  },
];
