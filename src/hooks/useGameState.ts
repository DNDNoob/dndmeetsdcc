import { useState, useEffect } from "react";
import {
  Crawler,
  InventoryItem,
  Mob,
  defaultCrawlers,
  defaultInventory,
  defaultMobs,
  partyGold,
} from "@/lib/gameData";

const STORAGE_KEY = "dcc_game_data";

interface GameState {
  crawlers: Crawler[];
  inventory: { crawlerId: string; items: InventoryItem[] }[];
  mobs: Mob[];
  gold: number;
}

export const useGameState = () => {
  const [crawlers, setCrawlers] = useState<Crawler[]>(defaultCrawlers);
  const [inventory, setInventory] = useState(defaultInventory);
  const [mobs, setMobs] = useState<Mob[]>(defaultMobs);
  const [gold, setGold] = useState(partyGold);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: GameState = JSON.parse(saved);
        setCrawlers(data.crawlers);
        setInventory(data.inventory);
        setMobs(data.mobs);
        setGold(data.gold);
      } catch (e) {
        console.error("Failed to load game state:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (isLoaded) {
      const data: GameState = { crawlers, inventory, mobs, gold };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [crawlers, inventory, mobs, gold, isLoaded]);

  const updateCrawler = (id: string, updates: Partial<Crawler>) => {
    setCrawlers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const getCrawlerInventory = (crawlerId: string) => {
    return inventory.find((i) => i.crawlerId === crawlerId)?.items || [];
  };

  return {
    crawlers,
    setCrawlers,
    updateCrawler,
    inventory,
    getCrawlerInventory,
    mobs,
    setMobs,
    gold,
    setGold,
    isLoaded,
  };
};
