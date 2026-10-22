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

1. **Sign in** with Google (click "Enter the Dungeon" on the landing page).
2. **Choose a username** and display name when prompted (first time only).
3. You'll be taken to the **Campaign Selection** screen.

## Campaigns

All game data is organized into **campaigns**. A campaign is an isolated game world with its own crawlers, mobs, maps, episodes, and more.

- **Create a Campaign** to become the DM (Dungeon Master).
- **Join a Campaign** using an invite code or link shared by the DM.
- Each campaign supports up to 10 players.

See the [Campaigns](/wiki/campaigns) page for full details.

## Choosing Your Identity

After selecting a campaign, you'll see a splash screen where you pick who you are. Select any available crawler (player character), or choose "Just a Boring NPC" to spectate. The DM is automatically logged in as "Dungeon AI" when entering their own campaign. Only the campaign's DM can pick **Dungeon AI (DM Access)**; players never see that option.

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

In **Show Time**, the navigation bar hides to give the map more room. Rest your mouse at the top-left edge of the screen for a moment to bring it back, or pin it open. Moving across the top of the screen on your way to the map tools won't pop it open.

Use the **Campaigns** button to return to the campaign list at any time.`,
  },
  {
    id: 'crawlers',
    slug: 'crawlers',
    title: 'Crawlers (Player Characters)',
    category: 'Basics',
    order: 1,
    content: `# Crawlers (Player Characters)

Crawlers are the player characters in the game. Each crawler has a name, race, job (class), level, and a set of core stats.

## Creating a Crawler

Tap **New** next to the crawler picker on the Profiles page. The character creator walks you through it one step at a time:

1. **Name**
2. **Backstory**, five questions. Pick one of the suggestions or write your own answer:
   - **Profession**: what you did for a living (bug exterminator, used car salesman)
   - **Accomplishment**: something small and real. "3rd place at state in the 400m" is fine, "Olympic gold" is not
   - **Hobby**: what you did for fun
   - **Where you were when the world ended**
   - **The most important person, thing or animal in the world to you**
3. **Ability points**: spend 10 points (2 per ability) however you like, up to 5 in one ability. Each point adds +1 to that ability's rolls. An ability left at **0 points rolls with disadvantage** (two d20s, take the lower), and shows **DIS** next to it on your profile.
4. **Languages**: everyone speaks Worldspeech, plus 2 more you pick. Mindspeech, Beast, Plant and Dead can't be picked at the start; they need a gift or a spell.
5. **Review**, then **Create crawler**.

Every new crawler starts as a **Human** with **no class**, at Level 1 with **25 HP**, **3 mana** and **0 gold**. Race and class change later, when the DM decides. Starting items are set up by the DM.

Your answers appear in the **Backstory** section of your profile. Tap **Edit** to change them at any time; the DM may ask you to tone down an answer.

> **New campaigns:** until you create or save a crawler, a brand-new campaign shows the sample crawlers (Carl and Princess Donut). Editing and saving a sample crawler saves it to your campaign as a real crawler.

## Stats

Every crawler has these core attributes:

| Stat | Abbreviation | What It Does |
|------|-------------|--------------|
| Strength | STR | Physical power, melee attacks |
| Dexterity | DEX | Agility, ranged attacks, dodging |
| Constitution | CON | Toughness, health pool |
| Intelligence | INT | Knowledge, magic power |
| Charisma | CHA | Social skills, some special abilities |

Stats start at a base value and can be modified by equipped items. For crawlers made with the character creator, each ability point is worth 2 stat points (0 points = 10, 5 points = 20), so the modifier equals the points. The modifier for any stat is calculated as: **(stat - 10) / 2**, rounded down. For example, a STR of 14 gives a +2 modifier.

## Health and Mana

- **HP** (Hit Points): Your health pool. When it drops to 0, you are incapacitated.
- **Mana**: Your magic or special ability resource. Used for certain actions.

Both HP and Mana have maximum values that can be boosted by equipment.

## Stat Rolls

Click on any stat value on your profile page to roll a d20 plus your stat modifier. The result appears in the dice roller panel. This is used for ability checks during gameplay.

## Equipment

Crawlers can equip items in the following slots: Head, Chest, Legs, Feet, Left Hand, Right Hand, Ring Finger, and Weapon. Equipped items modify your stats and appear on your character sheet. See the Equipment page for more details.

## Activity and Trophies

Your profile shows the 5 activity stats where you stand out most, and the **Stats** tab lists them all. It also shows trophies the DM awards you. See [Activity Stats & Trophies](/wiki/activity-trophies).

## Avatars

You can upload a profile image (avatar) for your crawler. Images are automatically compressed to keep things fast. Avatars appear on map icons and in the navigation dropdown.`,
  },
  {
    id: 'activity-trophies',
    slug: 'activity-trophies',
    title: 'Activity Stats & Trophies',
    category: 'Basics',
    order: 1.5,
    content: `# Activity Stats & Trophies

Every crawler's profile has an **Activity** section and a **Trophies** section.

## Activity Stats

To keep the profile tidy, the **Activity** section shows only 5 stats: the ones where this crawler is furthest above the party's average, so a healer with few kills shows what they're good at instead. Stats still at 0 come last. Click **All stats**, or open the **Stats** tab, to see every stat, where the crawler ranks in the party, and their Looting level.

These are tracked automatically as you play:

