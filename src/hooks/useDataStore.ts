import { useState, useEffect, useCallback } from 'react';
import type { CollectionName, PersistedItem } from '../types/collections';

interface DataStore {
  [collectionName: string]: any[];
}

/**
 * Generic Data Store Hook - HANDLES ALL PERSISTENCE
 * 
 * ⚠️ IMPORTANT: Always use this hook for user-created data!
 * 
 * @example
 * ```typescript
 * const { getCollection, addItem, updateItem, deleteItem } = useGame();
 * 
 * // Get any collection
 * const quests = getCollection('quests');
 * 
 * // Add new data - automatically saved!
 * addItem('quests', { id: '1', name: 'Find the dragon' });
 * 
 * // Update - automatically saved!
 * updateItem('quests', '1', { completed: true });
 * 
 * // Delete - automatically saved!
 * deleteItem('quests', '1');
 * ```
 * 
 * See docs/DATA_PERSISTENCE.md for full guide.
 */
interface UseDataStoreReturn {
  data: DataStore;
  loading: boolean;
  error: string | null;
  addItem: (collection: CollectionName, item: any) => void;
  updateItem: (collection: CollectionName, id: string, updates: any) => void;
  deleteItem: (collection: CollectionName, id: string) => void;
  getCollection: <T = any>(collection: CollectionName) => T[];
  setCollection: (collection: CollectionName, items: any[]) => void;
  isLoaded: boolean;
}

const STORAGE_KEY = 'dcc_game_data';
const API_BASE = import.meta.env.VITE_SOUND_API_BASE || import.meta.env.VITE_SOUND_SERVER_BASE || '';

export function useDataStore(): UseDataStoreReturn {
  const [data, setData] = useState<DataStore>({});
  const [loading, setLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log(`[DataStore] Loading data from server: ${API_BASE}/api/game/load`);
      const response = await fetch(`${API_BASE}/api/game/load`);
      console.log(`[DataStore] Server response status: ${response.status}`);
      
      if (response.ok) {
        const serverData = await response.json();
        console.log('[DataStore] ✅ Loaded from server:', Object.keys(serverData || {}));
        if (serverData) {
          setData(serverData);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
          setIsLoaded(true);
          setLoading(false);
          return;
        }
      }
      
      // Fallback to localStorage
      console.log('[DataStore] Trying localStorage fallback...');
      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        console.log('[DataStore] ✅ Loaded from localStorage');
        setData(JSON.parse(localData));
      } else {
        console.log('[DataStore] No existing data, starting fresh');
        setData({});
      }
    } catch (err) {
      console.error('[DataStore] ❌ Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      
      // Try localStorage as fallback
      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        console.log('[DataStore] Recovered from localStorage after error');
        setData(JSON.parse(localData));
      }
    } finally {
      setIsLoaded(true);
      setLoading(false);
    }
  };

  const saveData = async (newData: DataStore) => {
    if (!isLoaded) return; // Don't save during initial load
    
    try {
      console.log('[DataStore] 💾 Saving data...', {
        collections: Object.keys(newData),
        counts: Object.fromEntries(
          Object.entries(newData).map(([key, val]) => [key, Array.isArray(val) ? val.length : 'not-array'])
        )
      });
      
      // For localStorage, exclude large data like maps (which contain base64 images)
      // to avoid quota errors. Server is the primary storage.
      const { maps, ...dataForLocalStorage } = newData;
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataForLocalStorage));
        console.log('[DataStore] ✅ Saved to localStorage (excluding maps)');
      } catch (storageErr) {
        console.warn('[DataStore] ⚠️ localStorage save failed (quota exceeded), relying on server:', storageErr);
        // Continue anyway - server is more important
      }
      
      // Save to server (includes everything, including maps)
      const response = await fetch(`${API_BASE}/api/game/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });

      if (!response.ok) {
        console.error('[DataStore] ❌ Server save failed with status:', response.status);
        const errorText = await response.text();
        console.error('[DataStore] Error details:', errorText);
        setError(`Server save failed: ${response.status}`);
      } else {
        console.log('[DataStore] ✅ Saved to server successfully');
      }
    } catch (err) {
      console.error('[DataStore] ❌ Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save data');
    }
  };

  // Auto-save whenever data changes
  useEffect(() => {
    if (isLoaded && Object.keys(data).length > 0) {
      saveData(data);
    }
  }, [data, isLoaded]);

  const addItem = useCallback((collection: string, item: any) => {
    setData(prevData => ({
      ...prevData,
      [collection]: [...(prevData[collection] || []), item]
    }));
  }, []);

  const updateItem = useCallback((collection: string, id: string, updates: any) => {
    setData(prevData => {
      const items = prevData[collection] || [];
      return {
        ...prevData,
        [collection]: items.map(item => 
          item.id === id ? { ...item, ...updates } : item
        )
      };
    });
  }, []);

  const deleteItem = useCallback((collection: string, id: string) => {
    setData(prevData => {
      const items = prevData[collection] || [];
      return {
        ...prevData,
        [collection]: items.filter(item => item.id !== id)
      };
    });
  }, []);

  const getCollection = useCallback((collection: string) => {
    return data[collection] || [];
  }, [data]);

  const setCollection = useCallback((collection: string, items: any[]) => {
    setData(prevData => ({
      ...prevData,
      [collection]: items
    }));
  }, []);

  return {
    data,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    getCollection,
    setCollection,
    isLoaded
  };
}
