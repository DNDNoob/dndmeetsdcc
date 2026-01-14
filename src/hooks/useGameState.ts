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
    const docs = getCollection('maps') as Record<string, unknown>[];
    // Support both raw string (legacy) and object with image/url/value
    const normalized = (docs || []).map((m) => {
      if (typeof m === 'string') return m;
      return (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '';
    }).filter(Boolean);
    
    // Check if we have empty documents that need cleanup
    const emptyDocs = (docs || []).filter((m) => {
      const img = typeof m === 'string' ? m : (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '';
      return !img;
    });
    
    if (emptyDocs.length > 0) {
      console.warn('[GameState] ⚠️ Found', emptyDocs.length, 'empty maps in Firestore (missing image data). These need to be deleted and re-uploaded.', {
        emptyMapIds: emptyDocs.map(d => (d?.id as string)?.substring?.(0, 8) || 'no-id')
      });
    }
    
    if (docs && docs.length > 0) {
      console.log('[GameState] 🗺️ Maps from collection:', {
        rawCount: docs.length,
        normalizedCount: normalized.length,
        emptyCount: emptyDocs.length,
        rawIds: docs.map(d => (d?.id as string)?.substring?.(0, 8) || 'no-id').join(', '),
        rawSample: docs[0] ? { id: (docs[0]?.id as string)?.substring?.(0, 8), hasImage: !!(docs[0]?.image), docKeys: Object.keys(docs[0] || {}) } : null
      });
    }
    
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
  const stripUndefinedDeep = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj
        .map((v) => (typeof v === 'object' && v !== null ? stripUndefinedDeep(v) : v))
        .filter((v) => v !== undefined);
    }
    if (typeof obj === 'object') {
      const out: Record<string, unknown> = {};
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
    const existingDocs = getCollection('maps') as Record<string, unknown>[];
    
    console.log('[GameState] 🗺️ setMaps called', {
      newMapsCount: newMaps.length,
      existingDocsCount: existingDocs?.length || 0,
      existingIds: existingDocs?.map((d) => d?.id)?.slice(0, 3) || []
    });

    // Create a fingerprint of each image based on length and middle/end sections (avoiding data: prefix)
    // This avoids collisions that occur with just first/last characters
    const getImageFingerprint = (img: string): string => {
      const dataIndex = img.indexOf(',');
      const actualData = dataIndex > -1 ? img.substring(dataIndex + 1) : img;
      // Use: length + middle 30 chars + last 30 chars to create a unique fingerprint
      const midStart = Math.floor(actualData.length / 2) - 15;
      const mid = actualData.substring(Math.max(0, midStart), midStart + 30);
      const end = actualData.substring(Math.max(0, actualData.length - 30));
      return `${actualData.length}:${mid}:${end}`;
    };

    // Build maps by id and fingerprint for efficient lookup
    const existingMapsByFingerprint = new Map<string, string>(); // fingerprint -> docId
    const existingMapIds = new Set<string>(); // all docIds
    
    (existingDocs || []).forEach((d: Record<string, unknown>) => {
      const img = typeof d === 'string' ? d : (d?.image as string) || (d?.imageUrl as string) || (d?.url as string) || (d?.value as string) || '';
      if (img && d?.id) {
        const fingerprint = getImageFingerprint(img);
        existingMapsByFingerprint.set(fingerprint, d.id as string);
        existingMapIds.add(d.id as string);
      }
    });

    console.log('[GameState] 🗺️ Existing maps:', {
      count: existingMapIds.size,
      ids: Array.from(existingMapIds).slice(0, 3),
      fingerprintSample: Array.from(existingMapsByFingerprint.keys()).slice(0, 2)
    });

    // Find maps to add and delete using fingerprints
    const newMapFingerprints = newMaps.map(getImageFingerprint);
    const mapsToAddIndices = newMapFingerprints
      .map((fp, idx) => ({ fp, idx }))
      .filter(({ fp }) => !existingMapsByFingerprint.has(fp))
      .map(({ idx }) => idx);
    
    const newFingerprintSet = new Set(newMapFingerprints);
    const mapsToDeleteIds = Array.from(existingMapIds).filter(id => {
      const docWithId = existingDocs.find(d => d?.id === id);
      if (!docWithId) return false;
      const img = typeof docWithId === 'string' ? docWithId : (docWithId?.image as string) || (docWithId?.imageUrl as string) || (docWithId?.url as string) || (docWithId?.value as string) || '';
      const fp = getImageFingerprint(img);
      return !newFingerprintSet.has(fp);
    });

    console.log('[GameState] 🗺️ Maps diff', {
      toAdd: mapsToAddIndices.length,
      toDelete: mapsToDeleteIds.length,
      toDeleteIds: mapsToDeleteIds.slice(0, 3),
      newFingerprintSample: newMapFingerprints.slice(0, 2)
    });

    // Perform Firebase writes sequentially to ensure they complete
    // Add new maps first
    for (let i = 0; i < mapsToAddIndices.length; i++) {
      const mapIdx = mapsToAddIndices[i];
      const img = newMaps[mapIdx];
      console.log('[GameState] ➕ Adding map', i + 1, 'of', mapsToAddIndices.length);
      try {
        await addItem('maps', { image: img, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      } catch (err) {
        console.error('[GameState] ❌ Failed to add map:', err);
        throw err;
      }
    }

    // Delete removed maps
    for (let i = 0; i < mapsToDeleteIds.length; i++) {
      const id = mapsToDeleteIds[i];
      console.log('[GameState] 🗑️ Deleting map', i + 1, 'of', mapsToDeleteIds.length, 'with id:', id);
      try {
        await deleteItem('maps', id);
      } catch (err) {
        console.error('[GameState] ❌ Failed to delete map:', err);
        throw err;
      }
    }
    
    console.log('[GameState] ✅ setMaps completed');
  };

  // Clean up empty maps that were saved without image data (migration from old size limits)
  const cleanupEmptyMaps = async () => {
    const existingDocs = getCollection('maps') as Record<string, unknown>[];
    const emptyMapIds = (existingDocs || [])
      .filter((m) => {
        const img = typeof m === 'string' ? m : (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '';
        return !img;
      })
      .map(d => d?.id as string);
    
    if (emptyMapIds.length === 0) {
      console.log('[GameState] ✅ No empty maps to clean up');
      return;
    }
    
    console.log('[GameState] 🧹 Cleaning up', emptyMapIds.length, 'empty maps...');
    
    for (const id of emptyMapIds) {
      try {
        await deleteItem('maps', id);
        console.log('[GameState] ✅ Deleted empty map:', id);
      } catch (err) {
        console.error('[GameState] ❌ Failed to delete empty map:', id, err);
      }
    }
    
    console.log('[GameState] ✅ Cleanup complete');
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
    cleanupEmptyMaps,
    episodes,
    addEpisode,
    updateEpisode,
    deleteEpisode,
    partyGold,
    isLoaded,
  };
};
