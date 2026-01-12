import { useMemo } from "react";
import {
  Crawler,
  InventoryItem,
  Mob,
  Episode,
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

  // Maps are stored as Firestore documents; normalize to string[] of image data
  const maps = useMemo(() => {
    const docs = getCollection('maps') as any[];
    // Support both raw string (legacy) and object with image/url/value
    const normalized = (docs || []).map((m) => {
      if (typeof m === 'string') return m;
      return m?.image || m?.imageUrl || m?.url || m?.value || '';
    }).filter(Boolean);
    return normalized as string[];
  }, [getCollection('maps'), isLoaded]);

  const episodes = useMemo(() => {
    return getCollection('episodes') as Episode[];
  }, [getCollection('episodes'), isLoaded]);

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

  // Persist maps by diffing Firestore docs against provided array of base64 strings
  const setMaps = async (newMaps: string[]) => {
    const existingDocs = getCollection('maps') as any[];
    // Build image arrays and id map for existing docs
    const existingImages: string[] = (existingDocs || []).map((d) => (
      typeof d === 'string' ? d : d?.image || d?.imageUrl || d?.url || d?.value || ''
    )).filter(Boolean);
    const idByImage: Record<string, string> = {};
    (existingDocs || []).forEach((d: any) => {
      const img = typeof d === 'string' ? d : d?.image || d?.imageUrl || d?.url || d?.value || '';
      if (img && d?.id) idByImage[img] = d.id;
    });

    const toAdd = newMaps.filter((img) => !existingImages.includes(img));
    const toDelete = existingImages.filter((img) => !newMaps.includes(img));

    // Perform writes
    for (const img of toAdd) {
      await addItem('maps', { image: img, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    for (const img of toDelete) {
      const id = idByImage[img];
      if (id) await deleteItem('maps', id);
    }

    // Update local cache for immediate UI responsiveness
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

  // Episode management
  const addEpisode = (episode: Episode) => {
    addItem('episodes', {
      ...episode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const updateEpisode = (id: string, updates: Partial<Episode>) => {
    updateItem('episodes', id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  };

  const deleteEpisode = (id: string) => {
    deleteItem('episodes', id);
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
    episodes,
    addEpisode,
    updateEpisode,
    deleteEpisode,
    partyGold,
    isLoaded,
  };
};
