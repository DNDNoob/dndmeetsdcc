#!/usr/bin/env node

/**
 * Test script to validate DungeonAIView component structure
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src/views/DungeonAIView.tsx');

try {
  const content = readFileSync(filePath, 'utf8');
  
  console.log('🧪 Testing DungeonAIView component...\n');
  
  const tests = [
    {
      name: 'Component imports',
      check: () => content.includes('import') && content.includes('from "react"')
    },
    {
      name: 'Props interface defined',
      check: () => content.includes('interface DungeonAIViewProps')
    },
    {
      name: 'Component function declaration',
      check: () => content.includes('const DungeonAIView: React.FC<DungeonAIViewProps>')
    },
    {
      name: 'Episode state management',
      check: () => {
        return content.includes('newEpisodeName') && 
               content.includes('editingEpisodeId') &&
               content.includes('selectedMapsForEpisode');
      }
    },
    {
      name: 'Episode handlers',
      check: () => {
        return content.includes('handleCreateEpisode') &&
               content.includes('handleStartEditEpisode') &&
               content.includes('handleSaveEditEpisode');
      }
    },
    {
      name: 'Episodes tab conditional render',
      check: () => content.includes('activeTab === "episodes"')
    },
    {
      name: 'Create/Edit form toggle',
      check: () => {
        return content.includes('editingEpisodeId && editingEpisode') &&
               content.includes('Create Episode') &&
               content.includes('Edit Episode');
      }
    },
    {
      name: 'Map selection for episodes',
      check: () => content.includes('handleToggleMapForEpisode')
    },
    {
      name: 'Mob placement editor',
      check: () => content.includes('MapMobPlacementEditor')
    },
    {
      name: 'Episode list rendering',
      check: () => content.includes('episodes.map')
    },
    {
      name: 'Component export',
      check: () => content.includes('export default DungeonAIView')
    },
    {
      name: 'No syntax errors (basic check)',
      check: () => {
        // Check for common syntax issues
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        
        return openBraces === closeBraces && openParens === closeParens;
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      if (test.check()) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Results: ${passed}/${tests.length} tests passed`);
  
  if (failed === 0) {
    console.log('✨ All structural tests passed!\n');
    process.exit(0);
  } else {
    console.log(`⚠️  ${failed} test(s) failed\n`);
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
  process.exit(1);
}
