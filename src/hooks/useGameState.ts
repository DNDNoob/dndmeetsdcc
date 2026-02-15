import { useMemo, useRef } from "react";
import {
  Crawler,
  InventoryItem,
  Mob,
  Episode,
  SentLootBox,
  LootBoxTemplate,
  NoncombatTurnState,
  GameClockState,
  CombatState,
  CombatantEntry,
  getEquippedModifiers,
  defaultCrawlers,
  defaultInventory,
  defaultMobs,
} from "@/lib/gameData";
import { useGame } from "@/contexts/GameContext";
import type { BatchOperation } from "@/hooks/useFirebaseStore";
import { storage } from "@/lib/firebase";
import { ref as storageRef, deleteObject } from "firebase/storage";

export interface DiceRollEntry {
  id: string;
  crawlerName: string;
  crawlerId: string;
  timestamp: number;
  results: { dice: string; result: number }[];
  total: number;
  statRoll?: { stat: string; modifier: number; rawRoll: number };
  // For loot box notifications
  lootBoxNotification?: {
    boxName: string;
    tier: string;
    recipientNames: string[];
  };
}

interface InventoryEntry {
  id?: string;
  crawlerId: string;
  items: InventoryItem[];
}

export const useGameState = () => {
  const {
    getCollection,
    addItem,
    updateItem,
    deleteItem,
    batchWrite,
    isLoaded
  } = useGame();

  // Cache for memoization - store previous collection values
  const collectionsCache = useRef<Record<string, unknown[]>>({});

  // Helper to get stable collection reference (avoids breaking memoization)
  const getStableCollection = <T,>(name: string): T[] => {
    const current = getCollection(name) as T[];
    const cached = collectionsCache.current[name] as T[] | undefined;

    // If same length and same IDs, return cached to preserve reference
    if (cached && cached.length === current.length) {
      const currentIds = current.map((item: unknown) => (item as Record<string, unknown>)?.id);
      const cachedIds = cached.map((item: unknown) => (item as Record<string, unknown>)?.id);
      if (currentIds.every((id, i) => id === cachedIds[i])) {
        // Deep check: compare stringified versions for actual changes
        const currentStr = JSON.stringify(current);
        const cachedStr = JSON.stringify(cached);
        if (currentStr === cachedStr) {
          return cached;
        }
      }
    }

    collectionsCache.current[name] = current;
    return current;
  };

  // Get collections with defaults - using stable references
  const crawlers = useMemo(() => {
    const stored = getStableCollection<Crawler>('crawlers');
    if (!isLoaded || stored.length === 0) return defaultCrawlers;
    return stored;
  }, [getCollection, isLoaded]);

  const inventory = useMemo(() => {
    const stored = getStableCollection<InventoryEntry>('inventory');
    if (!isLoaded || stored.length === 0) return defaultInventory;
    return stored;
  }, [getCollection, isLoaded]);

  const mobs = useMemo(() => {
    const stored = getStableCollection<Mob>('mobs');
    if (!isLoaded || stored.length === 0) return defaultMobs;
    return stored;
  }, [getCollection, isLoaded]);

  // Maps are stored as Firestore documents; normalize to string[] of image data
  const maps = useMemo(() => {
    const docs = getStableCollection<Record<string, unknown>>('maps');
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

    return normalized as string[];
  }, [getCollection, isLoaded]);

  const episodes = useMemo(() => {
    return getStableCollection<Episode>('episodes');
  }, [getCollection, isLoaded]);

  // Calculate party gold as sum of all crawler gold
  const partyGold = useMemo(() => {
    return crawlers.reduce((sum, c) => sum + (c.gold || 0), 0);
  }, [crawlers]);

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

    // Use batch writes for atomic, fast updates
    const operations: BatchOperation[] = [
      ...toAdd.map(mob => ({
        type: 'add' as const,
        collection: 'mobs' as const,
        id: mob.id,
        data: { ...mob } as Record<string, unknown>,
      })),
      ...toUpdate.map(mob => ({
        type: 'update' as const,
        collection: 'mobs' as const,
        id: mob.id,
        data: { ...mob } as Record<string, unknown>,
      })),
      ...toDelete.map(mob => ({
        type: 'delete' as const,
        collection: 'mobs' as const,
        id: mob.id,
      })),
    ];

    if (operations.length > 0) {
      await batchWrite(operations);
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

    // Create a fingerprint of each image based on length and multiple sections of the data
    const getImageFingerprint = (img: string): string => {
      const dataIndex = img.indexOf(',');
      const d = dataIndex > -1 ? img.substring(dataIndex + 1) : img;
      const len = d.length;
      const slice = (pos: number) => d.substring(Math.max(0, pos), pos + 40);
      return `${len}:${slice(Math.floor(len * 0.25))}:${slice(Math.floor(len * 0.5))}:${slice(Math.floor(len * 0.75))}:${slice(Math.max(0, len - 40))}`;
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

    // Helper to extract Firebase Storage path from a download URL
    const extractStoragePath = (url: string): string | null => {
      try {
        const u = new URL(url);
        if (!u.hostname.includes('firebasestorage.googleapis.com')) return null;
        const match = u.pathname.match(/\/o\/(.+)/);
        if (!match) return null;
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    };

    // Use batch writes for fast, atomic updates
    const operations: BatchOperation[] = [];

    // Add new maps
    for (const mapIdx of mapsToAddIndices) {
      const img = newMaps[mapIdx];
      const newId = crypto.randomUUID();
      const data: Record<string, unknown> = {
        image: img,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // If this is a Firebase Storage URL, store the storagePath for cleanup on delete
      const sp = extractStoragePath(img);
      if (sp) {
        data.storagePath = sp;
      }
      operations.push({
        type: 'add',
        collection: 'maps',
        id: newId,
        data,
      });
    }

    // Delete removed maps (and clean up Firebase Storage files)
    for (const id of mapsToDeleteIds) {
      // Check if the map has a Storage-backed image that needs cleanup
      const docWithId = existingDocs.find(d => d?.id === id);
      const sp = (docWithId?.storagePath as string) || null;
      if (sp && storage) {
        try {
          await deleteObject(storageRef(storage, sp));
          console.log('[GameState] 🗑️ Deleted map from Firebase Storage:', sp);
        } catch (err) {
          console.warn('[GameState] ⚠️ Failed to delete map from Storage (may already be deleted):', sp, err);
        }
      }
      operations.push({
        type: 'delete',
        collection: 'maps',
        id,
      });
    }

    if (operations.length > 0) {
      console.log('[GameState] 🗺️ Executing batch write for', operations.length, 'map operations');
      await batchWrite(operations);
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

    // Use batch delete for faster cleanup
    const operations: BatchOperation[] = emptyMapIds.map(id => ({
      type: 'delete' as const,
      collection: 'maps' as const,
      id,
    }));

    await batchWrite(operations);
    console.log('[GameState] ✅ Cleanup complete');
  };

  const updateCrawler = (id: string, updates: Partial<Crawler>) => {
    console.log('[GameState] 📝 Updating crawler:', { id, updates });
    updateItem('crawlers', id, updates as Record<string, unknown>);
  };

  const addCrawler = (crawler: Crawler) => {
    console.log('[GameState] ➕ Adding crawler:', crawler);
    addItem('crawlers', { ...crawler } as Record<string, unknown>);
    addItem('inventory', { crawlerId: crawler.id, items: [] });
  };

  const deleteCrawler = (id: string) => {
    deleteItem('crawlers', id);
    const invToDelete = inventory.find((i) => i.crawlerId === id) as InventoryEntry | undefined;
    if (invToDelete && invToDelete.id) {
      deleteItem('inventory', invToDelete.id);
    }
  };

  const getCrawlerInventory = (crawlerId: string) => {
    return inventory.find((i) => i.crawlerId === crawlerId)?.items || [];
  };

  const getSharedInventory = () => {
    return inventory.find((i) => i.crawlerId === '__shared__')?.items || [];
  };

  const updateSharedInventory = (items: InventoryItem[]) => {
    updateCrawlerInventory('__shared__', items);
  };

  const updateCrawlerInventory = (crawlerId: string, items: InventoryItem[]) => {
    const existing = inventory.find((i) => i.crawlerId === crawlerId) as InventoryEntry | undefined;

    if (existing && existing.id) {
      // Update existing inventory in Firebase using the document ID
      updateItem('inventory', existing.id, { crawlerId, items });
    } else {
      // Add new inventory entry to Firebase
      addItem('inventory', { crawlerId, items });
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

  // --- Loot Boxes ---
  const lootBoxes = useMemo(() => {
    return getStableCollection<SentLootBox>('lootBoxes');
  }, [getCollection, isLoaded]);

  const sendLootBox = async (episodeId: string, template: LootBoxTemplate, crawlerIds: string[]) => {
    const operations: BatchOperation[] = crawlerIds.map(crawlerId => ({
      type: 'add' as const,
      collection: 'lootBoxes' as const,
      id: crypto.randomUUID(),
      data: {
        episodeId,
        crawlerId,
        name: template.name,
        tier: template.tier,
        items: template.items.map(item => ({ ...item, id: crypto.randomUUID() })),
        gold: template.gold,
        locked: true,
        sentAt: new Date().toISOString(),
      } as Record<string, unknown>,
    }));
    if (operations.length > 0) await batchWrite(operations);
  };

  const unlockLootBox = async (lootBoxId: string) => {
    updateItem('lootBoxes', lootBoxId, { locked: false, unlockedAt: new Date().toISOString() });
  };

  const claimLootBoxItems = async (lootBoxId: string, crawlerId: string, itemIds: string[], claimGold = false) => {
    const box = lootBoxes.find(b => b.id === lootBoxId);
    if (!box) return;

    const itemsToClaim = box.items.filter(i => itemIds.includes(i.id));

    // Add items to crawler inventory
    if (itemsToClaim.length > 0) {
      const currentItems = getCrawlerInventory(crawlerId);
      updateCrawlerInventory(crawlerId, [...currentItems, ...itemsToClaim]);
    }

    // Add gold to crawler if claiming gold
    if (claimGold && box.gold && box.gold > 0) {
      const crawler = crawlers.find(c => c.id === crawlerId);
      if (crawler) {
        updateCrawler(crawlerId, { gold: (crawler.gold || 0) + box.gold });
      }
    }

    // Remove claimed items from loot box
    const remainingItems = box.items.filter(i => !itemIds.includes(i.id));
    const remainingGold = claimGold ? 0 : (box.gold || 0);

    // Delete box if empty, otherwise update
    if (remainingItems.length === 0 && remainingGold === 0) {
      deleteItem('lootBoxes', lootBoxId);
    } else {
      updateItem('lootBoxes', lootBoxId, {
        items: remainingItems,
        gold: remainingGold
      });
    }
  };

  const deleteLootBox = (lootBoxId: string) => {
    deleteItem('lootBoxes', lootBoxId);
  };

  const getCrawlerLootBoxes = (crawlerId: string) => {
    return lootBoxes.filter(b => b.crawlerId === crawlerId);
  };

  // --- Loot Box Templates ---
  const lootBoxTemplates = useMemo(() => {
    return getStableCollection<LootBoxTemplate>('lootBoxTemplates');
  }, [getCollection, isLoaded]);

  const addLootBoxTemplate = (template: LootBoxTemplate) => {
    addItem('lootBoxTemplates', { ...template } as Record<string, unknown>);
  };

  const updateLootBoxTemplate = (id: string, updates: Partial<LootBoxTemplate>) => {
    updateItem('lootBoxTemplates', id, updates as Record<string, unknown>);
  };

  const deleteLootBoxTemplate = (id: string) => {
    deleteItem('lootBoxTemplates', id);
  };

  // --- Dice Rolls ---
  const diceRolls = useMemo(() => {
    const stored = getStableCollection<DiceRollEntry>('diceRolls');
    return [...stored].sort((a, b) => b.timestamp - a.timestamp);
  }, [getCollection, isLoaded]);

  const addDiceRoll = async (entry: DiceRollEntry) => {
    await addItem('diceRolls', { ...entry } as Record<string, unknown>);
    const all = getCollection('diceRolls') as DiceRollEntry[];
    if (all.length > 500) {
      const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = sorted.slice(0, all.length - 500);
      const ops: BatchOperation[] = toDelete.map(r => ({
        type: 'delete' as const,
        collection: 'diceRolls' as const,
        id: r.id,
      }));
      await batchWrite(ops);
    }
  };

  const clearDiceRolls = async () => {
    const all = getCollection('diceRolls') as DiceRollEntry[];
    const ops: BatchOperation[] = all.map(r => ({
      type: 'delete' as const,
      collection: 'diceRolls' as const,
      id: r.id,
    }));
    if (ops.length > 0) await batchWrite(ops);
  };

  // --- Noncombat Turns ---
  const noncombatTurnState = useMemo((): NoncombatTurnState | null => {
    const stored = getStableCollection<NoncombatTurnState>('noncombatTurns');
    return stored.find(s => s.id === 'current') ?? null;
  }, [getCollection, isLoaded]);

  const startNoncombatTurn = async (episodeId?: string) => {
    const current = noncombatTurnState;

    // Advance game clock by 1 hour when starting a new turn (not the very first one)
    if (current && gameClockState) {
      await advanceGameClock(1);
    }

    const turnData = {
      turnNumber: (current?.turnNumber ?? 0) + 1,
      rollsUsed: {},
      maxRolls: 3,
      episodeId: episodeId || current?.episodeId,
    };
    if (current) {
      await updateItem('noncombatTurns', 'current', turnData as Record<string, unknown>);
    } else {
      await addItem('noncombatTurns', { id: 'current', ...turnData } as Record<string, unknown>);
    }
  };

  const resetNoncombatTurns = async (episodeId: string) => {
    const current = noncombatTurnState;
    const turnData = {
      turnNumber: 0,
      rollsUsed: {},
      maxRolls: 3,
      episodeId,
    };
    if (current) {
      await updateItem('noncombatTurns', 'current', turnData as Record<string, unknown>);
    } else {
      await addItem('noncombatTurns', { id: 'current', ...turnData } as Record<string, unknown>);
    }
  };

  const recordNoncombatRoll = async (crawlerId: string) => {
    const current = noncombatTurnState;
    if (!current) return;
    const updatedRolls = { ...current.rollsUsed };
    updatedRolls[crawlerId] = (updatedRolls[crawlerId] ?? 0) + 1;
    await updateItem('noncombatTurns', 'current', { rollsUsed: updatedRolls } as Record<string, unknown>);
  };

  const getNoncombatRollsRemaining = (crawlerId: string): number => {
    if (!noncombatTurnState) return 0; // No active turn = no rolls allowed
    const used = noncombatTurnState.rollsUsed[crawlerId] ?? 0;
    return Math.max(0, noncombatTurnState.maxRolls - used);
  };

  // --- Game Clock ---
  const gameClockState = useMemo((): GameClockState | null => {
    const stored = getStableCollection<GameClockState>('gameClock');
    return stored.find(s => s.id === 'current') ?? null;
  }, [getCollection, isLoaded]);

  const setGameClock = async (gameTime: number) => {
    const current = gameClockState;
    if (current) {
      await updateItem('gameClock', 'current', { gameTime } as Record<string, unknown>);
    } else {
      await addItem('gameClock', { id: 'current', gameTime } as Record<string, unknown>);
    }
  };

  const advanceGameClock = async (hours: number) => {
    if (!gameClockState) return;
    const msToAdd = hours * 60 * 60 * 1000;
    await setGameClock(gameClockState.gameTime + msToAdd);
  };

  // --- Rest Mechanics ---
  const performShortRest = async (crawlerIds: string[]) => {
    // Capture current crawlers before any async operations
    const currentCrawlers = getCollection('crawlers') as Crawler[];
    if (gameClockState) await advanceGameClock(4);

    const operations: BatchOperation[] = [];
    for (const id of crawlerIds) {
      const crawler = currentCrawlers.find(c => c.id === id);
      if (!crawler) continue;

      const crawlerInv = getCrawlerInventory(id);
      const mods = getEquippedModifiers(crawler, crawlerInv);
      const effectiveMaxHP = (crawler.maxHP || 0) + (mods.maxHP ?? 0);
      const effectiveMaxMana = (crawler.maxMana || 0) + (mods.maxMana ?? 0);

      const currentHP = crawler.hp || 0;
      const currentMana = crawler.mana || 0;
      const missingHP = effectiveMaxHP - currentHP;
      const missingMana = effectiveMaxMana - currentMana;

      const newHP = Math.min(effectiveMaxHP, currentHP + Math.ceil(missingHP / 2));
      const newMana = Math.min(effectiveMaxMana, currentMana + Math.ceil(missingMana / 2));

      console.log('[GameState] 🛌 Short rest for', crawler.name, {
        currentHP, currentMana, effectiveMaxHP, effectiveMaxMana, newHP, newMana
      });

      operations.push({
        type: 'update' as const,
        collection: 'crawlers' as const,
        id,
        data: { hp: newHP, mana: newMana },
      });
    }
    if (operations.length > 0) await batchWrite(operations);
  };

  const performLongRest = async (crawlerIds: string[]) => {
    // Capture current crawlers before any async operations
    const currentCrawlers = getCollection('crawlers') as Crawler[];
    if (gameClockState) await advanceGameClock(8);

    const operations: BatchOperation[] = [];
    for (const id of crawlerIds) {
      const crawler = currentCrawlers.find(c => c.id === id);
      if (!crawler) continue;

      const crawlerInv = getCrawlerInventory(id);
      const mods = getEquippedModifiers(crawler, crawlerInv);
      const effectiveMaxHP = (crawler.maxHP || 0) + (mods.maxHP ?? 0);
      const effectiveMaxMana = (crawler.maxMana || 0) + (mods.maxMana ?? 0);

      console.log('[GameState] 🛏️ Long rest for', crawler.name, {
        effectiveMaxHP, effectiveMaxMana
      });

      operations.push({
        type: 'update' as const,
        collection: 'crawlers' as const,
        id,
        data: { hp: effectiveMaxHP, mana: effectiveMaxMana },
      });
    }
    if (operations.length > 0) await batchWrite(operations);
  };

  // --- Combat State ---
  const combatState = useMemo((): CombatState | null => {
    const stored = getStableCollection<CombatState>('combatState');
    return stored.find(s => s.id === 'current') ?? null;
  }, [getCollection, isLoaded]);

  const startCombat = async (crawlerIds: string[], mobEntries: { combatId: string; mobId: string; name: string }[], episodeId?: string) => {
    const combatants: CombatantEntry[] = [
      ...crawlerIds.map(id => {
        const crawler = crawlers.find(c => c.id === id);
        return {
          id,
          type: 'crawler' as const,
          name: crawler?.name ?? 'Unknown',
          initiative: 0,
          hasRolledInitiative: false,
          hasUsedAction: false,
          hasUsedBonusAction: false,
          avatar: crawler?.avatar,
        };
      }),
      ...mobEntries.map(entry => {
        const mob = mobs.find(m => m.id === entry.mobId);
        const roll = Math.floor(Math.random() * 20) + 1;
        return {
          id: entry.combatId,
          sourceId: entry.mobId,
          type: 'mob' as const,
          name: entry.name,
          initiative: roll,
          hasRolledInitiative: true,
          hasUsedAction: false,
          hasUsedBonusAction: false,
          avatar: mob?.image,
          currentHP: mob?.hitPoints,
        };
      }),
    ];

    // Increment combat counter
    const prevCount = combatState?.combatCount ?? 0;

    const combatData: Record<string, unknown> = {
      active: true,
      phase: 'initiative',
      combatants,
      currentTurnIndex: 0,
      combatRound: 1,
      episodeId: episodeId || undefined,
      combatCount: prevCount + 1,
    };

    const current = combatState;
    if (current) {
      await updateItem('combatState', 'current', combatData);
    } else {
      await addItem('combatState', { id: 'current', ...combatData });
    }
    console.log('[GameState] ⚔️ Combat started with', combatants.length, 'combatants (mobs auto-rolled). Combat #', prevCount + 1);
  };

  const rollMobInitiatives = async () => {
    if (!combatState) return;
    const updatedCombatants = combatState.combatants.map(c => {
      if (c.type === 'mob' && !c.hasRolledInitiative) {
        const roll = Math.floor(Math.random() * 20) + 1;
        return { ...c, initiative: roll, hasRolledInitiative: true };
      }
      return c;
    });
    await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
    console.log('[GameState] 🎲 Mob initiatives rolled');
  };

  const recordCombatInitiative = async (combatantId: string, roll: number) => {
    if (!combatState) return;
    const updatedCombatants = combatState.combatants.map(c => {
      if (c.id === combatantId) {
        return { ...c, initiative: roll, hasRolledInitiative: true };
      }
      return c;
    });
    await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
  };

  const confirmInitiative = async () => {
    if (!combatState) return;
    // Sort combatants by initiative (highest first)
    const sorted = [...combatState.combatants].sort((a, b) => b.initiative - a.initiative);
    await updateItem('combatState', 'current', {
      combatants: sorted,
      phase: 'combat',
      currentTurnIndex: 0,
      combatRound: 1,
    } as Record<string, unknown>);
    console.log('[GameState] ⚔️ Combat order confirmed, starting combat phase');
  };

  const advanceCombatTurn = async () => {
    if (!combatState) return;
    const nextIndex = combatState.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combatState.combatants.length;
    // Reset action flags for the combatant whose turn just ended
    const resetCombatants = combatState.combatants.map((c, i) => {
      if (i === combatState.currentTurnIndex) {
        return { ...c, hasUsedAction: false, hasUsedBonusAction: false };
      }
      return c;
    });
    await updateItem('combatState', 'current', {
      combatants: resetCombatants,
      currentTurnIndex: isNewRound ? 0 : nextIndex,
      combatRound: isNewRound ? combatState.combatRound + 1 : combatState.combatRound,
    } as Record<string, unknown>);
  };

  const recordCombatAction = async (combatantId: string, actionType: 'action' | 'bonus') => {
    if (!combatState) return;
    const updatedCombatants = combatState.combatants.map(c => {
      if (c.id === combatantId) {
        if (actionType === 'action') {
          return { ...c, hasUsedAction: true };
        }
        return { ...c, hasUsedBonusAction: true };
      }
      return c;
    });
    await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
  };

  const applyCombatDamage = async (targetId: string, targetType: 'crawler' | 'mob', damage: number) => {
    if (targetType === 'crawler') {
      const crawler = crawlers.find(c => c.id === targetId);
      if (crawler) {
        const newHP = Math.max(0, (crawler.hp || 0) - damage);
        await updateItem('crawlers', targetId, { hp: newHP } as Record<string, unknown>);
        console.log('[GameState] ⚔️ Damage applied to crawler', crawler.name, ':', damage, '→ HP:', newHP);
      }
    } else {
      const combatant = combatState?.combatants.find(c => c.id === targetId);
      const mobId = combatant?.sourceId || targetId;
      const mob = mobs.find(m => m.id === mobId);
      if (mob) {
        const hpBefore = combatant?.currentHP ?? mob.hitPoints ?? 0;
        const newHP = Math.max(0, hpBefore - damage);
        // Update per-combatant HP in combat state
        if (combatState) {
          const updatedCombatants = combatState.combatants.map(c =>
            c.id === targetId ? { ...c, currentHP: newHP } : c
          );
          await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
        }
        // Also update mob document
        await updateItem('mobs', mobId, { hitPoints: newHP } as Record<string, unknown>);
        console.log('[GameState] ⚔️ Damage applied to mob', combatant?.name ?? mob.name, ':', damage, '→ HP:', newHP);
      }
    }
  };

  const overrideMobHealth = async (combatantId: string, newHP: number) => {
    // Update per-combatant HP in combat state
    if (combatState) {
      const combatant = combatState.combatants.find(c => c.id === combatantId);
      const updatedCombatants = combatState.combatants.map(c =>
        c.id === combatantId ? { ...c, currentHP: newHP } : c
      );
      await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
      // Also update mob document
      const mobId = combatant?.sourceId || combatantId;
      await updateItem('mobs', mobId, { hitPoints: newHP } as Record<string, unknown>);
    } else {
      // Fallback: direct mob document update
      await updateItem('mobs', combatantId, { hitPoints: newHP } as Record<string, unknown>);
    }
    console.log('[GameState] ⚔️ DM override: combatant HP set to', newHP);
  };

  const endCombat = async () => {
    if (!combatState) return;
    await updateItem('combatState', 'current', {
      active: false,
      phase: 'ended',
      combatants: [],
      currentTurnIndex: 0,
    } as Record<string, unknown>);
    console.log('[GameState] ⚔️ Combat ended');
  };

  const cancelCombat = async () => {
    if (!combatState) return;
    // Cancel reverts combat count (it wasn't a real combat)
    const revertedCount = Math.max(0, (combatState.combatCount ?? 1) - 1);
    await updateItem('combatState', 'current', {
      active: false,
      phase: 'ended',
      combatants: [],
      currentTurnIndex: 0,
      combatCount: revertedCount,
    } as Record<string, unknown>);
    console.log('[GameState] ⚔️ Combat cancelled (count reverted to', revertedCount, ')');
  };

  const removeCombatant = async (combatantId: string) => {
    if (!combatState) return;
    const updatedCombatants = combatState.combatants.filter(c => c.id !== combatantId);
    // Adjust currentTurnIndex if needed
    let newIndex = combatState.currentTurnIndex;
    const removedIndex = combatState.combatants.findIndex(c => c.id === combatantId);
    if (removedIndex < combatState.currentTurnIndex) {
      newIndex = Math.max(0, newIndex - 1);
    } else if (newIndex >= updatedCombatants.length) {
      newIndex = 0;
    }
    await updateItem('combatState', 'current', {
      combatants: updatedCombatants,
      currentTurnIndex: newIndex,
    } as Record<string, unknown>);
  };

  return {
    crawlers,
    updateCrawler,
    addCrawler,
    deleteCrawler,
    inventory,
    getCrawlerInventory,
    updateCrawlerInventory,
    getSharedInventory,
    updateSharedInventory,
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
    lootBoxes,
    sendLootBox,
    unlockLootBox,
    claimLootBoxItems,
    deleteLootBox,
    getCrawlerLootBoxes,
    lootBoxTemplates,
    addLootBoxTemplate,
    updateLootBoxTemplate,
    deleteLootBoxTemplate,
    diceRolls,
    addDiceRoll,
    clearDiceRolls,
    noncombatTurnState,
    startNoncombatTurn,
    resetNoncombatTurns,
    recordNoncombatRoll,
    getNoncombatRollsRemaining,
    gameClockState,
    setGameClock,
    performShortRest,
    performLongRest,
    combatState,
    startCombat,
    rollMobInitiatives,
    recordCombatInitiative,
    confirmInitiative,
    advanceCombatTurn,
    recordCombatAction,
    applyCombatDamage,
    overrideMobHealth,
    endCombat,
    cancelCombat,
    removeCombatant,
    isLoaded,
  };
};