| Stat | What counts |
|------|-------------|
| Feet Moved | Feet you move your own crawler on the map, in or out of combat (the DM moving your token doesn't count) |
| Damage Dealt | HP removed from targets by your attacks |
| Killing Blows | Attacks that bring a mob to 0 HP |
| Fight Finishers | Killing blows that take down the last mob standing in a combat |
| HP Lost | Hit points you lose to attacks and other damage. Changing HP while editing your profile (for example when setting up a new crawler) doesn't count |
| Near Death | Times your HP drops below 10% of your max HP |
| Mobs Looted | Defeated mobs whose loot you shared in (raises your Looting level) |
| Spells Cast | Casts of all your known spells added together |
| Merchant Trades | Buys and sells with merchants (raises Barter) |
| Boss Kills | Killing blows on boss mobs |
| Healing Done | HP you restore to crawlers with healing spells |
| Natural 20s | d20 rolls that came up 20 |
| Friendly Fire | Damage you deal to other crawlers |
| Damage to Neutrals | Damage you deal to mobs that aren't hostile, NPCs included |

## The Stats Tab

The **Stats** tab (chart icon) shows every stat above, where the crawler ranks in the party, and their Looting level. Below that it breaks things down further:

- **Weapons and spells**: for each weapon, attack or spell you've used, the attacks or casts, hits, damage, kills, boss kills, best single hit, healing, effects left on targets, friendly fire and damage to neutrals.
- **Combat**: healing received, neutral kills, the damage type you deal most, and the mobs you've killed most.
- **Standout moments**: your last 10 big moments, like boss kills, final blows, natural 20s on attacks, bringing a crawler back from 0 HP, finished quests, won haggles and level-ups.
- **Fighting style**: fights survived, rounds fought, times knocked to 0 HP, average feet moved per combat turn, and turns where you did nothing.
- **Talking and trading**: lines said to NPCs, Persuasion rolls, haggles won, lines translated for the party, gold earned (loot, loot boxes, selling) and spent, items bought and sold, and gear swaps.
- **Progress**: quests finished, noncombat rolls and loot boxes opened by tier.
- **Habits**: your average combat turn time, turns undone, and voice versus typed chat lines.
- **Dice**: d20 rolls, your average d20 (10.5 is average luck), natural 1s, rolls with disadvantage, checks passed, and how often you roll each ability.

### Play Style (DM only)

The DM also sees **Play Style** tags at the top of the Stats tab, worked out by comparing the crawler with the rest of the party. Hover a tag to see its rule.

| Tag | When it shows |
|-----|---------------|
| Striker | Deals at least a quarter more damage than the party average |
| Finisher | Lands at least a quarter more killing blows than the party average |
| Tank | Takes at least a quarter more damage than average and survives most fights |
| Healer | Healing is over a quarter of their damage |
| Skirmisher | Moves at least a quarter more per combat turn than average |
| Sharpshooter | Over half their weapon attacks use ranged weapons |
| Talker | Talks to NPCs and rolls Persuasion at least a quarter more than average |
| Reckless | Drops near death or to 0 HP at least a quarter more often than average |
| Hoarder / Spender | Has spent under a quarter / over three quarters of the 50+ gold they earned |
| Lucky / Cursed | Averages 12+ / 9 or less on 10+ d20 rolls |
| Loose cannon | 10+ damage, or 5% of their damage, dealt to other crawlers |
| Troublemaker | Killed a neutral mob or NPC, or dealt them 10+ damage |

Players don't see their tags, so the Dungeon AI's choices stay a surprise. **Copy AI profile** copies the short summary of the crawler that AI prompts (like weapon upgrade trees) are given.

These counters started on 2026-10-21, so play before then isn't included. When a combat turn is undone, its counters go back too.

Your **Speed** (feet per combat turn) is shown next to the Activity heading. See [Combat System](/wiki/combat) for how movement works in combat.

## Trophies

Trophies are for things that can't be measured automatically, like great roleplay, a clever plan or a heroic save. Only the DM can award them.

- On a crawler's profile, the DM enters a trophy name and an optional note, then clicks **Award Trophy**.
- Awarding a trophy with the same name again counts it up, for example *Best Roleplay ×3*.
- The **−** button next to a trophy takes back one award, and removes the trophy when its count reaches zero.

## Automatic Trophy: This Is For You, Bud, No Child Left Behind

Nobody gets left behind. If exactly one crawler in the campaign is slower than everyone else, their speed is automatically raised to match the second slowest crawler, and they earn the **This Is For You, Bud, No Child Left Behind** trophy.

- Speed here means the crawler's speed after equipment bonuses.
- If two or more crawlers are tied for slowest, nothing happens.
- It only runs while a game is being played (after the DM clicks **Play the Game** in Show Time), so the DM can set up crawlers with any speed beforehand.
- It happens again any time a single crawler becomes the slowest during a game. The trophy is awarded once per crawler.
- It runs while the DM has the campaign open.`,
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

A stat the weapon uses adds that ability's modifier, counting gear bonuses, the same as any other roll. For example, a sword that uses STR adds +2 for a crawler with STR 14.

## Advantage and Disadvantage

Right-click an equipped weapon to roll with advantage (2d20, take highest) or disadvantage (2d20, take lowest). This affects only the attack roll, not damage.

## Weapon Upgrades

Right-click a weapon in your inventory (or expand it and tap **Upgrade**) to upgrade it. The upgrade window edits everything about the weapon: its name, description, stat bonuses while equipped, dice, damage and weapon type, range, splash and special effects. Only that crawler's copy changes.

When you save a change, the weapon gets **Upgraded** after its name in gold. Saving without changing anything leaves the weapon as it was. Upgraded weapons don't stack with plain copies and are not affected by changes to the original item in the DM's library.

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
- **Rarity**: Common, Uncommon, Rare, Epic or Legendary, shown as a colored tag next to the item's name
- **Effects**: what the item does, in plain words (for example "Glows near goblins"). It shows on the item when you expand it
- **Equipment Slot** (if equippable)
- **Gold Value**
- **Stat Modifiers** (when equipped)
- **Weapon Data** (for weapons)
- **Tags** (for categorization)

## Item Rarity

| Rarity | Color |
|--------|-------|
| Common | Gray |
| Uncommon | Green |
| Rare | Blue |
| Epic | Purple |
| Legendary | Orange |

The Item Library can be filtered by rarity with the **All Rarities** menu next to the slot filter. Rarity is optional; items without one show no tag. Rarity and effects can also be set on items in **My Content**.

## Managing Inventory

- Click "Edit" on the inventory page to enter edit mode
- Search the item library to find items to add
- Set a quantity before adding (for bulk adds)
- Remove items with the trash icon
- Edit item names and descriptions inline

## Item Stacks

Copies of the same item always stack. A crawler carrying three Health Potions sees one **Health Potion x3** row in their inventory, in the Show Time inventory panel, in loot boxes, in a merchant's sell list and in a mob's item list. Two items count as copies when their name, description, equipment slot, gold value and stat modifiers all match. Removing or selling takes one copy off the stack.

## Gold

Each crawler has their own gold balance. The total party gold is displayed at the top of the inventory page. In edit mode, you can adjust gold with +10/-10 buttons or type a specific amount.

## Sending Items Between Crawlers

From the Profiles page, you can send gold and items to other crawlers. Select a recipient, choose what to send, and confirm.

## Expandable Item Details

Click any item name in the inventory to expand its full details, including description, gold value, equipment slot, stat modifiers, weapon data, and tags.

## Creator Attribution

Any member of a campaign can add items to its library. Several people can add or edit library items at the same time: each save only changes the item that person touched, so nobody's new item gets wiped out by someone else's save.

Everything you create (items, spells, maps, mobs, episodes, quests and loot boxes) is linked to your profile.

## My Content (personal items and spells)

Content you want to keep for yourself, outside any one campaign, goes in **My Content**. It is linked to your profile only and only you can see it.

- Open **My Content** on the campaign list screen to create, edit or delete personal items (name, description, equipment slot and gold value).
- In a campaign, items and spells you made have a **Mine** button. Click it to save a copy to My Content, with all its stats, weapon details and spell data. Clicking it again updates that copy.
- In a campaign, the Inventory page shows **My Items**. Click **+** to add one to the campaign's item library. On the Spells page the DM sees **My Spells** and can add them the same way.
- Deleting something from My Content never removes copies already added to a campaign.

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
    id: 'mob-loot',
    slug: 'mob-loot',
    title: 'Mob Loot & Party Inventory',
    category: 'Game Mechanics',
    order: 13,
    content: `# Mob Loot & Party Inventory

When a hostile mob goes down in combat, its items and gold are looted automatically. Nobody has to hand anything out.

## What a Mob Drops

A mob drops the items and gold set on it in the DM Console. If the DM gave that mob a different inventory or gold amount for this episode (in the map's mob placement editor), those are used instead.

Friendly mobs keep their things when they go down, because the crawlers weren't fighting them.

## Who Gets What

Loot is shared by every crawler in the combat's initiative list, including anyone who is knocked out.

- **Gold** is split evenly. Leftover coins go one each to crawlers in initiative order. (10 gold between 3 crawlers is 4, 3 and 3.)
- **Items the mob carries more than one copy of**, like potions, are dealt out evenly. Copies that can't be split evenly go to the party inventory. (4 potions between 3 crawlers is 1 each, plus 1 for the party.)
- **Single items**, like a mob's one dagger, go to the party inventory.

## Smashed Loot

Looting is rough work, and some loot gets smashed. Each coin and each copy of a stackable item (anything the mob carries more than one of) rolls a chance to be destroyed instead of looted. Single items, like a mob's one dagger, are never smashed.

- The chance is **25%** by default. The DM can change it for each mob with **Smash chance** in the DM Console, next to the mob's gold.
- Each crawler's share rolls against their own Looting level. Leftovers headed for the party inventory roll against the best looter in the fight.
- The **Looted** line in the dice history lists what was smashed.

## Looting Level

Every mob a crawler helps loot counts toward their **Looting level**, shown on the **Stats** tab of their profile with how many more mobs they need for the next level.

| Level | Mobs looted | Loot smashed |
|-------|-------------|--------------|
| 0 | 0 | normal rate |
| 1 | 10 | 10% less often |
| 2 | 30 | 20% less often |
| 3 | 60 | 30% less often |
| 4 | 100 | 40% less often |
| 5 | 150 | half as often |
| 10 | 550 | never |

Each level cuts the chance by a tenth, so with a 25% smash chance a level 5 looter only loses about 12%. A toast celebrates each level-up.

## When It Happens

Loot drops the moment the mob's HP reaches 0, whether from an attack or from the DM setting its HP. A mob is only looted once: healing it and bringing it down again doesn't drop anything more, and its body stays empty in later fights in that episode.

Every kill posts a **Looted** line to the dice history showing what each crawler got, what was smashed and what went to the party.

## Party Inventory

The party inventory holds looted items nobody has claimed yet. It appears on the Profiles page under the inventory summary whenever it has something in it.

- Click **Take** to move one copy into the crawler you're viewing, or **All** to take the whole stack.
- If two players click Take on the last copy at the same time, only one gets it.
- The DM can take items for any crawler, and can discard items with the trash icon.`,
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

Every mob placed in the episode can join combat, including mobs the party hasn't encountered yet. Unencountered mobs are tagged *unencountered* in the setup list and have a **Reveal** button. Players see every combatant in the turn order either way.

The setup list ticks the hostile mobs on the map you're on. Mobs on the episode's other maps are listed with an *other map* tag but left unticked, so a boss in the next room isn't pulled into the fight by accident. Tick them yourself if they should join.

## Initiative Phase

1. Each participant rolls for initiative (d20 + modifiers)
2. Mobs automatically roll their initiative
3. Crawlers must roll manually by clicking the "Roll Initiative" button on their profile
4. If someone is away or taking too long, the DM can click "Force Initiative Roll" in the Show Time panel to roll d20 + DEX modifier for everyone still waiting
5. Once everyone has rolled, the DM clicks "Start Combat" to sort by initiative and begin

## Combat Phase

Combat proceeds in turn order (highest initiative first). On your turn:

- **Action**: Perform an attack, use an item, or take another action
- **Bonus Action**: Use an off-hand attack, dash, disengage, or hide
- The current combatant is highlighted in the combat order bar at the top of the map

The DM advances turns with the "Next Turn" button. Mobs at 0 HP are skipped, so dead mobs don't get turns.

## Mob Turns (DM)

During combat the DM sees a **mob actions panel** in the top left of the Show Time map. It follows the turn order: when a mob's turn comes up, the panel shows everything that mob can do:

- **Attacks** set up for it in the mob creator (claws, bites, tail swipes)
- **Weapons** it has equipped from its default inventory
- **Spells** picked for it from the spell library

Tap one to roll it. The to-hit roll (d20 plus the attack's bonus) goes to the dice log under the mob's name in red, so every player sees it. Mobs the party hasn't met show as **???**. Then pick the target (each crawler shows their HP and CON), tap **Roll damage**, and the target's health goes down on its own. Tap **Missed** if the attack didn't land. Splash weapons and area spells let you pick several targets. Healing spells skip the to-hit roll and heal the target instead.

Mobs follow the same rules as crawlers: one action and one bonus action on their turn, and only reactions when it isn't their turn. The panel crosses out the action and bonus action once they're used. To use a mob's reaction on someone else's turn, pick the mob from the menu at the top of the panel. Tap the arrow to fold the panel out of the way.

## Undo Turn

Moved your token by accident or clicked the wrong action? Press **Undo Turn** during your own turn. It shows at the top of your crawler profile and in the combat section of the game clock panel. Tap it, then tap **Tap again to undo** to confirm.

Undoing puts everything back to how it was when your turn started:

- Your token goes back to where it stood
- Your movement, action and bonus action are refilled
- HP changes from damage or healing this turn are reversed, for crawlers and mobs
- Mana spent and spell casts this turn are given back

Every undo adds a "reset their turn" line to the dice log so the table can see it. Rolls you already made stay in the log. Only the player whose turn it is (or the DM) can undo, and only until the turn passes. Things outside the fight, like items traded or quests updated, are not undone.

## Movement

Each crawler has a **movement speed**: how many feet they can move per combat turn. It starts at **60 ft**. Equipment with a Speed modifier (for example, fast boots) raises or lowers it, and the DM can change a crawler's base speed in edit mode on their profile.

- During combat you can only move **your own crawler**, and only on **its turn**.
- Distance uses the same scale as the Ruler: **5 ft per grid square**, where a square is the size of one token.
- A **feet-left badge** above the token of the crawler whose turn it is shows how many feet they have left out of their speed (for example **35/60 ft left**), with a bar that empties as they move. Everyone at the table sees it, and it counts down live while you drag. If you drag farther than you're allowed, the token stops at the edge of your range.
- The turn order in the Game Clock panel also shows the current crawler's feet left next to their name.
- You can move several times in one turn until your feet run out. Your movement refills when the turn passes.
- The DM can move any token at any time without using up anyone's movement.

Outside combat, while the DM is running noncombat turns, you can move **twice your speed** per noncombat turn (120 ft at the default speed). See [Game Clock & Turns](/wiki/game-clock). When no noncombat turn is running, movement isn't limited.

## Turn Timer

A configurable timer appears in the combat order bar during active combat, helping keep turns moving.

**Countdown Mode**: Set a time limit per turn (30s, 60s, 90s, or 120s). When the timer reaches zero, it flashes red and plays an alert beep. The DM still manually advances turns — the timer is a reminder, not auto-advance.

**Stopwatch Mode**: Counts up from 0:00 showing how long the current turn has taken. Turns yellow after 60 seconds and red after 2 minutes.

The DM can toggle between modes, change the countdown duration, and pause/resume the timer from the combat controls in the game clock panel. The timer automatically resets each time a turn advances.

## Damage

When you attack a target:

1. Roll your attack dice to see if you hit. A **natural 1** misses, so the damage window doesn't open
2. If the attack connects, select a target from the damage modal
3. Roll damage dice to determine how much damage you deal
4. Damage is applied to the target's HP automatically

Splash damage weapons can target multiple enemies at once.

## Health Tracking

Each combatant's HP is tracked independently during combat. For mobs that appear multiple times (like "Greg A" and "Greg B"), each instance has its own health pool. The DM can manually override any combatant's HP.

## Activity Stats

Damage you deal, killing blows (including the blow that takes down the last enemy) and damage you take are recorded on your profile automatically. The crawler who lands the killing blow gets their Mobs Looted credit from that mob's loot like everyone else. See [Activity Stats & Trophies](/wiki/activity-trophies).

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

## Editing an Episode During a Game

You can open an episode in the DM Console editor while it's running in Show Time. Saving it keeps the live positions and HP of mobs you didn't touch in the editor, so moves made in Show Time aren't undone.

## Deleting Maps

If you delete a map, every episode that uses it is updated: the map is removed from the episode along with the mobs and crawlers placed on it, and the episode's other maps keep their mobs, settings and fog. If the game was running on the deleted map, everyone's Show Time switches to the episode's next map on its own.

When you add mobs or crawlers to an episode, each one goes to the first free spot near the middle of the map, so crawlers don't land on top of mobs.

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
    title: 'Mobs (Creatures, Characters & Bosses)',
    category: 'Basics',
    order: 2,
    content: `# Mobs (Creatures, Characters & Bosses)

Mobs are everyone in the game world who isn't a crawler. They are all set up the same way and can all talk, trade and fight. The only difference is whether they're a one-off or part of the story.

## Kinds

| Kind | What it is | Example |
|------|-----------|---------|
| **Creature** | A template. Place it on the map as many times as you like; each copy is labelled A, B, C… and is transient | Goblin, Gnome |
| **Character** | One named person who is part of the story and may come back | Grimble the Goblin Merchant |

Tick **Boss** on either kind to mark it as a boss (red styling, its own Bosses tab in Mob Profiles).

A character can optionally be a creature (**Is a** in the DM Console): Grimble *is a* Goblin. When players meet Grimble, Goblin is revealed in their Mob Profiles too.

Mobs made before kinds existed carry over automatically: Normal became Creature, Boss became a Creature with Boss ticked, and NPC became Character.

## Friendly or Hostile

Hostility belongs to each token on the map, not the mob, so it can change mid-scene. Creatures start out **hostile** and characters start out **friendly**.

- **DM**: right-click a token in Show Time and choose **Make Friendly** / **Make Hostile**. The DM sees a red ring around hostile tokens and a green ring around friendly ones; players don't see the rings
- **Combat**: when the DM starts a combat turn, hostile tokens are ticked and friendly ones are left unticked (marked *friendly*). The DM can still tick a friendly token to pull it into the fight

## Mob Profiles (players)

The Mobs page shows what the party has encountered in three tabs: **Bosses**, **Mobs** (creatures) and **Characters**. Each tab shows how many it holds. Characters show the creature they are when it's known ("A Goblin").

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
- **Attacks & Spells**: what the DM rolls for it in combat (see below)

## Attacks & Spells

Open **Attacks & Spells** when adding or editing a mob in the DM Console:

- **Add attack**: give it a name, whether it uses an Action, Bonus Action or Reaction, a to-hit bonus, damage dice plus a flat damage bonus, a damage type, a range (leave blank for melee) and optional notes. Mobs have no ability scores, so the bonuses are flat numbers
- **Spells**: add any spell from the campaign's spell library. Mobs don't spend mana
- **Weapons** the mob has equipped from its default inventory are added on their own

In combat, the DM rolls all of these from the mob actions panel on the map. See [Combat System](/wiki/combat).

## Encountered Mobs

New mobs start as **unencountered**: they don't appear in players' Mob Profiles until the party meets them. They still show on the map, can join combat, and can be talked to in Game Chat when a crawler is within 20 ft.

The DM can mark a mob encountered (or unencountered) from:
- The DM Console Mobs tab
- Show Time: right-click a mob token and choose **Mark Encountered**
- The combat panel: the **Reveal** / **Hide** button next to the mob

## Mob Visibility

The DM can choose to hide or show various mob details:
- **Unencountered**: The mob is left out of players' Mob Profiles
- **Hide HP**: Health bar is hidden from players
- **Hide Strengths/Weaknesses**: Stat details hidden until the DM reveals them

## Mob Management (DM Console)

From the DM Console Mobs tab, the DM can create, edit, and delete mobs. The **Existing Mobs** list has the same Bosses, Mobs and Characters tabs. This includes setting up their inventory, equipping items via double-click or right-click context menu, and configuring their stats.

## Mobs on Maps

When placed on a map during episode setup or Show Time, mobs appear as circular icons. Each mob instance tracks its own HP independently, so duplicate mobs can take different amounts of damage.

## NPC Personality

Every mob can talk for itself in Show Time when NPC voices are running. Each mob has an optional **NPC Personality** card (DM only) in the DM Console; leave it blank and the AI makes one up from the mob's details. Each copy of a creature gets its own made-up personality, so Goblin A and Goblin B feel like different goblins. See [Talking NPCs](/wiki/talking-npcs).

## Merchants

Any mob can be a merchant that buys and sells items. Tick **Is a merchant** on the mob in the DM Console. See [Merchants](/wiki/merchants).`,
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

1. **Create Templates**: In the DM Console, create loot box templates with a name, tier, items, optional gold, and an optional **Achievement**
2. **Send to Crawlers**: During Show Time, select a template and choose which crawlers receive it
3. **Unlock**: When ready, click "Unlock" on a sent loot box to let the crawler open it

## Player Workflow

1. **Notification**: A toast notification appears when you receive a loot box
2. **View**: Go to your profile page to see pending loot boxes
3. **Claim**: Once the DM unlocks the box, click "Claim" to add the items and gold to your inventory
4. **Claim All**: Use the "Claim All" button to instantly claim all unlocked loot boxes

## Achievements in Loot Boxes

A loot box can carry an achievement: give it a name (and an optional description) when creating the box. When the DM unlocks a crawler's box, the achievement is added to that crawler's trophies on their profile, the same as a trophy the DM awards by hand (see [Activity Stats & Trophies](/wiki/activity-trophies)). Getting the same achievement again counts it up.

While the box is locked, players only see a 🏆 next to its item count. After it's unlocked, the box shows which achievement was added. A box that held only an achievement disappears once it's unlocked, since there's nothing left to claim.

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
5. Rewards are also hidden from players by default. The eye icons here set what players see when the quest is first handed out
6. Click **Create Quest** to save

## Linking Quests to Episodes

When creating or editing an episode in the Episodes tab, you can select quests to include. Linked quests are listed first in Show Time, but every quest in the campaign can be handed out from any map.

## Assigning Quests (DM)

During Show Time, the Quest Panel appears in the map selector under the loot boxes:

1. Select a quest to assign
2. Every crawler in the campaign is listed and selected by default. Crawlers on this map come first, and the others are marked "not on map". Deselect any who shouldn't receive it
3. Click **Assign** to give the quest to the selected crawlers
4. If every crawler in the campaign gets it, it becomes a **Party Quest**
5. A notification appears in the dice roller and as a popup for the players who received it

Each handout keeps its own progress. If the same quest goes to two groups, their checkmarks, revealed items, claimed rewards and notes stay separate.

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
- **Quest Notes**: A shared notepad where any crawler on the quest can add date-stamped text entries. Every crawler who received the same handout sees the others' notes.

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
- Each crawler can move up to **twice their movement speed** (120 ft at the default 60 ft speed). A badge above your token shows the feet you have left (the DM sees every crawler's badge, and the Game Clock panel lists each crawler's feet left), and only you can move your crawler. The DM can still move any token freely.

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

If you refresh the page or visit another page (like the DM Console) during a game, Show Time picks up where you left off when you come back, and players stay in the game.

## For Players

1. Navigate to Show Time
2. If the DM has started an episode, you will see the current map
3. If no episode is active, you will see a waiting screen

The map opens fitted to your screen, centered, on phones too. On phones the map tool buttons show icons only so the tools stay in one row. Pop-ups for the game starting or ending close by themselves after a few seconds, and a new one replaces the last instead of stacking. Loot box and quest pop-ups stay for 15 seconds.
4. Interact with the map: click to ping, view mob details, see your position
5. Roll dice and perform actions from your profile page

## Top Menu

The top menu hides during Show Time to make room for the map. Move the mouse to the very top edge of the page and hold it there for a moment to bring it back, or tap the pin to keep it showing.

## Map Interaction

- **Zoom**: Scroll to zoom in/out on the map. Scrolling over a panel (Game Chat, dice, game clock, map tools) scrolls that panel instead
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
- Quest assignments and progress
- Game chat and NPC speech bubbles

## Game Chat

The chat button in the bottom right opens the **Game Chat** for the running episode. Players talk as their crawler and the DM talks as the DM. Hold the microphone button to speak instead of typing. Mobs with a personality answer in the chat and in speech bubbles over their heads. See [Talking NPCs](/wiki/talking-npcs).

The chat tucks away when you click or tap anywhere outside it, and the dice roller does the same.`,
  },
  {
    id: 'merchants',
    slug: 'merchants',
    title: 'Merchants',
    category: 'Features',
    order: 33,
    content: `# Merchants

Any mob can be a merchant. Crawlers walk up to them in Show Time to buy items and sell their own.

## Setting Up a Merchant (DM)

In the DM Console, open a mob (new or existing), expand **Merchant** and tick **Is a merchant**. Then set:

| Setting | What it does |
|---------|--------------|
| Starting gold | How much gold the merchant has to buy items from crawlers |
| Scrooge Factor | How greedy the merchant is (see Prices below) |
| Haggle DC | The Persuasion roll a crawler needs to ask for better prices (15 if left blank) |
| Stock | Items from the item library, with how many of each the merchant has |

Each stock line shows its buy / sell price at the current Scrooge Factor.

### Characters and creatures

A **character** merchant (Grimble) has one shop wherever their token stands. A **creature** merchant is a template, so each copy on the map runs its own shop: Goblin A and Goblin B each start with the stock and gold you set, and buying out Goblin A doesn't empty Goblin B. Restock works on one copy at a time.

## Trading (Players)

During Show Time, tap a merchant's token and choose **Trade with Merchant**. You must be within **20 ft** of the merchant; farther away, the option is greyed out and says how far you are.

- **Buy**: shows what the merchant has, how many are left and the price. The gold comes out of your crawler's gold and the item goes into your inventory.
- **Sell**: shows your inventory and what the merchant will pay. Selling an equipped item takes it off first.

Stock and gold are shared by everyone. If one crawler buys a knife and the merchant had three, everyone else sees two left. If two crawlers try to buy the last one at the same moment, only one gets it; the other is told it's sold out.

### When the Merchant Runs Low on Gold

The merchant only pays with the gold they have. If an item is worth more than the merchant has left, you can **sell it for whatever gold they have**. A merchant with no gold can't buy anything until they make some sales or the DM restocks them.

## Prices and the Scrooge Factor

| Scrooge Factor | Crawlers pay | Crawlers get when selling |
|----------------|--------------|---------------------------|
| 0 | Item value | Item value |
| 1 | 10% more | 10% less |
| 2 | 20% more | 20% less |
| ... | +10% per level | -10% per level |

Prices are rounded to whole gold, up when buying and down when selling. Items with no gold value can't be sold.

## Haggling

In the trade window, press **Haggle** to roll Persuasion (d20 + your Charisma modifier, including equipment). The roll shows in the dice log.

Haggling uses an action. In combat it takes your action, so you can only haggle on your turn before acting. Between fights it uses one of your rolls for the current turn.

- If you meet the merchant's Haggle DC, the DM gets a prompt to lower your prices one Scrooge level. If they say yes, you trade at the lower level with that merchant.
- If you fall short, or the DM says no, the merchant won't budge.

Each crawler gets one haggle per merchant until the merchant is restocked. Haggling only lowers prices for the crawler who rolled.

## Barter

Your **Barter** skill lowers prices on top of haggling. Every 2 Barter ranks take 1 off the Scrooge Factor you trade at, and each rank adds +1 to your haggle rolls. Prices never drop below an item's gold value, so you can't buy low and sell back to the same merchant for a profit. The trade window shows how much your Barter is taking off.

Barter isn't bought with skill points. It ranks up as you use it: every buy or sell counts, and ranks come at 10, 30, 60 and 100 trades and so on, up to rank 10. See [Skills](/wiki/skills).

## Restocking (DM)

Right-click a merchant's token in Show Time and choose **Open Merchant**. The DM sees the stock, the merchant's gold, and any haggles waiting for an answer (these also pop up in the bottom left of the map). **Restock** resets the stock, gold and haggling to the settings in the DM Console.

Changes to stock and starting gold in the DM Console take effect at the next restock. Changes to the Scrooge Factor apply right away.`,
  },
  {
    id: 'experience-levels',
    slug: 'experience-levels',
    title: 'Experience & Levels',
    category: 'Game Mechanics',
    order: 15.5,
    content: `# Experience & Levels

Crawlers earn **XP** automatically while they play, and the DM can hand out more. XP raises your level, and there's no level cap.

## Where XP comes from

| Event | XP | Who gets it |
|-------|----|-------------|
| Damage to a hostile mob | 1 per 2 damage | The attacker |
| Killing blow | 5 × the mob's level | The attacker |
| Fight finisher (last mob down) | 10 | The attacker |
| Surviving a fight (above 0 HP when combat ends) | 2 | Every crawler in the fight |
| Near death (HP drops below 10% of max) | 5 | That crawler |
| Finishing a quest | Set on the quest (10 if left as is) | Each crawler who finishes every visible action item |
| A spell mastery or Looting level up | 20 | That crawler |
| DM award | Any amount | The crawlers the DM picks |

Damage to friendly NPCs and to other crawlers earns no XP. Each grant shows in the dice history, and your last 20 show under **Recent XP** on your profile.

## Levels

Reaching level L takes 50 × L × (L − 1) total XP, so each level costs 100 XP more than the last:

| Level | Total XP |
|-------|----------|
| 2 | 100 |
| 3 | 300 |
| 5 | 1,000 |
| 10 | 4,500 |
| 20 | 19,000 |

The XP bar under **LEVEL** on the Profile tab shows how close you are to the next level.

## Level-up rewards

Level-ups happen automatically. Each level gives:

- **+5% max HP and +5% max mana**, rounded up (always at least +1). Your current HP and mana go up by the same amount. A 25 HP, 3 mana crawler reaching Level 2 gets +2 HP and +1 mana.
- **1 skill point** to spend on a skill. See [Skills](/wiki/skills).
- **1 ability point.** Each point is +1 to that ability's rolls. The 5-point limit from the character creator doesn't apply to level-up points.

When you have points to spend, a gold badge shows on your profile and on the Skills tab. Spend them on the **Skills** tab.

## For the DM

- **Award XP** is on each crawler's Profile tab, next to the trophies. Enter an amount and a reason, and tick one or more crawlers. DM awards are exactly what you type.
- **Auto XP** next to it scales all automatic XP in the campaign, from 50% to 200%.
- **Admin Override** can set a crawler's level or total XP by hand. Changing the level moves their XP to the start of that level.
- Set a quest's XP in the quest editor in the DM Console.
- Crawlers from before XP start with exactly the XP their level needs, so nobody loses a level.`,
  },
  {
    id: 'skills',
    slug: 'skills',
    title: 'Skills',
    category: 'Game Mechanics',
    order: 15.6,
    content: `# Skills

Skills make a crawler better at one kind of thing. Each skill has ranks from 0 to 10, shown on the profile's **Skills** tab.

| Skill | Ability | What each rank does |
|-------|---------|---------------------|
| Barter | CHA | Every 2 ranks lower a merchant's Scrooge Factor by 1 for you; +1 to haggle rolls |
| Athletics | STR | +1 to climb, jump and grapple checks; every 3 ranks add +5 ft of movement |
| Stealth | DEX | +1 to sneak and hide checks |
| Perception | INT | +1 to spot, search and sense-lies checks |
| Medicine | INT | +1 HP on every heal you give with a spell |
| Intimidation | CHA | +1 to threaten checks |

## Getting ranks

- **Skill points:** you get one each level. Press **+** on a skill to spend one on a rank. Athletics, Stealth, Perception, Medicine and Intimidation are bought this way.
- **By use:** Barter ranks up as you trade with merchants. Every buy or sell counts, and ranks come at 10, 30, 60 and 100 trades and so on, like Looting. See [Merchants](/wiki/merchants).

## Skill checks

Press **Roll** on a skill to roll d20 + the linked ability modifier + your rank. The roll goes to the dice history. A skill check uses an action like the Actions tab: in combat it takes your action on your turn, and between fights it uses one of your rolls for the turn.

Pick the check's difficulty above the skills before you roll. The dice history shows whether you beat it.

| Difficulty | DC on Floor 1 | Each floor deeper |
|------------|---------------|-------------------|
| Easy | 10 | +2 |
| Medium | 15 | +2 |
| Hard | 20 | +2 |

A natural 1 always fails and a natural 20 always succeeds, however big your bonus is. Haggle rolls follow the same rule. Bonuses keep growing as you level, and DCs grow as the party goes deeper, so the d20 still matters on every floor.

The DM sets the party's current floor next to **Auto XP** on any crawler's Profile tab.

More skills will be added later.`,
  },
  {
    id: 'talking-npcs',
    slug: 'talking-npcs',
    title: 'Talking NPCs',
    category: 'Features',
    order: 32,
    content: `# Talking NPCs

Mobs with a personality speak for themselves during Show Time. An AI model writes one line of in-character dialogue at a time, based on the personality you wrote and what is happening in the game. NPCs speak the languages set on their mob, so players may need a translator; see [Languages](/wiki/languages). The model runs either online through free AI services or on the DM's own computer (see NPC Brain below).

## Giving a Mob a Personality

In the DM Console, open a mob (new or existing) and expand **NPC Personality**. Fill in any of these:

| Field | What it does |
|-------|--------------|
| Voice and manner | How they talk ("Gruff dwarf smith. Calls everyone kid") |
| Wants | What they are after |
| Knows | Things they can tell the party |
| Secret | Something they hide until you unlock it |
| Reveals the secret when | The condition for giving it up ("The party pays him") |
| Attitude toward the party | Friendly, grumpy, scared, hostile... |
| Persuasion DC | How hard they are to talk into giving up the secret (optional) |

Players never see this card.

### Auto-generated personalities

Every mob can talk, even ones you never wrote a card for. The first time a mob without a card is needed (or while things are quiet), the AI writes one from everything the game knows about it: name, kind, level, description, strengths and abilities, weaknesses, hit points, the items it carries and its gold. It also rolls random ingredients (a temperament, a speech quirk, what drives it, how it sees the crawlers and something tied to its past) so no two mobs come out the same, even two of the same kind.

**Creatures** get one per copy on the map: Goblin A, Goblin B and Goblin C each talk as themselves in the chat, with their own personality and secret. If you write a card on a creature, every copy uses your card. **Characters** are one person, so they always have one personality wherever their token stands.

The generated personality includes a secret and a Persuasion DC based on the mob's level (bosses are harder). It stays the same for the rest of the campaign. In the chat settings it shows as **(AI personality)** next to the mob's name; hover to read it. Fill in the mob's card in the DM Console at any time to replace it with your own.

Hidden mobs never talk.

## When NPCs Speak

NPCs listen as soon as the DM opens an episode in Show Time (you do not need to start the game clock), and talk on their own, no button needed:
- **Spoken to by name**: "Grimble, where's the key?" gets an answer. You can also type **@** in the chat box to pick who you're talking to from a list. After that, your messages keep going to that mob (the chat shows **Talking to …** above the box) until you pick someone else or tap the ✕
- **Within 20 feet**: players can only talk to mobs within 20 ft of their crawler (measured like the Ruler). The @ list only shows mobs in range, with how far away they are, and mobs farther away don't answer. The DM can talk to any mob
- **Someone talks nearby**: the closest NPC may chime in
- **A crawler walks up** to them
- **A crawler gets badly hurt**, a **fight breaks out**, a **mob dies**, or a **loot box is opened** nearby
- **Quiet moments**: after about a minute of silence, an NPC near the party may mutter something

Each line appears in a speech bubble over the NPC's head on the map, fades after a few seconds, and is saved in the Game Chat. A "…" bubble shows while the NPC is thinking. An NPC waits about 20 seconds between lines so it doesn't hog the conversation.

## Memory

NPCs remember the party. When a conversation with an NPC has been quiet for about 2 minutes, the AI writes down what mattered in a few short notes, such as "Biff promised to bring back my lantern". It also notes how the NPC now feels about each crawler who talked to it, from hostile to fond. From then on the NPC talks with that memory, so insult Greg and he stays cold with you next time.

- **Characters** (like Grimble) keep their memory for the whole campaign, across maps and episodes.
- **Creature copies** (like Goblin B) each remember their own conversations, but only for the episode they were made in.
- Locked secrets never go into memory, since the AI doesn't know them.
- Animals that speak **Beast** and plants that speak **Plant** show body language to crawlers who don't know the language. Corpses that speak **Dead** only answer crawlers using Speak with Dead, and **Silent** mobs never talk. See [Languages](/wiki/languages).
- NPCs only know what they could have heard: messages players sent while the NPC was within 20 ft, your narration (unless you @ someone else), and other NPCs talking close by on the same map. Each reply uses the last 25 messages the NPC heard, and nothing from other maps or out of earshot goes into its replies or its memory.

DMs can see and change what an NPC remembers: open the Game Chat settings and tap the brain icon next to the NPC. The number on it is how many notes it has. Edit the notes (one per line) and tap **Save**, or tap **Forget everything** to wipe its memory and feelings.

## Secrets

The AI is **never told the secret** until you unlock it, so it can't let it slip. When a message in the chat looks like it meets the reveal condition, you get a prompt in the Game Chat:

> Vex: "Here are 10 gold coins." Unlock Grimble's secret?  **Unlock** / **Not yet**

Unlock tells the NPC the secret and it shares it right away. You can also lock or unlock any secret by hand in the chat settings.

### Persuasion Rolls

If the NPC has a **Persuasion DC**, a crawler can try to talk them into it: roll **Persuasion** from your profile while standing next to the NPC on the map (or right after talking to them in the chat). If the total meets the DC, the DM gets the same Unlock / Not yet prompt, showing the roll. If it falls short, the NPC brushes you off.

Each crawler gets one try per NPC each noncombat turn (or every 10 minutes when turns aren't running).

## DM Settings

Open the Game Chat and tap the gear icon:
- **NPC voices**: turn the feature on or off for this campaign
- **Spoken voices**: read NPC lines aloud on every device, with a voice per NPC (see Spoken Voices above)
- **Keys**: free Groq and Gemini keys (and an ElevenLabs key for voices), saved only in this browser
- **NPC brain**: **Online** or **Laptop** (see below)
- **Model**: **Best quality** (bigger, slower) or **Fast** (smaller, quicker). On the Laptop brain, Fast uses qwen3:4b-instruct-2507, the quickest model on the DM laptop
- **Mute all NPCs**, or mute one NPC
- **Secret** lock/unlock per NPC
- **Memory** per NPC (brain icon): see and edit what it remembers
- **Clear chat** for the current episode

The dot next to the chat button is green when an NPC brain is listening. The chat header says which one is answering, for example "NPC voices online" or "Laptop covering".

## Spoken Voices

NPCs can also say their lines out loud. Turn on **Spoken voices** in the Game Chat settings (gear icon). From then on, every NPC line is read aloud on every player's device at the same moment its speech bubble appears.

- The voices come from online voice services, using free keys you paste into the chat settings: **Gemini** first, then **Groq**, then **ElevenLabs**. When one runs out of free use (or its key is missing or rejected), the next one takes over automatically, and the chat settings say which one is in use and when the others come back.
- Gemini and Groq get a one-word mood tag worked out from the NPC's Voice and manner notes and attitude (gruff, nervous, cheerful, angry, sly, whispering, slow or fast), so a gruff dwarf sounds gruff and a nervous goblin sounds nervous. Only the line itself is spoken; accents come from the voice you pick.
- If a line can't be voiced for the players, the chat settings say why under Spoken voices.
- Lines play by themselves. If a browser won't play sound until you've tapped the page, the line waits and plays on your first tap.
- When every service is used up, voices are made by Kokoro, a free voice model that runs in the DM's browser. It sounds flatter, and the first time it's needed the browser downloads it (about 330 MB) and keeps it for next time.
- Keep the DM tab open during the game, the same as for the Online brain. The keys are saved only in that browser.
- Each line is saved in the game's database as a small sound clip that players' devices play once. Clips are deleted again after about 15 minutes.
- Lines in a language a player doesn't know are read to them as the scrambled words, so it sounds foreign. Players who know the language, and the DM, hear the real words. If nobody in the party knows the language, everyone (the DM too) hears the scrambled words. Spanish is read in Spanish for everyone.
- Base64 lines are beeps, whistles and warbles, like a little astromech droid, instead of a voice.
- Lines in Mindspeech or Ward sign aren't read aloud (thoughts and signs make no sound), and players who don't know Beast, Plant or Dead hear nothing from those speakers (they still see what they do).
- The bit of static some voice services leave after the last word is cut off.
- **Mute one character:** tap the little speaker next to an NPC's name in the chat to stop hearing that character (every copy of a creature). It's just for you. Muted characters are listed under the speaker button at the top of the chat, where you can unmute them.
- Actions written between asterisks (the NPC grinning, wiping its hands) are skipped; only the words are spoken.

### Creature sounds

Each NPC can also have a creature sound, an effect put on whatever voice reads its lines:

- **Goblin**: higher, quicker and a little nasal
- **Tiny**: very high and fast, like a pixie or a cartoon mouse
- **Giant**: deeper and slower, with a bit of boom
- **Dragon**: much deeper, with a growl and an echo
- **Ghost**: hollow, wavering and echoing

It's picked from the NPC's name, description and Voice and manner notes (a "goblin" gets Goblin, a "red dragon" gets Dragon). You can choose another one, or None, under the NPC's voice in the chat settings. The sound works with every voice service and costs nothing.

### ElevenLabs character voices

ElevenLabs has a voice library with goblins, trolls, dragons and cartoon characters. Add the ones you like to your ElevenLabs account, then pick one for an NPC with the **ElevenLabs** menu under its voice. NPCs with an ElevenLabs voice are read by ElevenLabs first, even when other services still have free use, so they keep their character voice until your ElevenLabs credits run out. Everyone else keeps the usual order.

### Picking a voice

Every NPC gets a voice picked from its **Voice and manner** notes, name and description. Words like "gruff", "old" or "orc" give a deep, slower voice; "squeaky", "nervous" or "goblin" a quicker one; "posh", "noble" or "elf" a British accent; "she" or "lady" a woman's voice. Copies of a creature (Goblin A, Goblin B) share a voice but talk at slightly different speeds.

To choose one yourself, open the chat settings. Under **NPCs on this map**, each NPC has a voice list and a speed (**Slow**, **Normal**, **Quick**). The list shows the voices of the service in use right now (Gemini's 30 voices, Groq's 6, the voices on your ElevenLabs account, or Kokoro's 28). Your pick is kept per service, and the other services choose a voice of the same gender. Tap ▶ to hear it say its last line. Picks apply to every copy of a creature.

### Volume

Everyone, players included, can tap the speaker icon in the Game Chat header to switch NPC voices off on their own device or change the volume. This is saved on that device. On phones, audio starts after you first tap anywhere on the page.

## Voice Input

Hold the microphone button next to the chat box, talk, and let go. Your words appear in the chat as a message. This works in Chrome, Edge and Safari; it isn't available in Firefox.

## NPC Brain

Choose where the AI runs in the chat settings (gear icon) under **NPC brain**.

### Online (default)

The AI runs in the DM's own browser using free online models. Nothing to install: keep Show Time open on the DM's device during the game.

1. Get a free key from [Groq](https://console.groq.com/keys) and, as a backup, one from [Google AI Studio](https://aistudio.google.com/apikey) (Gemini).
2. In the chat settings, paste them into **Groq key** and **Gemini key**.

NPCs use Groq first. If Groq's free requests run out, they switch to Gemini automatically, and the chat header says so. If both run out, the laptop covers when it is running; otherwise NPCs stay quiet until the free limit resets.

The keys are saved only in that browser on that device. They are never stored in the game or shared with players, so add them again if you DM from another device or browser. Only one tab runs the NPCs at a time.

### Laptop

The AI runs on the DM's computer with [Ollama](https://ollama.com), so nothing is sent to an outside service. A one-time installer sets it up; setup steps are in \`scripts/npc-voices/README.md\` in the project repository. Laptop mode only uses this local model, never Groq or Gemini. Pick it when you want the local AI; the Online brain is enough whenever the DM tab is open.

If no brain is available (no keys, laptop off or asleep, or out of memory), the chat still works and NPCs just stay quiet. The chat header says why.`,
  },
  {
    id: 'languages',
    slug: 'languages',
    title: 'Languages',
    category: 'Features',
    order: 32,
    content: `# Languages

Crawlers and mobs know languages. If someone talks in a language you don't know, you see gibberish in the Game Chat instead of their words. Notes and items can be written in a language too.

## Built-in Languages

| Language | Who uses it |
|----------|-------------|
| **Worldspeech** | Essentially the common tongue, spoken by most races. Every crawler starts with it |
| **Dervish** | Small creatures like gnomes, dwarves and goblins |
| **Vernonacular** | Magicians |
| **Mindspeech** | Mental impressions; most useful with non-auditory or sub-sentient creatures. Crawlers must be **Telepathic** to use it |
| **Ward sign** | A sign language built on abstract symbolism |
| **Mewmew** | The Felinus races |
| **Base64** | Machines and sentient robots |
| **Kra Kow** | Usually goblins, orcs and trolls |
| **Spanish** | Spanish, carried down into the dungeon from the world above |
| **Beast** | Animal sounds and body language. Give it to a crawler with Speak with Animals or a similar gift |
| **Plant** | Rustling, creaking and slow movement. Speak with Plants grants it |
| **Dead** | The voice of a corpse. Speak with Dead grants it |

Each language looks different when you can't read it: Kra Kow is harsh grunts, Mewmew is mrrps, Ward sign is symbols, Mindspeech is waves. Base64 really is Base64, so a crawler with a decoder and some patience might work it out. Spanish is real Spanish: NPCs write their lines in Spanish, and crawlers who don't know it see the same Spanish words.

## What Your Crawler Knows

Open a crawler's profile and look for the **Languages** box. The DM taps **Edit** to choose which languages a crawler knows and to turn on **Telepathic** (needed for Mindspeech).

## Languages From Spells and Items

A spell can grant a language for a while: give it a **Grants Language** in the spell editor (Speak with Animals grants Beast). When a crawler casts it, they know that language for the spell's duration:

- **Noncombat turns** count down each time the DM starts a new noncombat turn.
- **Combat turns** count down each new combat round. A spell timed only in combat turns ends when the next noncombat turn starts, since an hour has passed.
- With no duration it lasts until someone ends it.
- **Questions** (Speak with Dead: 5) limits how many lines the crawler can say in the language. Once they're used up the crawler can't speak it any more, but still understands the last answer until the spell ends.

Casting it again starts it over. Spell languages show in the Languages box with the time or questions left. The crawler or the DM can tap the ✕ to end one early. They also show in the chat's language menu, like *Dead (Speak with Dead, 3 questions left)*.

An item can grant a language while it's equipped: pick one under **While equipped, knows** when making the item (a druid's charm that grants Beast). It shows in the Languages box as *from equipped item*.

## Making Up a Language

Anyone can make one up: in the Languages box on your own profile, open **Make up a language**, give it a name and (optionally) who speaks it. Your crawler knows it straight away. The DM decides who else learns it, and can delete made-up languages from the same box.

## Mobs and NPCs

In the DM Console, every mob has a **Languages** picker. Tap the languages it speaks; the first one is its native tongue. A mob with none picked speaks Worldspeech.

When an NPC talks:
- If someone speaks to it in a language it knows, it answers in that language.
- If someone speaks to it in a language it doesn't know, it can't understand them and answers in its native tongue.
- When it speaks up on its own, it uses the last language it was spoken to in, or its native tongue.
- If nobody in the party knows the language it answers in, the AI is skipped: it says a short preset line instead (the players only see gibberish anyway), and the DM sees a small **preset** tag on it. Lines the DM sends still get a real answer. Beasts, plants and corpses always get a real answer, since everyone sees their body language.

### Beasts

Pick **Beast** for animals. A crawler who knows Beast reads what the animal means in plain words. Everyone else sees what it does instead, such as *squeaks twice and backs toward the hole*, so the party can still read its mood.

### Plants

Pick **Plant** for talking plants. It works like Beast: crawlers who know Plant read the words, everyone else sees what the plant does. Plants only know slow, local things like who walked past and where they went.

### Corpses

Pick **Dead** for a corpse. Any mob whose token drops to 0 HP also counts as a corpse automatically, and still remembers what it knew alive. A corpse stays silent until a crawler talks to it in Dead, usually by casting Speak with Dead. The DM can always get an answer by @-tagging the corpse. It only knows what it knew in life and answers briefly, often cryptically. Each casting gets as many questions as the spell allows; then the corpse falls silent again. Crawlers without Dead see what the corpse does, such as *its jaw creaks open and a dry whisper escapes*.

### Silent Mobs

Tick **Silent** on a mob that never talks (oozes, constructs). It stays quiet in the Game Chat and can't be @ mentioned, even if it has a personality.

## Talking in a Language

If your crawler knows more than one language, a language menu appears above the chat box. Pick the language you talk in. Party members who don't know it see gibberish, and so do NPCs who don't know it.

The DM sees every line as it was said, with the language marked.

## Translators

A crawler who knows a language can translate it for the party. Use the translate menu next to the language menu in the Game Chat:
- **Not translating**: party members who don't know the language see gibberish.
- **Translating**: everyone in the party sees lines in your languages, marked "translated by" you.
- **Translating (check lines)**: the party sees "is translating…" until you act on each line. Tap **Pass on** to tell them exactly what was said, or **Twist** to tell them something else.

A twisted translation looks just like an honest one to the party. Only the translator and the DM can see what was really said; the DM sees a **twisted** tag next to it. Party members who know the language themselves always see the real words, so they might catch you.

## Items and Notes

When the DM adds or edits an item, the **Written in** menu sets the language of its description. Crawlers who don't know that language see a scrambled description (the name stays readable).

When you add a quest note and know more than one language, you can pick the language it's written in. Only crawlers who know it can read it (you can always read your own notes).

## Good to Know

The real words are still saved in the game's database, so this keeps honest players honest rather than stopping a determined snoop.`,
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
- Links: \`[text](url)\` (web links starting with https://, email links, or wiki links like \`/wiki/campaigns\`; other kinds show as plain text)

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
- **Signed-in users** (via Google) can create campaigns, join campaigns, and interact with all game features.
- If you sign out, you'll be redirected back to the landing page.

## Creating an Account

1. Click **Enter the Dungeon** on the landing page, or click **Sign In** if you see it.
2. Click **Continue with Google**. Your account is created the first time you sign in. (Accounts are Google only; email/password sign-up has been removed.)
3. On first sign-in, you'll be prompted to choose a **username** (unique, 3-24 characters, letters/numbers/underscores) and **display name**.
4. The Set Up Profile box shows which account you're signed in with. If it's the wrong one, click **Not you? Sign out** to go back and sign in again.

## Signing In

1. Click **Sign In**, then **Continue with Google**.
2. After sign-in, you'll see the Campaign Selection screen.

## Signing Out

Click **Sign Out** to sign out. You can sign back in at any time.

## User Profile

Your profile includes:
- **Username** — unique identifier, used for lookups
- **Display Name** — shown in campaigns and as the DM name
- **Avatar** — pulled from your Google account

## Account Settings

Click the **⚙ Account Settings** section on the Campaign Select screen to manage your preferences.

### Show Public Content

Toggle **Show Public Content** to opt in to seeing items and spells shared publicly by other players:

- **Off (default)** — you only see your own campaign's content
- **On** — a "Community Items" section appears in Inventory and a "Community Spells" section appears in Vernon's Library, showing publicly shared content from all players

When you enable this setting, an **age warning** is displayed reminding you that public content is user-generated and may not be suitable for all ages. You must acknowledge this warning to continue.

You can disable public content at any time from Account Settings. Your toggle decisions are recorded in your Decision History.

## Decision History

Inside Account Settings, the **Decision History** panel shows a log of significant account-level decisions you have made (e.g., enabling or disabling public content). Each entry shows:

- The action taken
- A human-readable label
- The date and time`,
  },
  {
    id: 'tutorial-episode',
    slug: 'tutorial-episode',
    title: 'Tutorial Episode: Rat Problem',
    category: 'Basics',
    order: 6,
    content: `# Tutorial Episode: Rat Problem

**Tutorial: Rat Problem** is a short starter adventure that shows a new group every part of the app in one evening of play. It comes as its own campaign, so it never mixes with your other games.

## The Story

You and your friends are throwing a DnD party tonight, and you're out of supplies. On the way to the hardware store, something is off about the neighbor across the street. Back home, he bangs on your door, begging for help with rats in his basement. Help him or not, everyone ends up in that basement.

## Maps (in play order)

1. **Home: DnD Party** — QWERTY (speaks Base64), the parrot and the Chair Thing. Party leftovers to loot, including a book that teaches **Speak with Animals**.
2. **Neighborhood Street (Day)** — noncombat turns with a squirrel, a missing poster and the neighbor at his blinds.
3. **Hardware Store** — trade with **Señor Gringo** the merchant, and meet Mr. Wavos, who only speaks Spanish.
4. **Neighborhood Street (Night)** — the storm. Day and night are two copies of the street map; switch maps when night falls.
5. **Creepy Neighbor's House** — fog of war on. Kitchen, upstairs or basement?
6. **Creepy Neighbor's Basement** — pitch black (fog of war), a college kid in a rat fursuit who only speaks Beast, and a boss fight.

## What It Teaches

| Feature | Where |
| --- | --- |
| Character setup | Before play |
| NPC chat and personalities | Every character |
| Languages (Spanish, Base64, Beast) | Mr. Wavos, QWERTY, the college kid |
| Trading and haggling | Señor Gringo |
| Quests | Clear Out the Rats |
| Noncombat turns | The street and the house |
| Fog of war | The neighbor's house |
| Combat and loot | The basement |

## For the DM

- The read-aloud story for each scene is in the episode's description on the Show Time episode list.
- Five loot boxes are ready to send: Party Supply Money (20 gold each, for the hardware store), Party Leftovers, Telephone Pole Poster, Kitchen Drawer and Fursuit Rack.
- Give the quest **Clear Out the Rats** when the neighbor knocks. Two of its steps and its reward are hidden until you reveal them.
- Someone needs **Speak with Animals** (from Grandma's book) to understand the college kid.`,
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

## Who Can See a Campaign

Only the DM and the campaign's members can see or change its crawlers, maps, episodes, chat and everything else in it. Anyone else who signs in can't see the campaign at all unless they have its invite code.

If you **regenerate** the invite code, the old link stops working for new players. People who already joined stay in.

## Player Limit

Each campaign supports up to **10 players** (including the DM if they play as a crawler).

## DM Access

- The user who **creates** a campaign is the DM.
- The DM has access to the DM Console, mob management, episode control, combat admin, loot distribution, and all admin-only features.
- Players see player-only views (Profiles, Maps, Inventory, Mobs, Show Time, Sounds, Wiki).
- The DM can also play as a crawler by switching their identity in the player dropdown.
- Players can't pick **Dungeon AI (DM Access)** on the identity screen; only the campaign's creator gets it.

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
    id: 'spells-overview',
    slug: 'spells-overview',
    title: "Vernon's Library Overview",
    category: 'Spells',
    order: 0,
    content: `# Vernon's Library

Welcome to **Vernon's Library** — the spell management system for your campaign. Access it from the **Vernon's Library** button in the navigation bar or Main Menu.

Crawlers can learn and cast spells. Each spell consumes **mana** when cast and belongs to a **spell school** (Evocation, Necromancy, Illusion, etc.).

## The Library Interface

Vernon's Library is split into two panels:

- **Left panel — Spell Library**: The shared collection of reusable spells. DMs can create, edit, and delete spells here. Any library spell can be granted directly to a crawler.
- **Right panel — Known Spells**: Per-crawler spell lists showing cast counts, mastery levels, and effective mana costs.

Players cast their spells from the **Spells** tab on their crawler's profile. See [Casting & Mastery](/wiki/casting-mastery).

## Spell Schools

Every spell belongs to one of eight schools of magic:

| School | Focus |
|--------|-------|
| **Evocation** | Direct damage and energy manipulation |
| **Necromancy** | Death, undead, and life-force manipulation |
| **Illusion** | Deception, trickery, and sensory manipulation |
| **Conjuration** | Summoning creatures and creating objects |
| **Abjuration** | Protection, wards, and defensive magic |
| **Divination** | Knowledge, foresight, and detection |
| **Transmutation** | Altering matter, shape, and form |
| **Enchantment** | Mind control, charm, and influence |

## Quick Links

- [Learning Spells](/wiki/learning-spells) — How crawlers acquire new spells
- [Casting & Mastery](/wiki/casting-mastery) — Mana costs, action types, and mastery progression
- [Spell Properties](/wiki/spell-properties) — All configurable spell data fields
- [Spell Tomes](/wiki/spell-tomes) — Consumable items that teach spells
- [Sharing Spells](/wiki/sharing-spells) — Community spell sharing system`,
  },
  {
    id: 'learning-spells',
    slug: 'learning-spells',
    title: 'Learning Spells',
    category: 'Spells',
    order: 1,
    content: `# Learning Spells

Spells can be learned in several ways:

| Source | How |
|--------|-----|
| **Spell Tome** | Consume a [Spell Tome](/wiki/spell-tomes) item from your inventory — the tome is destroyed and you learn the spell |
| **Granted** | A DM grants the spell directly from Vernon's Library |
| **Quest** | Awarded as a quest reward |
| **Level Up** | Granted by the DM when leveling up |
| **Race / Class** | Innate spells from your race or class (set during character creation) |

A crawler **cannot learn the same spell twice**. If a crawler already knows a spell, attempting to learn it again will have no effect.

## Granting Spells (DM)

From Vernon's Library, DMs can grant any spell in the library directly to a specific crawler:

1. Open **Vernon's Library** from the navigation bar
2. Find the spell in the **Spell Library** panel (left side)
3. Click the spell to expand it
4. Use the **Grant** button and select which crawler should learn it`,
  },
  {
    id: 'casting-mastery',
    slug: 'casting-mastery',
    title: 'Casting & Mastery',
    category: 'Spells',
    order: 2,
    content: `# Casting & Mastery

## Casting Spells

Each spell costs **mana** to cast. Spells are cast using either an **Action**, **Bonus Action**, or **Reaction** depending on how the spell was designed.

Spells can optionally:
- Target a single enemy, multiple targets, an area, or the caster themselves
- Deal damage of a specific type (Fire, Poison, Healing, etc.)
- Apply effects lasting for a set number of **combat turns** or **noncombat turns**
- Require a saving throw from the target
- Have a splash damage effect (hits multiple enemies)

## Casting From Your Profile

Open your crawler's profile and pick the **Spells** tab. It shows your mana bar and every spell you know, grouped into **Action**, **Bonus Action** and **Reaction** spells. Each card shows the mana cost after your mastery discount, range, target, dice, saving throw, duration and how many casts until the next mastery level. Tap the arrow on a card for its full description.

Pressing **Cast**:
- Spends the spell's mana. If you don't have enough mana, the button is disabled and shows how much you need.
- Adds one to the spell's cast count, which drives mastery.
- **Damage spells** without a saving throw roll a spell attack (d20, plus the spell's hit die and any hit stat modifiers). In combat you then pick the target, or several targets for splash, area or multi-target spells, roll damage and apply it, the same as weapon attacks. Outside combat the damage is rolled straight away.
- **Healing spells** heal you right away if they only target yourself. Otherwise you pick which crawler to heal (several, for area or multi-target spells). Healing never goes above a crawler's max HP, including equipment bonuses.
- Spell stat modifiers add the crawler's ability modifier for that stat (for example, INT 14 adds +2).

In combat, spells follow the same turn rules as the Attacks and Bonus Actions tabs: Action spells use your action and Bonus Action spells use your bonus action, both only on your turn. Reaction spells can be cast at any time.

DMs can remove a spell from a crawler with **Forget spell** in the card's details.

## Reaction Spells

Spells with **Action Type: Reaction** are cast in response to a specific trigger event outside your turn. When creating a reaction spell, fill in the **Reaction Trigger** field to describe exactly when it can be used. The trigger is displayed on the spell card so players know when to declare it.

Examples of reaction triggers:
- "When you are hit by an attack"
- "When an ally within 30 ft takes damage"
- "When you fail a saving throw"

## Spell Mastery

Every time a crawler casts a spell, their **cast count** increases. Reaching cast count thresholds levels up the spell, reducing its mana cost:

| Mastery Level | Cast Count Required | Mana Discount |
|---------------|---------------------|---------------|
| 1 | 10 | −5% of base |
| 2 | 30 | −10% of base |
| 3 | 60 | −15% of base |
| 4 | 100 | −20% of base |

The reduction per level is **ceil(base cost × 5%)**, stacked per mastery level. Mana cost never goes below 0.

## Mastery Example

A spell with a base mana cost of **20**:
- **Mastery 1** (10 casts): discount = ceil(20 × 0.05) = 1 → effective cost = **19**
- **Mastery 2** (30 casts): discount = 1 × 2 = 2 → effective cost = **18**
- **Mastery 3** (60 casts): discount = 1 × 3 = 3 → effective cost = **17**
- **Mastery 4** (100 casts): discount = 1 × 4 = 4 → effective cost = **16**`,
  },
  {
    id: 'spell-properties',
    slug: 'spell-properties',
    title: 'Spell Properties',
    category: 'Spells',
    order: 3,
    content: `# Spell Properties

Each spell has the following configurable properties:

| Field | Description |
|-------|-------------|
| **Mana Cost** | Mana consumed per cast (0 = free) |
| **Spell Level** | D&D-style level 1–9 |
| **School** | Evocation, Necromancy, Illusion, etc. |
| **Action Type** | Action, Bonus Action, or Reaction |
| **Range** | Feet, Self, or Touch |
| **Target** | Single, Area, Self, or Multiple |
| **Area of Effect** | Shape (sphere/cone/line/cube) and size in feet |
| **Damage Dice** | One or more dice (e.g., 2d6 + 1d4) |
| **Damage Type** | Fire, Poison, Healing, Spiritual, etc. |
| **Hit Die** | Bonus die added to the spell attack roll |
| **Hit Modifiers** | Stat bonuses applied to hit roll (STR/DEX/CON/INT/CHA) |
| **Damage Modifiers** | Stat bonuses applied to damage roll |
| **Duration** | Combat turns, noncombat turns, or a custom label |
| **Grants Language** | Casting it lets the caster use a language for the spell's duration (see [Languages](/wiki/languages)) |
| **Questions** | With Grants Language: how many lines the caster can say in it per casting (Speak with Dead: 5) |
| **Saving Throw** | Which stat the target rolls to resist |
| **Splash Damage** | Whether the spell can hit multiple targets |
| **Special Effect** | Free-text description of any on-hit effects |
| **Effect on Targets** | A condition (like Burning or Stunned) the spell puts on each target in combat, how many of the target's turns it lasts, what it does, and optional damage or healing dice rolled each turn (see [Spell Effects](/wiki/spell-effects)) |
| **Can Target Self** | Whether the caster can target themselves |
| **Reaction Trigger** | *(Reaction spells only)* What event triggers the reaction |

## Damage Types

Spells can deal one of the following damage types:

Fire, Cold, Lightning, Poison, Acid, Necrotic, Radiant, Psychic, Thunder, Force, Spiritual, or **Healing** (restores HP instead of dealing damage).

## Area of Effect Shapes

| Shape | Description |
|-------|-------------|
| **Sphere** | Radiates outward from a point |
| **Cone** | Fans out from the caster |
| **Line** | Extends in a straight line from the caster |
| **Cube** | Fills a cubic area |`,
  },
  {
    id: 'spell-effects',
    slug: 'spell-effects',
    title: 'Spell Effects',
    category: 'Spells',
    order: 3.5,
    content: `# Spell Effects

A spell can leave an **effect** on the creatures it hits, like Burning, Poisoned, Stunned or Blessed. Effects work during combat, where they count down turn by turn.

## Setting Up an Effect

In the spell editor, tick **Puts an effect on targets**, then set:

- **Condition**: pick a preset (Burning, Poisoned, Bleeding, Frozen, Stunned, Paralyzed, Blinded, Charmed, Frightened, Slowed, Restrained, Prone, Silenced, Blessed, Shielded, Hasted, Regenerating) or type your own
- **Lasts**: how many of the target's turns it lasts
- **What it does**: plain words shown on the badge, like "Disadvantage on attacks"
- **Each turn** *(optional)*: damage or healing dice rolled automatically at the start of each of the target's turns, like 1d6 fire for Burning or 1d4 healing for Regenerating

## How Effects Land

- **Damage spells**: when you apply the damage, the effect goes on the same target (or every splash target)
- **Healing spells**: the effect goes on each crawler you heal
- **Effect-only spells** (no dice): casting opens a target picker; pick who it lands on and press Apply
- **Self spells**: the effect goes straight onto the caster

Casting the same spell on a target again refreshes its effect instead of stacking a second copy. Outside combat, spells roll as usual but don't leave effects.

## During Combat

- Effects show as small badges under each portrait in the combat order bar above the Show Time map, with the turns left. Hover a badge to see the spell, caster and what it does
- Damage or healing over time rolls at the start of the affected creature's turn and posts to the dice history. A mob brought to 0 HP this way is looted like any other kill
- At the end of the creature's turn its effects count down by one, and wear off at zero
- The DM can remove an effect early (a passed saving throw, a dispel) with the ✕ on its badge
- Effects end when combat ends, and **Undo Turn** puts them back the way they were at the start of the turn

Effects don't change rolls or skip turns by themselves; the badge tells everyone what applies, and the DM rules on it.`,
  },
  {
    id: 'spell-tomes',
    slug: 'spell-tomes',
    title: 'Spell Tomes',
    category: 'Spells',
    order: 4,
    content: `# Spell Tomes

Spell Tomes are **consumable inventory items** that teach a crawler a spell when used.

## Using a Spell Tome

When a crawler **Uses** a tome from their inventory:
1. The tome is removed from their inventory
2. They learn the spell contained in the tome

If the crawler already knows the spell, the tome is **not consumed** and a warning is shown.

## Types of Spell Tomes

Tomes can contain either:

- **Library spell**: A spell selected from the shared spell library. The tome references the library spell by ID.
- **Custom spell**: A one-off spell designed specifically for that tome. The spell data is embedded directly in the tome item.

## Promoting Custom Spells

DMs can **promote** a custom spell (from a tome) to the shared library from Vernon's Library. This makes the spell available for all crawlers to learn and for DMs to grant directly.

## Creating Spell Tomes (DM)

DMs create spell tomes from the **Inventory** page:
1. Create a new item and set its type to **Spell Tome**
2. Choose an existing library spell or design a custom spell
3. Add the tome to a crawler's inventory or place it in a loot box`,
  },
  {
    id: 'sharing-spells',
    slug: 'sharing-spells',
    title: 'Sharing Spells',
    category: 'Spells',
    order: 5,
    content: `# Sharing Spells

Authenticated players can **share spells publicly** so other players across all campaigns can discover and use them.

## Privacy Controls

- **Creator attribution**: every spell shows who created it ("by username")
- **Privacy toggle**: if you created a spell, a **globe/lock** button appears when the spell is expanded — click it to make it public or private. Spells are **private by default**.

## Community Spells

If you have [Public Content](/wiki/public-content) enabled in Account Settings, a **Community Spells** panel appears at the bottom of Vernon's Library showing public spells from other players.

DMs can add any community spell to their campaign library with the **+** button. The spell is copied into your campaign's library and can be freely edited without affecting the original.

## Best Practices

- Give your spells **descriptive names** so other players can find them
- Write clear **descriptions** explaining what the spell does narratively
- Fill in all relevant **spell data fields** so the mechanics are complete
- Use **tags** to help categorize spells (e.g., "fire", "healing", "buff")`,
  },
  {
    id: 'public-content',
    slug: 'public-content',
    title: 'Public Content & Sharing',
    category: 'Accounts',
    order: 6,
    content: `# Public Content & Sharing

Players can share inventory items and spells, and DMs can share maps, mob types and whole episodes, so other players across all campaigns can discover and use them. This system is opt-in — public content is disabled by default.

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

## Sharing Maps, Mobs & Episodes (DMs)

In the **Dungeon AI — DM Console**, each map, mob and episode you made has the same 🔒 **Private** / 🌐 **Public** toggle:

- **Maps tab** — the toggle sits next to each map's name.
- **Mobs tab** — shares the **mob type** (name, image, stats, weaknesses, default inventory). Where you placed it on your maps is not shared.
- **Episodes tab** — shares the episode as a complete, playable custom adventure: its maps, the mob types it uses, where each mob is placed, per-map settings, its loot boxes, and its quests (rewards and action items included).

Sharing an episode takes a **snapshot**. If you edit it afterwards, click **Update Shared Copy** to publish the new version.

What is *not* shared from an episode: your crawlers and where they stand, fog of war you've already revealed, mob HP left over from combat, and quest progress — who a quest is assigned to, which rewards were claimed, which action items were completed, and players' quest notes.

Content you added from the community keeps its original creator's "by username" badge and can't be re-shared by you.

## Share All My Content (DMs)

The **Share all my content** button at the top of the DM Console shares everything you made in the current campaign in one go: library items, spells, maps, mob types and episodes. It first shows how many of each will be shared and asks you to confirm.

- Anything already public is skipped.
- Items and spells made before creator tracking existed have no creator yet. The button credits them to you, the campaign's DM, so they get a 🌐 toggle like your other content.
- Content created by other players, and content you added from the community, is never touched.
- Episodes with no maps are skipped, the same as with the episode toggle.

## Adding Community Maps, Mobs & Episodes

With **Show Public Content** on, the DM Console shows **Community Maps**, **Community Mobs** and **Community Episodes** at the bottom of each tab:

- **Add** copies a map or mob type into your campaign.
- **Add to Campaign** on an episode copies the episode plus its maps, mob types, loot boxes and quests, ready to run in Show Time. Quests arrive unassigned — assign them to crawlers from Show Time as usual. Mobs start unencountered and fog of war starts fresh.

Copies are independent: editing or deleting your copy doesn't affect the original, and the creator can't change your copy.

## Enabling Public Content

To see content shared by other players:

1. Go to the **Campaign Selection** screen.
2. Open **Account Settings** (bottom of the page).
3. Toggle **Show Public Content** on.
4. Confirm the **age warning** — community content is user-generated and has not been moderated.

Once enabled:
- A **Community Items** section appears in the Inventory page's Item Library.
- A **Community Spells** panel appears in the Spell Library.
- **Community Maps**, **Community Mobs** and **Community Episodes** appear in the DM Console.

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
  {
    id: 'pixel-icons',
    slug: 'pixel-icons',
    title: 'Pixel Icons & Mob Portraits',
    category: 'Game Mechanics',
    order: 13,
    content: `# Pixel Icons & Mob Portraits

Every new item in the **Item Library**, every new spell in the **Spell Library**, and every item you add to **My Content** gets a pixel-art icon automatically. You don't need to do anything.

## How an Icon Is Picked

1. **Generated** — the app sends the item or spell's name, description, slot, weapon type, damage type or spell school to an AI image generator and turns the picture into a small 48×48 pixel icon. The background is removed and the icon is cropped to the object, so it sits on the page like the other icons. This takes a few seconds; the icon appears once it's ready.
2. **Matched from the icon library** — the generator is free but has a daily limit (it resets at midnight UTC). When it runs out, the app instead picks the closest icon from every icon made before, using descriptor tags. For example a new "Ember Katana" reuses the icon of a "Flaming Longsword" (sword + fire), and an "Elixir of Mending" reuses a "Healing Potion" icon. A short message tells you when this happens, and a different message appears if the generator itself has a problem.

If nothing in the library is related, the item keeps its normal slot icon.

## Regenerating an Icon

Don't like an icon? Edit the item in the **Item Library** (or the spell in the **Spell Library**) and click **Regenerate icon** at the top of the edit form. A new icon is made from the current name and description, so you can tweak the description first to steer it. Click **Save** to keep it. Each new icon uses one of the day's free generations.

## Mob Portraits (DMs)

New mob types can get a 128×128 pixel-art portrait too, used as their map token and on the Mob Profiles page.

- In the **DM Console → Mobs** tab, leave **Auto-generate pixel portrait** ticked and don't upload an image. When you click **Add Mob**, the app paints a portrait from the mob's name, description, strengths, weaknesses, level and boss setting.
- To make a portrait for an existing mob, open it for editing and click **Generate**, then save.
- An image you upload always wins and is never replaced.
- Every copy of a creature on the map (Goblin A, B, C) shares the creature's portrait. A character linked to a creature, like Grimble the Goblin, gets his own portrait.
- When the daily limit is used up, a character uses his creature's portrait, and anything else gets the closest earlier mob portrait (a new Hobgoblin reuses the Goblin portrait). If nothing fits, the mob is added without an image and you can click Generate the next day.

## The Icon Library

Every generated icon is saved to one shared icon library with tags such as *sword*, *fire*, *potion*, *healing*, *ice* or *death*. The library is shared across all campaigns, so the more icons people create, the better the matches get when the daily limit is reached.

## Notes

- Icons are generated only for players signed in with Google. Guests still get matched icons.
- Copying an item or spell from public content or My Content keeps its icon.
- Crawler copies of a library item show the library item's icon.`,
  },
];
