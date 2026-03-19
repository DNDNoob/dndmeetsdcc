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

## Landing Page

When you first visit the site, you'll see the **Landing Page** — a cinematic overview of what the app offers, including living maps, real-time combat, character management, and more. Click **Enter the Dungeon** to sign in or create an account.

## Sign In & Set Up Your Profile

An account is **required** to access any game features. Anonymous browsing of the app is not available — you must sign in first.

1. **Sign in** using Google or email/password (click "Enter the Dungeon" on the landing page).
2. **Choose a username** and display name when prompted (first time only).
3. You'll be taken to the **Campaign Selection** screen.

## Campaigns

All game data is organized into **campaigns**. A campaign is an isolated game world with its own crawlers, mobs, maps, episodes, and more.

- **Create a Campaign** to become the DM (Dungeon Master).
- **Join a Campaign** using an invite code or link shared by the DM.
- Each campaign supports up to 10 players.

See the [Campaigns](/wiki/campaigns) page for full details.

## Choosing Your Identity

After selecting a campaign, you'll see a splash screen where you pick who you are. Select any available crawler (player character), or choose "Just a Boring NPC" to spectate. The DM is automatically logged in as "Dungeon AI" when entering their own campaign.

You can switch your identity at any time by clicking the player name in the top-right corner.

## The DM (Dungeon AI)

The user who creates a campaign is automatically the DM. The DM has full access to the DM Console and all admin-only controls. No password is needed — campaign ownership determines DM access.

The DM can also play as a crawler by switching their identity in the player dropdown.

## Navigation

The navigation bar at the top of the screen gives you quick access to all sections:

- **Main Menu** - The hub page with navigation cards
- **Profiles** - View and manage crawler character sheets
- **Maps** - Browse uploaded maps
- **Inventory** - Manage items, equipment, and gold
- **Mobs** - View enemies and NPCs
- **Show Time** - The live game presentation view
- **Sounds** - Play sound effects
- **Wiki** - Game documentation
- **DM Console** - Admin panel (DM only)

On mobile devices, the navigation collapses into a **hamburger menu** (☰) — tap it to access all sections from a dropdown.

Use the **Campaigns** button to return to the campaign list at any time.`,
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

Click any item name in the inventory to expand its full details, including description, gold value, equipment slot, stat modifiers, weapon data, and tags.

## Creator Attribution

Every item in the shared library shows who created it. The creator's username appears as a small badge on the item card. This helps the DM and players know the origin of each item.

## Public & Private Items

Library items are **private by default** — they are only visible within your campaign. You can toggle an item public to share it with the broader community:

- Click the **globe icon** on any item you created to make it public
- Click the **lock icon** to revert it to private
- Only the item's creator can toggle its visibility

Public items appear in the **Community Items** section for any player who has enabled public content in their account settings.

## Community Items

If you have **Show Public Content** enabled in your account settings, a "Community Items" section appears above the crawler inventories. It lists public items shared by other players across all campaigns.

- DMs can click **+** on a community item to copy it into their local item library
- Copied items start as private and belong to the DM who imported them`,
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

The dice roller also shows system notifications like game start/stop events and loot box deliveries.

## Closing the Dice Roller (Mobile)

