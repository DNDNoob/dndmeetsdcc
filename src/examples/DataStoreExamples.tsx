/**
 * GUIDE: Adding New Data Types
 * 
 * The new data persistence system makes it trivial to add new data types.
 * No need to modify useGameState or add new endpoints!
 * 
 * Example: Adding Quests
 */

import { useGame } from '@/contexts/GameContext';

interface Quest {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
}

export function QuestManager() {
  const { getCollection, addItem, updateItem, deleteItem } = useGame();
  
  // Get quests - automatically persisted!
  const quests = getCollection('quests') as Quest[];
  
  // Add a new quest
  const createQuest = (questData: Omit<Quest, 'id'>) => {
    const newQuest: Quest = {
      id: crypto.randomUUID(),
      ...questData
    };
    addItem('quests', newQuest); // That's it! Auto-saved to server & localStorage
  };
  
  // Update a quest
  const completeQuest = (questId: string) => {
    updateItem('quests', questId, { completed: true });
  };
  
  // Delete a quest
  const removeQuest = (questId: string) => {
    deleteItem('quests', questId);
  };
  
  return { quests, createQuest, completeQuest, removeQuest };
}

/**
 * More Examples:
 */

// NPCs
interface NPC {
  id: string;
  name: string;
  dialogue: string[];
  location: string;
}

export function useNPCs() {
  const { getCollection, addItem } = useGame();
  const npcs = getCollection('npcs') as NPC[];
  
  const addNPC = (npc: Omit<NPC, 'id'>) => {
    addItem('npcs', { id: crypto.randomUUID(), ...npc });
  };
  
  return { npcs, addNPC };
}

// Spells
interface Spell {
  id: string;
  name: string;
  manaCost: number;
  damage: number;
  description: string;
}

export function useSpells() {
  const { getCollection, addItem } = useGame();
  const spells = getCollection('spells') as Spell[];
  
  const addSpell = (spell: Omit<Spell, 'id'>) => {
    addItem('spells', { id: crypto.randomUUID(), ...spell });
  };
  
  return { spells, addSpell };
}

/**
 * BENEFITS:
 * 
 * ✅ Zero configuration - just use a collection name
 * ✅ Automatic persistence to server and localStorage
 * ✅ Type-safe with TypeScript interfaces
 * ✅ No backend changes needed
 * ✅ Works with existing crawlers, mobs, maps, inventory
 * ✅ Easy to test and maintain
 * 
 * MIGRATION NOTES:
 * 
 * - useGameState still works (backward compatible)
 * - New features can use useGame() directly
 * - Data structure is identical on server
 * - All saves/loads happen automatically
 */
