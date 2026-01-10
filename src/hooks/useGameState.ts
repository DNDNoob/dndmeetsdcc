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

  const setMobs = (newMobs: Mob[]) => {
    setCollection('mobs', newMobs);
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
