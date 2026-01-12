# Feature Testing Guide

This document provides step-by-step testing instructions for all implemented features.

## Prerequisites
1. Start the development server: `npm run dev`
2. Open browser to `http://localhost:5173`
3. Log in as "Dungeon AI" (password: `DND_IS_LIFE!`)

## Feature Tests

### 1. Grid Overlay Visibility and Controls ✅

**Episode Editor:**
1. Navigate to DM Console > Episodes tab
2. Create a new episode or edit existing one
3. In the mob placement editor, click "Grid Off" button
4. Verify semi-transparent GREY grid appears over the map
5. Verify grid resize slider appears in bottom-right corner
6. Move slider and verify grid cell size changes (20-100px)
7. Click "Grid On" to hide grid

**Show Time Page:**
1. Navigate to Show Time
2. Select an episode and map
3. Click "Grid Off" button in DM controls
4. Verify grey grid overlay appears
5. Verify grid resize controls appear
6. Test grid size adjustment
7. Toggle grid off

### 2. Circular Mob Tokens on Show Time ✅

1. Create an episode with mob placements
2. Navigate to Show Time and load the episode
3. Display one or more mobs on the map
4. Verify mob tokens on the map are CIRCULAR (not square)
5. Verify they have rounded borders and proper image positioning
6. Check both mobs with images and without images

### 3. Drag and Move Mobs on Show Time (DM Only) ✅

1. As DM, load an episode on Show Time
2. Display mobs on the map
3. Hover over a mob token - cursor should change to "grab"
4. Click and drag a mob token
5. Verify mob moves with cursor
6. Release mouse - mob should stay in new position
7. Cursor should change to "grabbing" while dragging
8. Verify mobs stay within map bounds

### 4. Improved Image Compression ✅

**Mob Images:**
1. Navigate to DM Console > Mobs tab
2. Upload a large image (>1MB) for a new mob
3. Check browser console for compression log
4. Verify format: "Image compressed: XXXkb → YYYkb (quality: 0.X)"
5. Verify mob image displays correctly
6. Confirm no "Image too large; stripping before save" errors

**Map Images:**
1. Navigate to DM Console > Maps tab
2. Upload a large map image (>2MB)
3. Check console for compression log
4. Verify map displays correctly
5. Verify map can be used in episodes

### 5. Duplicate Mob Tokens ✅

1. Navigate to DM Console > Episodes tab
2. Create or edit an episode
3. In mob placement editor, click "Available Mobs" section
4. Click same mob multiple times
5. Verify multiple instances appear in "Placed Mobs" section
6. Verify each instance can be positioned independently
7. Test on Show Time - display multiple instances of same mob

### 6. Multi-Map Mob Token Placement ✅

1. Navigate to DM Console > Episodes tab
2. Create episode with 2+ maps selected
3. In mob placement area, verify map selector dropdown appears
4. Select different maps from dropdown
5. Verify background map changes
6. Place mobs on different maps
7. Verify placement counter shows correct map number

### 7. Full Episode Editing ✅

1. Navigate to DM Console > Episodes tab
2. Find existing episode and click "Edit"
3. Verify you can edit:
   - Episode name
   - Episode description
   - Map selection (checkboxes)
   - Mob placements (via visual editor)
4. Change the maps selection
5. Add/remove mob placements
6. Click "Save"
7. Verify all changes persist
8. Load episode in Show Time to confirm changes

### 8. Login Name Display Fix ✅

1. Start at splash screen
2. Select a crawler character (e.g., "Carl")
3. Verify top-left shows "Carl" on main menu
4. Navigate to any page
5. Verify navigation bar shows "Carl" (not "Dungeon AI")
6. Log in as Dungeon AI
7. Verify top shows "DUNGEON AI"
8. Navigate to any page
9. Verify navigation bar shows "DUNGEON AI"
10. Logout from Dungeon AI
11. Verify name reverts to previous character

### 9. Mob Card Controls (Show Time) ✅

**As Player (non-admin):**
1. Log in as a crawler character
2. Navigate to Show Time (wait for DM to start episode)
3. When mob cards appear in bottom-right
4. Verify collapse/expand button (⬆/⬇) is present
5. Verify close button (✕) is NOT present
6. Test collapse/expand functionality

**As DM (admin):**
1. Log in as Dungeon AI
2. Navigate to Show Time and start episode
3. Display mobs
4. Verify mob cards have both collapse AND close buttons
5. Test both buttons work correctly

### 10. Map Manager Editing ✅

1. Navigate to DM Console > Maps tab
2. Upload a map if none exist
3. Find a map and click the edit icon (pencil)
4. Type a new name
5. Click checkmark to save
6. Verify name persists after page refresh
7. Verify map name appears in episode creation

## Regression Testing

After completing feature tests, verify these existing features still work:

1. **Episode Creation**: Create new episode from scratch
2. **Mob Creation**: Add new mob with all fields
3. **Map Upload**: Upload new map image
4. **Firebase Sync**: Changes sync across browser tabs/windows
5. **Dice Roller**: Dice roller still works
6. **Sound Effects**: Sound system functional
7. **Multiplayer**: Room creation and joining works

## Known Limitations

1. Mob positions on Show Time are session-only (not saved back to episode)
2. Grid size preference is per-session (not saved)
3. Image compression is aggressive - very large images may lose some quality

## Bug Reporting

If any feature fails:
1. Note the exact steps to reproduce
2. Check browser console for errors
3. Note browser and OS version
4. Take screenshot if visual issue
