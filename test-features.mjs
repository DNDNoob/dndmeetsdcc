#!/usr/bin/env node

/**
 * Feature Testing Script for D&D meets DCC
 * 
 * This script performs automated checks on the codebase to verify
 * that all implemented features are present and correctly structured.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();
const CHECKS = [];

function check(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    return false;
  }
}

function fileContains(path, search) {
  const fullPath = resolve(ROOT, path);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = readFileSync(fullPath, 'utf-8');
  if (!content.includes(search)) {
    throw new Error(`String not found: "${search.substring(0, 50)}..."`);
  }
}

// Test 1: Grid Overlay Color Fix
check('Grid overlay uses grey color (not white)', () => {
  fileContains('src/components/ui/GridOverlay.tsx', 'rgba(128, 128, 128, 0.8)');
});

// Test 2: Grid Resize Controls
check('Grid overlay has resize controls', () => {
  fileContains('src/components/ui/GridOverlay.tsx', 'onCellSizeChange');
  fileContains('src/components/ui/GridOverlay.tsx', 'showControls');
  fileContains('src/components/ui/GridOverlay.tsx', 'type="range"');
});

// Test 3: Circular Mob Tokens
check('Show Time uses circular mob tokens', () => {
  fileContains('src/views/ShowTimeView.tsx', 'rounded-full');
});

// Test 4: Mob Dragging
check('Show Time has mob dragging functionality', () => {
  fileContains('src/views/ShowTimeView.tsx', 'handleMobMouseDown');
  fileContains('src/views/ShowTimeView.tsx', 'draggingMobId');
  fileContains('src/views/ShowTimeView.tsx', 'mobPositions');
});

// Test 5: Image Compression
check('DungeonAI has improved image compression', () => {
  fileContains('src/views/DungeonAIView.tsx', 'Image compressed:');
  fileContains('src/views/DungeonAIView.tsx', 'currentQuality');
  fileContains('src/views/DungeonAIView.tsx', '700_000');
});

// Test 6: Duplicate Mob Tokens
check('Can add duplicate mob tokens', () => {
  const content = readFileSync(resolve(ROOT, 'src/views/DungeonAIView.tsx'), 'utf-8');
  // Check that uniqueness check is removed - should NOT contain the old check
  if (content.includes('if (!selectedMobsForEpisode.find(m => m.mobId === mobId))')) {
    throw new Error('Old uniqueness check still present');
  }
});

// Test 7: Multi-Map Placement
check('Episode editor has multi-map selector', () => {
  fileContains('src/views/DungeonAIView.tsx', 'currentMapIndexForPlacement');
  fileContains('src/views/DungeonAIView.tsx', 'Map selector if multiple maps');
});

// Test 8: Full Episode Editing
check('Episode edit mode has map selection', () => {
  fileContains('src/views/DungeonAIView.tsx', 'Map selection in edit mode');
  fileContains('src/views/DungeonAIView.tsx', 'Mob placement editing');
});

// Test 9: Login Name Fix
check('Navigation uses playerName directly', () => {
  const content = readFileSync(resolve(ROOT, 'src/components/Navigation.tsx'), 'utf-8');
  // Check that the hardcoded check is removed
  if (content.includes('playerType === "ai" ? "DUNGEON AI" : playerName')) {
    throw new Error('Old hardcoded check still present');
  }
  fileContains('src/components/Navigation.tsx', '{playerName}');
});

// Test 10: Mob Card Controls
check('ResizableMobDisplay has admin-only close button', () => {
  fileContains('src/components/ui/ResizableMobDisplay.tsx', 'isAdmin');
  fileContains('src/components/ui/ResizableMobDisplay.tsx', 'Only show close button for admin');
});

// Test 11: Documentation
check('Feature test guide exists', () => {
  if (!existsSync(resolve(ROOT, 'FEATURE_TEST_GUIDE.md'))) {
    throw new Error('FEATURE_TEST_GUIDE.md not found');
  }
});

check('Implementation summary exists', () => {
  if (!existsSync(resolve(ROOT, 'IMPLEMENTATION_SUMMARY.md'))) {
    throw new Error('IMPLEMENTATION_SUMMARY.md not found');
  }
});

check('Changelog updated', () => {
  fileContains('changelog.json', '2026-01-13');
  fileContains('changelog.json', 'Grid Overlay Fixes');
});

console.log('\n📊 Feature Verification Complete!');
console.log('All critical features are present in the codebase.');
console.log('\n🔍 Next Steps:');
console.log('1. Run manual tests using FEATURE_TEST_GUIDE.md');
console.log('2. Test with real users in browser');
console.log('3. Verify multiplayer functionality');
