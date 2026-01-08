import { useState, useEffect, useMemo } from "react";
import {
  Crawler,
  InventoryItem,
  Mob,
  defaultCrawlers,
  defaultInventory,
  defaultMobs,
} from "@/lib/gameData";

const STORAGE_KEY = "dcc_game_data";

interface GameState {
  crawlers: Crawler[];
  inventory: { crawlerId: string; items: InventoryItem[] }[];
  mobs: Mob[];
  maps: string[];
}

export const useGameState = () => {
  const [crawlers, setCrawlers] = useState<Crawler[]>(defaultCrawlers);
  const [inventory, setInventory] = useState(defaultInventory);
  const [mobs, setMobs] = useState<Mob[]>(defaultMobs);
  const [maps, setMaps] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Calculate party gold as sum of all crawler gold
  const partyGold = useMemo(() => {
    return crawlers.reduce((sum, c) => sum + (c.gold || 0), 0);
  }, [crawlers]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: GameState = JSON.parse(saved);
        // Ensure gold field exists on crawlers (migration)
        const migratedCrawlers = data.crawlers.map((c) => ({
          ...c,
          gold: c.gold ?? 0,
        }));
        setCrawlers(migratedCrawlers);
        setInventory(data.inventory);
        setMobs(data.mobs);
        setMaps(data.maps || []);
      } catch (e) {
        console.error("Failed to load game state:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (isLoaded) {
      const data: GameState = { crawlers, inventory, mobs, maps };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [crawlers, inventory, mobs, maps, isLoaded]);

  const updateCrawler = (id: string, updates: Partial<Crawler>) => {
    setCrawlers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const addCrawler = (crawler: Crawler) => {
    setCrawlers((prev) => [...prev, crawler]);
    setInventory((prev) => [...prev, { crawlerId: crawler.id, items: [] }]);
  };

  const deleteCrawler = (id: string) => {
    setCrawlers((prev) => prev.filter((c) => c.id !== id));
    setInventory((prev) => prev.filter((i) => i.crawlerId !== id));
  };

  const getCrawlerInventory = (crawlerId: string) => {
    return inventory.find((i) => i.crawlerId === crawlerId)?.items || [];
  };

  const updateCrawlerInventory = (crawlerId: string, items: InventoryItem[]) => {
    setInventory((prev) => {
      const existing = prev.find((i) => i.crawlerId === crawlerId);
      if (existing) {
        return prev.map((i) => (i.crawlerId === crawlerId ? { ...i, items } : i));
      }
      return [...prev, { crawlerId, items }];
    });
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
