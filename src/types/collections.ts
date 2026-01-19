/**
 * Valid collection names for the DataStore
 * 
 * Add new collection names here when creating new data types.
 * This provides autocomplete and type safety.
 */
export type CollectionName = 
  | 'crawlers'
  | 'mobs'
  | 'maps'
  | 'inventory'
  | 'episodes'
  | 'soundEffects'
  // Add new collections below:
  | 'quests'
  | 'npcs'
  | 'spells'
  | 'items'
  | 'encounters'
  | string; // Allow any string for flexibility

/**
 * Base interface all persisted items should extend
 */
export interface PersistedItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}
