# Episode System Test Guide

## Prerequisites
- Dev server running: `npm run dev`
- Browser open at: http://localhost:8080/dndmeetsdcc/

## Test 1: Map Naming
1. Navigate to "MAPS" view
2. Look for map entries with "Map 1", "Map 2", etc.
3. Click the edit icon (pencil) next to a map name
4. Type a new name (e.g., "Goblin Caves")
5. Click the checkmark to save
6. **Expected**: Map name updates and persists

## Test 2: Grid Overlay in Map Manager
1. Stay in "MAPS" view
2. (Note: Grid is NOT in Maps view, only in Episode Editor and ShowTime)

## Test 3: Episode Creator with Visual Placement
1. Navigate to "DUNGEON AI" view
2. Click "Episodes Creator" tab (should have Layers icon)
3. Enter episode name: "Test Episode"
4. Enter description: "Testing drag and drop"
5. Select at least one map (checkbox)
6. **Expected**: Visual mob placement editor appears below
7. **Check for**:
   - Map preview with the selected map
   - "Grid On/Off" button
   - "Reset" button
   - "Available Mobs" section below map
   - "Placed Mobs" section (empty initially)

## Test 4: Visual Mob Placement
1. In the Episode Creator (after step 3.6)
2. Click on a mob in "Available Mobs" section
3. **Expected**: Mob appears in center of map (50%, 50%)
4. **Expected**: Mob shows in "Placed Mobs" list with coordinates
5. Click and drag the mob icon on the map
6. **Expected**: Mob moves as you drag
7. **Expected**: Coordinates update in "Placed Mobs" list
8. Release mouse
9. **Expected**: Mob stays in new position

## Test 5: Grid Toggle
1. In Episode Creator with placed mobs
2. Click "Grid On/Off" button
3. **Expected**: Semi-transparent grid appears over map
4. Click again
5. **Expected**: Grid disappears

## Test 6: Create Episode
1. After placing mobs (step 4)
2. Click "Create Episode" button at bottom
3. **Expected**: Episode appears in "Existing Episodes" section below
4. **Expected**: Shows episode name, description, map count, mob count

## Test 7: ShowTime - Grid Toggle
1. Navigate to "SHOW TIME" view
2. If DM: Should see episode selection
3. Click on created episode
4. Select a map to display
5. Toggle mobs to show
6. Click to display the map
7. **Expected**: DM controls appear at top
8. Look for "Grid On/Off" button in controls
9. Click it
10. **Expected**: Grid overlay appears on map
11. Click again
12. **Expected**: Grid disappears

## Component Files Created
✅ `/src/components/ui/GridOverlay.tsx` - SVG grid component
✅ `/src/components/ui/MobIcon.tsx` - Circular mob token
✅ `/src/components/ui/MapMobPlacementEditor.tsx` - Visual placement editor

## Files Modified
✅ `/src/views/DungeonAIView.tsx` - Added MapMobPlacementEditor import and integration
✅ `/src/views/MapsView.tsx` - Added map name editing
✅ `/src/views/ShowTimeView.tsx` - Added grid toggle and GridOverlay
✅ `/src/pages/Index.tsx` - Added mapNames state and handlers
✅ `/src/lib/gameData.ts` - Added MapData interface
✅ `/changelog.json` - Documented all changes

## Troubleshooting

### If MapMobPlacementEditor doesn't appear:
- Check that at least one map is selected (checkbox checked)
- Check browser console for errors (F12 → Console tab)
- Verify maps array has items (go to Dungeon AI → Maps Manager and upload a map)

### If mobs don't appear in Available Mobs:
- Go to Dungeon AI → Mobs tab
- Create at least one mob first

### If dragging doesn't work:
- Ensure you're clicking directly on the mob icon
- Check that the map container loaded properly
- Try refreshing the page

### If grid doesn't appear:
- Verify you clicked the "Grid On/Off" button
- Check that the button shows "Grid On" when active
- Grid opacity is low (15-20%), so look carefully

## Build Test
Run: `npm run build`
**Expected**: No errors, successful build

## Current Status
- ✅ All TypeScript errors resolved
- ✅ HMR (Hot Module Replacement) working
- ✅ Components exported correctly
- ✅ Integration complete