On mobile, tap the **✕** button in the top-right corner of the dice roller panel to collapse it. This keeps the interface clean when you no longer need the roller visible.`,
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

The app requires user accounts for all game interactions. Your account is how the system knows who you are and what campaigns you belong to.

## How It Works

- **All users must sign in** before accessing the app. The landing page at the site root introduces the app and prompts you to create an account or sign in.
- **Signed-in users** (via Google or email/password) can create campaigns, join campaigns, and interact with all game features.
- If you sign out, you'll be redirected back to the landing page.

## Creating an Account

1. Click **Enter the Dungeon** on the landing page, or click **Sign In** if you see it.
2. Click **CREATE ACCOUNT** and fill in your email and password (at least 6 characters).
3. Alternatively, click **Continue with Google** for one-click account creation.
4. On first sign-in, you'll be prompted to choose a **username** (unique, 3-24 characters, letters/numbers/underscores) and **display name**.

## Signing In

1. Click **Sign In** and enter your email/password, or use Google.
2. After sign-in, you'll see the Campaign Selection screen.

## Signing Out

Click **Sign Out** to sign out. You can sign back in at any time.

## User Profile

Your profile includes:
- **Username** — unique identifier, used for lookups
- **Display Name** — shown in campaigns and as the DM name
- **Avatar** — pulled from your Google account if applicable

## Account Settings

Click the **⚙ Account Settings** section on the Campaign Select screen to manage your preferences.

### Show Public Content

Toggle **Show Public Content** to opt in to seeing items and spells shared publicly by other players:

- **Off (default)** — you only see your own campaign's content
- **On** — a "Community Items" section appears in Inventory and a "Community Spells" section appears in Spells, showing publicly shared content from all players

When you enable this setting, an **age warning** is displayed reminding you that public content is user-generated and may not be suitable for all ages. You must acknowledge this warning to continue.

You can disable public content at any time from Account Settings. Your toggle decisions are recorded in your Decision History.

## Decision History

Inside Account Settings, the **Decision History** panel shows a log of significant account-level decisions you have made (e.g., enabling or disabling public content). Each entry shows:

- The action taken
- A human-readable label
- The date and time`,
  },
  {
    id: 'campaigns',
    slug: 'campaigns',
    title: 'Campaigns',
    category: 'Basics',
    order: 5,
    content: `# Campaigns

Campaigns are the foundation of the game. Each campaign is an isolated game world with its own crawlers, mobs, maps, episodes, quests, and more. All game data is scoped to a campaign — nothing leaks between campaigns.

## Creating a Campaign

1. From the Campaign Selection screen, click **New Campaign**.
2. Enter a name and optional description.
3. Click **Create Campaign**. You are now the DM (Dungeon Master) of this campaign.

As the DM, you have full access to the DM Console, mob creation, episode management, combat controls, and all admin features.

## Joining a Campaign

Players join campaigns via **invite codes** or **invite links**.

1. The DM shares the invite link (e.g., \`https://yoursite.com/join/abc123\`) or the invite code.
2. Click the link, or go to the Campaign Selection screen and click **Join Campaign**, then paste the invite code.
3. You'll be added to the campaign's member list.

## Player Limit

Each campaign supports up to **10 players** (including the DM if they play as a crawler).

## DM Access

- The user who **creates** a campaign is the DM.
- The DM has access to the DM Console, mob management, episode control, combat admin, loot distribution, and all admin-only features.
- Players see player-only views (Profiles, Maps, Inventory, Mobs, Show Time, Sounds, Wiki).
- The DM can also play as a crawler by switching their identity in the player dropdown.

## Copying a Campaign

DMs can **copy** a campaign to create a duplicate with the same mobs, maps, episodes, quests, and wiki content. This is useful for:
- Running the same adventure with a different group
- Creating a backup before making major changes
- Reusing content across campaigns

The copy includes mobs, maps, episodes, loot box templates, quests, and wiki pages. Transient data like combat state, dice rolls, and assigned quests are not copied.

## Deleting a Campaign

DMs can delete a campaign, which permanently removes all room-scoped game data (episodes, mob placements, crawler placements, maps, etc.). This action cannot be undone.

## Leaving a Campaign

Players can leave a campaign at any time from the Campaign Selection screen. The DM cannot leave their own campaign — they must delete it instead.

## Invite Code Management

- DMs can copy the invite link to share with players.
- DMs can **regenerate** the invite code if needed (e.g., if an old code was leaked).
- Regenerating the code invalidates the old one.

## Switching Campaigns

Click the **Campaigns** button (or back arrow) in the navigation bar, Main Menu, or Splash Screen to return to the Campaign Selection screen and switch campaigns.`,
  },
  {
    id: 'spells',
    slug: 'spells',
    title: 'Spell System',
    category: 'Game Mechanics',
    order: 50,
    content: `# Spell System

Crawlers can learn and cast spells. Each spell consumes **mana** when cast and belongs to a **spell school** (Evocation, Necromancy, Illusion, etc.).

## Learning Spells

Spells can be learned in several ways:

| Source | How |
|--------|-----|
| **Spell Tome** | Consume a Spell Tome item from your inventory — the tome is destroyed and you learn the spell |
| **Granted** | A DM grants the spell directly from the Spells page |
| **Quest** | Awarded as a quest reward |
| **Level Up** | Granted by the DM when leveling up |
| **Race / Class** | Innate spells from your race or class (set during character creation) |

A crawler cannot learn the same spell twice.

## Casting Spells

Each spell costs **mana** to cast. Spells are cast using either an **Action** or **Bonus Action** depending on how the spell was designed.

Spells can optionally:
- Target a single enemy, multiple targets, an area, or the caster themselves
- Deal damage of a specific type (Fire, Poison, Healing, etc.)
- Apply effects lasting for a set number of **combat turns** or **noncombat turns**
- Require a saving throw from the target
- Have a splash damage effect (hits multiple enemies)

## Spell Mastery

Every time a crawler casts a spell, their **cast count** increases. Reaching cast count thresholds levels up the spell, reducing its mana cost:

| Mastery Level | Cast Count Required | Mana Discount |
|---------------|---------------------|---------------|
| 1 | 10 | −5% of base |
| 2 | 30 | −10% of base |
| 3 | 60 | −15% of base |
| 4 | 100 | −20% of base |

The reduction per level is **ceil(base cost × 5%)**, stacked per mastery level. Mana cost never goes below 0.

## Spell Tomes

Spell Tomes are consumable inventory items. When a crawler **Uses** a tome:
1. The tome is removed from their inventory
2. They learn the spell contained in the tome

Tomes can contain either a **library spell** (selected from the shared spell library) or a **custom spell** (designed specifically for that tome). DMs can promote a custom spell to the shared library from the Spells page.

## Spell Library

The **Spells page** (accessible from the navigation bar) shows:
- **Left panel**: The shared spell library — DMs can create, edit, and delete reusable spells
- **Right panel**: Per-crawler known spells, cast counts, mastery levels, and an effective mana cost display

DMs can also grant any library spell directly to a specific crawler from the library panel.

## Spell Data Fields

Each spell has the following configurable properties:

| Field | Description |
|-------|-------------|
| Mana Cost | Mana consumed per cast (0 = free) |
| Spell Level | D&D-style level 1–9 |
| School | Evocation, Necromancy, Illusion, etc. |
| Action Type | Action, Bonus Action, or **Reaction** |
| Range | Feet, Self, or Touch |
| Target | Single, Area, Self, or Multiple |
| Area of Effect | Shape (sphere/cone/line/cube) and size in feet |
| Damage Dice | One or more dice (e.g., 2d6 + 1d4) |
| Damage Type | Fire, Poison, Healing, Spiritual, etc. |
| Hit Die | Bonus die added to the spell attack roll |
| Hit Modifiers | Stat bonuses applied to hit roll (STR/DEX/CON/INT/CHA) |
| Damage Modifiers | Stat bonuses applied to damage roll |
| Duration | Combat turns, noncombat turns, or a custom label |
| Saving Throw | Which stat the target rolls to resist |
| Splash Damage | Whether the spell can hit multiple targets |
| Special Effect | Free-text description of any on-hit effects |
| Can Target Self | Whether the caster can target themselves |
| Reaction Trigger | *(Reaction spells only)* What event triggers the reaction, e.g. "When you are hit by an attack" |

## Reaction Spells

Spells with **Action Type: Reaction** are cast in response to a specific trigger event outside your turn. When creating a reaction spell, fill in the **Reaction Trigger** field to describe exactly when it can be used. The trigger is displayed on the spell card so players know when to declare it.

Examples of reaction triggers:
- "When you are hit by an attack"
- "When an ally within 30 ft takes damage"
- "When you fail a saving throw"

## Sharing Spells

Authenticated players can **share spells publicly** so other players across all campaigns can discover and use them.

- **Creator attribution**: every spell shows who created it ("by username")
- **Privacy toggle**: if you created a spell, a **globe/lock** button appears when the spell is expanded — click it to make it public or private. Spells are **private by default**.
- **Community Spells**: if you have [Public Content](/wiki/public-content) enabled in Account Settings, a **Community Spells** panel appears at the bottom of the Spell Library showing public spells from other players. DMs can add any community spell to their campaign library with the **+** button.`,
  },
  {
    id: 'public-content',
    slug: 'public-content',
    title: 'Public Content & Sharing',
    category: 'Accounts',
    order: 6,
    content: `# Public Content & Sharing

Players can share inventory items and spells publicly so other players across all campaigns can discover and use them. This system is opt-in — public content is disabled by default.

## Privacy Model

All content (shared library items and spells) is **private by default**. This means:

- Items and spells you create are only visible within your own campaigns.
- Other players cannot see your content unless you explicitly make it public.

## Making Content Public

Every item in the Item Library and every spell in the Spell Library that you created has a **globe/lock toggle badge**:

- 🔒 **Private** (default) — only visible within your campaign
- 🌐 **Public** — visible to all players who have opted in to public content

Click the badge to toggle. The change takes effect immediately.

> Items created by others show a read-only attribution badge ("by username") so you know who made them.

## Enabling Public Content

To see content shared by other players:

1. Go to the **Campaign Selection** screen.
2. Open **Account Settings** (bottom of the page).
3. Toggle **Show Public Content** on.
4. Confirm the **age warning** — community content is user-generated and has not been moderated.

Once enabled:
- A **Community Items** section appears in the Inventory page's Item Library.
- A **Community Spells** panel appears in the Spell Library.

These sections show public content from all other players. DMs can copy community items/spells into their campaign library with the **+** button.

## Disabling Public Content

Toggle **Show Public Content** off in Account Settings at any time. The Community Items and Community Spells sections will immediately disappear.

## Decision History

Every time you change a privacy-related setting (like enabling or disabling public content), the action is recorded in your **Decision History**. To view it:

1. Open **Account Settings** in Campaign Select.
2. Click **Decision History** to expand the log.

Each entry shows:
- What changed (e.g. "Enabled public content")
- The old and new value
- A timestamp

This gives you a complete personal record of when you opted in or out of public content.

## Age Warning

When enabling public content, you will see a one-time warning:

> *Public content is created by other players and may not be suitable for all ages. Items and spells shared publicly have not been reviewed or moderated.*

You must confirm before the toggle activates. This confirmation is recorded in your Decision History.`,
  },
];
