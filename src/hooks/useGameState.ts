import { useMemo } from "react";
import {
  Crawler,
  InventoryItem,
  Mob,
  defaultCrawlers,
  defaultInventory,
  defaultMobs,
} from "@/lib/gameData";
import { useGame } from "@/contexts/GameContext";

interface InventoryEntry {
  crawlerId: string;
  items: InventoryItem[];
}

export const useGameState = () => {
  const { 
    getCollection, 
    setCollection, 
    addItem, 
    updateItem, 
    deleteItem,
    isLoaded 
  } = useGame();

  // Get collections with defaults
  const crawlers = useMemo(() => {
    const stored = getCollection('crawlers') as Crawler[];
    if (!isLoaded || stored.length === 0) return defaultCrawlers;
    return stored;
  }, [getCollection('crawlers'), isLoaded]);

  const inventory = useMemo(() => {
    const stored = getCollection('inventory') as InventoryEntry[];
    if (!isLoaded || stored.length === 0) return defaultInventory;
    return stored;
  }, [getCollection('inventory'), isLoaded]);

  const mobs = useMemo(() => {
    const stored = getCollection('mobs') as Mob[];
    if (!isLoaded || stored.length === 0) return defaultMobs;
    return stored;
  }, [getCollection('mobs'), isLoaded]);

  const maps = useMemo(() => {
    return getCollection('maps') as string[];
  }, [getCollection('maps'), isLoaded]);

  // Calculate party gold as sum of all crawler gold
  const partyGold = useMemo(() => {
    return crawlers.reduce((sum, c) => sum + (c.gold || 0), 0);
  }, [crawlers]);

  // Helper functions that work with the new data store
  const setCrawlers = (newCrawlers: Crawler[]) => {
    setCollection('crawlers', newCrawlers);
  };

  const setInventory = (newInventory: InventoryEntry[]) => {
    setCollection('inventory', newInventory);
  };

  // Remove undefined fields before sending to Firestore
  const stripUndefinedDeep = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj
        .map((v) => (typeof v === 'object' && v !== null ? stripUndefinedDeep(v) : v))
        .filter((v) => v !== undefined);
    }
    if (typeof obj === 'object') {
      const out: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        out[key] = typeof value === 'object' && value !== null ? stripUndefinedDeep(value) : value;
      }
      return out;
    }
    return obj;
  };

  const setMobs = async (newMobs: Mob[]) => {
    // Persist changes to Firestore by diffing existing vs new
    const existingMobs = getCollection('mobs') as Mob[];

    const newIds = newMobs.map(m => m.id);
    const existingIds = existingMobs.map(m => m.id);

    const toAdd = newMobs.filter(m => !existingIds.includes(m.id));
    const toUpdate = newMobs.filter(m => existingIds.includes(m.id));
    const toDelete = existingMobs.filter(m => !newIds.includes(m.id));

    console.log('[GameState] 🔄 Persisting mobs', {
      add: toAdd.map(m => m.id),
      update: toUpdate.map(m => m.id),
      delete: toDelete.map(m => m.id),
    });

    // Execute writes sequentially to surface logs deterministically
    for (const mob of toAdd) {
      await addItem('mobs', stripUndefinedDeep(mob));
    }
    for (const mob of toUpdate) {
      await updateItem('mobs', mob.id, stripUndefinedDeep({ ...mob }));
    }
    for (const mob of toDelete) {
      await deleteItem('mobs', mob.id);
    }
  };

  const setMaps = (newMaps: string[]) => {
    setCollection('maps', newMaps);
  };

  const updateCrawler = (id: string, updates: Partial<Crawler>) => {
    updateItem('crawlers', id, updates);
  };

  const addCrawler = (crawler: Crawler) => {
    addItem('crawlers', crawler);
    addItem('inventory', { crawlerId: crawler.id, items: [] });
  };

  const deleteCrawler = (id: string) => {
    deleteItem('crawlers', id);
    const invToDelete = inventory.find((i) => i.crawlerId === id);
    if (invToDelete) {
      deleteItem('inventory', id);
    }
  };

  const getCrawlerInventory = (crawlerId: string) => {
    return inventory.find((i) => i.crawlerId === crawlerId)?.items || [];
  };

  const updateCrawlerInventory = (crawlerId: string, items: InventoryItem[]) => {
    const existing = inventory.find((i) => i.crawlerId === crawlerId);
    if (existing) {
      const newInventory = inventory.map((i) => 
        i.crawlerId === crawlerId ? { ...i, items } : i
      );
      setInventory(newInventory);
    } else {
      setInventory([...inventory, { crawlerId, items }]);
    }
  };

  return {
    crawlers,
    setCrawlers,
    updateCrawler,
    addCrawler,
    deleteCrawler,
    inventory,
    getCrawlerInventory,
    updateCrawlerInventory,
    mobs,
    setMobs,
    maps,
    setMaps,
    partyGold,
    isLoaded,
  };
};
