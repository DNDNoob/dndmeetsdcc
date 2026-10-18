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
  CombatTurnSnapshot,
  WikiPage,
  Quest,
  AssignedQuest,
  ChatMessage,
  NpcAiSettings,
  NpcAiStatus,
  NpcSecretEntry,
  NpcGeneratedPersonality,
  NpcSecretState,
  Spell,
  KnownSpell,
  SpellLearnedFrom,
  getSpellMasteryLevel,
  getNoChildLeftBehindBump,
  NO_CHILD_LEFT_BEHIND_TROPHY,
  NO_CHILD_LEFT_BEHIND_DESCRIPTION,
  getEffectiveManaCost,
  getEquippedModifiers,
  addActivityStats,
  getHPLossStats,
  remapEpisodeMapRefs,
  type CrawlerActivityStats,
  type CrawlerTrophy,
  defaultCrawlers,
  defaultInventory,
  defaultMobs,
  type CampaignMapDoc,
  type PublicMob,
  type PublicEpisode,
  type PublicEpisodeAssets,
} from "@/lib/gameData";
import { useGame } from "@/contexts/GameContext";
import type { BatchOperation } from "@/hooks/useFirebaseStore";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { sortableMapIds, planEpisodeImport } from "@/lib/publicContent";

export interface DiceRollEntry {
  id: string;
  crawlerName: string;
  crawlerId: string;
  timestamp: number;
  results: { dice: string; result: number }[];
  total: number;
  statRoll?: { stat: string; modifier: number; rawRoll: number; diceLabel?: string; rollType?: string };
  // For loot box notifications
  lootBoxNotification?: {
    boxName: string;
    tier: string;
    recipientNames: string[];
  };
  // For quest notifications
  questNotification?: {
    questName: string;
    type: 'assigned' | 'action_revealed' | 'action_completed' | 'reward_revealed';
    recipientNames: string[];
    detail?: string; // action item text or reward name
  };
  // For a player undoing their combat turn
  turnResetNotification?: {
    round: number;
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
    isLoaded,
    roomId,
    setRoomId,
    setCreator,
    mergeArrayById,
  } = useGame();

  // Cache for memoization - store previous collection values and their serialized forms
  const collectionsCache = useRef<Record<string, { items: unknown[]; hash: string }>>({});

  // Helper to get stable collection reference (avoids breaking memoization)
  const getStableCollection = <T,>(name: string): T[] => {
    const current = getCollection(name) as T[];
    const cached = collectionsCache.current[name];

    // Quick check: same array length and same IDs (cheap shallow comparison)
    if (cached && cached.items.length === current.length) {
      const currentIds = current.map((item: unknown) => (item as Record<string, unknown>)?.id);
      const cachedIds = (cached.items as unknown[]).map((item: unknown) => (item as Record<string, unknown>)?.id);
      if (currentIds.every((id, i) => id === cachedIds[i])) {
        // Deep check: compare stringified versions for actual changes
        // Only stringify current (not cached) since we store the cached hash
        const currentStr = JSON.stringify(current);
        if (currentStr === cached.hash) {
          return cached.items as T[];
        }
        // Update cache with new data and hash
        collectionsCache.current[name] = { items: current, hash: currentStr };
        return current;
      }
    }

    collectionsCache.current[name] = { items: current, hash: JSON.stringify(current) };
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

  // Extract map names from Firestore documents (parallel array to maps)
  const mapNames = useMemo(() => {
    const docs = getStableCollection<Record<string, unknown>>('maps');
    return (docs || [])
      .filter((m) => {
        const img = typeof m === 'string' ? m : (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '';
        return !!img;
      })
      .map((m) => (m?.name as string) || '');
  }, [getCollection, isLoaded]);

  // Map documents aligned with `maps` (same filtering/order), for publishing
  const mapDocs = useMemo((): CampaignMapDoc[] => {
    const docs = getStableCollection<Record<string, unknown>>('maps');
    return (docs || [])
      .map((m) => ({
        doc: m,
        image: (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '',
      }))
      .filter(({ image }) => !!image)
      .map(({ doc, image }) => ({
        id: doc.id as string,
        name: (doc.name as string) || '',
        image,
        ...(doc.createdBy ? { createdBy: doc.createdBy as string } : {}),
        ...(doc.createdByUsername ? { createdByUsername: doc.createdByUsername as string } : {}),
        ...(doc.isPublic ? { isPublic: true } : {}),
      }));
  }, [getCollection, isLoaded]);

  // Mark a map (by positional index) public/private. `sharedImage` is sticky: once
  // published, deleting the map never deletes its Storage file.
  const setMapPublic = async (index: number, updates: { isPublic: boolean; createdBy?: string; createdByUsername?: string }) => {
    const target = mapDocs[index];
    if (!target) return;
    await updateItem('maps', target.id, {
      ...updates,
      ...(updates.isPublic ? { sharedImage: true } : {}),
    } as Record<string, unknown>);
  };

  // Mark maps whose images were copied into a public episode, so deleting them later
  // never deletes the Storage file the community copy still points at
  const markMapsShared = async (mapIds: string[]) => {
    const ops: BatchOperation[] = mapIds
      .filter((id) => !(getCollection('maps') as Record<string, unknown>[]).find((d) => d.id === id)?.sharedImage)
      .map((id) => ({ type: 'update' as const, collection: 'maps' as const, id, data: { sharedImage: true } }));
    if (ops.length > 0) await batchWrite(ops);
  };

  // Import community maps into this campaign; returns nothing (maps append at the end)
  const importMaps = async (newMaps: { name: string; image: string; createdBy?: string; createdByUsername?: string }[]) => {
    const existingIds = (getCollection('maps') as Record<string, unknown>[]).map(d => d?.id as string).filter(Boolean);
    const ids = sortableMapIds(existingIds, newMaps.length);
    const now = new Date().toISOString();
    // One write per map: each image can be close to Firestore's 1 MB limit.
    // No storagePath: the Storage file belongs to the original campaign and must not be deleted from here.
    for (const [i, m] of newMaps.entries()) {
      await addItem('maps', { id: ids[i], ...m, createdAt: now, updatedAt: now } as Record<string, unknown>);
    }
  };

  // Update a map's name in Firestore by its positional index
  const updateMapName = async (index: number, name: string) => {
    const docs = getCollection('maps') as Record<string, unknown>[];
    // Filter to non-empty docs (same filtering as maps useMemo)
    const nonEmptyDocs = (docs || []).filter((m) => {
      const img = typeof m === 'string' ? m : (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '';
      return !!img;
    });
    const doc = nonEmptyDocs[index];
    if (doc?.id) {
      await updateItem('maps', doc.id as string, { name } as Record<string, unknown>);
    }
  };

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

    logger.log('[GameState] 🔄 Persisting mobs', {
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

  // Show Time keeps per-map state in docs keyed `${episodeId}-${mapPosition}`
  const PER_MAP_SHOWTIME_COLLECTIONS = [
    'fog-of-war', 'pings', 'map-boxes', 'ruler-state',
    'crawler-placements', 'runtime-mob-placements', 'name-overrides',
  ];

  // Adds episode updates to `operations` and moves per-map Show Time docs so that every
  // episode keeps pointing at the same maps once `deletedIds` are gone
  const remapEpisodesAfterMapDelete = async (
    mapDocs: Record<string, unknown>[],
    deletedIds: Set<string>,
    operations: BatchOperation[],
  ) => {
    // Same ordering and filtering as the `maps` array the positions index into
    const withImage = mapDocs.filter(d => !!((d?.image as string) || (d?.imageUrl as string) || (d?.url as string) || (d?.value as string)));
    const newPosition = new Map<string, string | null>();
    let next = 0;
    withImage.forEach((d, oldIdx) => {
      newPosition.set(String(oldIdx), deletedIds.has(d.id as string) ? null : String(next++));
    });
    // References we can't place (already broken) are left alone
    const remap = (oldId: string) => (newPosition.has(oldId) ? newPosition.get(oldId)! : oldId);

    for (const episode of getCollection('episodes') as Episode[]) {
      const updates = remapEpisodeMapRefs(episode, remap);
      if (!updates) continue;
      operations.push({
        type: 'update',
        collection: 'episodes',
        id: episode.id,
        data: { ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>,
      });
      logger.log('[GameState] 🗺️ Re-indexing episode maps', { episode: episode.id, from: episode.mapIds, to: updates.mapIds });

      if (!db) continue;
      const oldIds = episode.mapIds.filter(id => remap(id) !== id);
      if (oldIds.length === 0) continue;
      const pathFor = (col: string, mapId: string) =>
        roomId ? `rooms/${roomId}/${col}/${episode.id}-${mapId}` : `${col}/${episode.id}-${mapId}`;
      for (const col of PER_MAP_SHOWTIME_COLLECTIONS) {
        try {
          // Read everything first: a map's new position can be another map's old one
          const touched = new Set<string>();
          const moved = new Map<string, Record<string, unknown>>();
          for (const oldId of oldIds) {
            touched.add(oldId);
            const snap = await getDoc(doc(db, pathFor(col, oldId)));
            const target = remap(oldId);
            if (target !== null) touched.add(target);
            if (snap.exists() && target !== null) {
              // Some docs (placements) also record the map position inside them
              const data = { ...snap.data() } as Record<string, unknown>;
              if ('mapId' in data) data.mapId = target;
              if (Array.isArray(data.placements)) {
                data.placements = (data.placements as Record<string, unknown>[]).map(pl => ({ ...pl, mapId: target }));
              }
              moved.set(target, data);
            }
          }
          for (const key of touched) {
            const data = moved.get(key);
            if (data) await setDoc(doc(db, pathFor(col, key)), data);
            else await deleteDoc(doc(db, pathFor(col, key)));
          }
        } catch (err) {
          console.warn('[GameState] ⚠️ Failed to move Show Time state after map delete:', col, episode.id, err);
        }
      }
    }
  };

  // Persist maps by diffing Firestore docs against provided array of base64 strings
  const setMaps = async (newMaps: string[]) => {
    const existingDocs = getCollection('maps') as Record<string, unknown>[];
    
    logger.log('[GameState] 🗺️ setMaps called', {
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

    logger.log('[GameState] 🗺️ Existing maps:', {
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

    logger.log('[GameState] 🗺️ Maps diff', {
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

    // Add new maps — IDs sort after existing ones so new maps are appended and
    // episodes' index-based mapIds keep pointing at the same maps
    const newMapIds = sortableMapIds((existingDocs || []).map(d => d?.id as string).filter(Boolean), mapsToAddIndices.length);
    for (const [n, mapIdx] of mapsToAddIndices.entries()) {
      const img = newMaps[mapIdx];
      const newId = newMapIds[n];
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
      // Once a map has been published, community copies may still point at its Storage file
      if (sp && storage && !docWithId?.sharedImage) {
        try {
          await deleteObject(storageRef(storage, sp));
          logger.log('[GameState] 🗑️ Deleted map from Firebase Storage:', sp);
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

    // Episodes reference maps by position; deleting a map shifts every later map down one,
    // so move episodes (and their Show Time state) to the new positions in the same save
    if (mapsToDeleteIds.length > 0) {
      await remapEpisodesAfterMapDelete(existingDocs || [], new Set(mapsToDeleteIds), operations);
    }

    if (operations.length > 0) {
      logger.log('[GameState] 🗺️ Executing batch write for', operations.length, 'map operations');
      await batchWrite(operations);
    }

    logger.log('[GameState] ✅ setMaps completed');
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
      logger.log('[GameState] ✅ No empty maps to clean up');
      return;
    }

    logger.log('[GameState] 🧹 Cleaning up', emptyMapIds.length, 'empty maps...');

    // Use batch delete for faster cleanup
    const operations: BatchOperation[] = emptyMapIds.map(id => ({
      type: 'delete' as const,
      collection: 'maps' as const,
      id,
    }));

    await batchWrite(operations);
    logger.log('[GameState] ✅ Cleanup complete');
  };

  // Import a community mob type as a new mob in this campaign
  const importMob = async (mob: Mob) => {
    const { sourceId: _s, sourceCampaignId: _c, publishedAt: _p, isPublic: _ip, roomId: _r, ...rest } = mob as PublicMob & { roomId?: string };
    await addItem('mobs', { ...rest, id: crypto.randomUUID(), encountered: false } as Record<string, unknown>);
  };

  // Import a community episode with its maps, mob types and loot box templates.
  // Maps are written first (sortable IDs → appended at maps.length + i), episode last.
  const importEpisode = async (pub: PublicEpisode, assets: PublicEpisodeAssets) => {
    const existingIds = (getCollection('maps') as Record<string, unknown>[]).map(d => d?.id as string).filter(Boolean);
    const plan = planEpisodeImport(pub, assets, {
      baseMapIndex: maps.length,
      mapDocIds: sortableMapIds(existingIds, assets.maps.length),
      newId: () => crypto.randomUUID(),
    });
    const now = new Date().toISOString();
    const attribution = {
      createdBy: pub.createdBy,
      ...(pub.createdByUsername ? { createdByUsername: pub.createdByUsername } : {}),
    };
    for (const m of plan.maps) {
      await addItem('maps', { ...m, ...attribution, createdAt: now, updatedAt: now } as Record<string, unknown>);
    }
    for (const mob of plan.mobs) {
      await addItem('mobs', { ...mob } as Record<string, unknown>);
    }
    for (const t of plan.lootBoxTemplates) {
      await addItem('lootBoxTemplates', { ...t } as Record<string, unknown>);
    }
    for (const q of plan.quests) {
      await addItem('quests', { ...q } as Record<string, unknown>);
    }
    await addItem('episodes', { ...plan.episode } as Record<string, unknown>);
    return plan.episode;
  };

  // Persist crawler changes as-is (no activity stat bookkeeping)
  const writeCrawler = async (id: string, updates: Partial<Crawler>) => {
    // New campaigns display the built-in defaultCrawlers until one is saved. Those
    // don't exist in Firestore, so updateDoc would fail with "No document to update".
    // Persist the full crawler (default + edits) the first time it's saved.
    const persisted = getCollection<Crawler>('crawlers').some((c) => c.id === id);
    if (!persisted) {
      const base = crawlers.find((c) => c.id === id);
      if (base) {
        logger.log('[GameState] ➕ Persisting default crawler on first save:', id);
        return addItem('crawlers', { ...base, ...updates, id } as Record<string, unknown>);
      }
    }
    return updateItem('crawlers', id, updates as Record<string, unknown>);
  };

  // HP-loss stat deltas for a crawler, measured against effective (equipment-adjusted) HP
  const getCrawlerHPLossStats = (crawler: Crawler, oldHP: number, newHP: number, maxHP = crawler.maxHP): CrawlerActivityStats => {
    const mods = getEquippedModifiers(crawler, getCrawlerInventory(crawler.id));
    const hpMod = mods.hp ?? 0;
    return getHPLossStats(oldHP + hpMod, newHP + hpMod, (maxHP ?? 0) + (mods.maxHP ?? 0));
  };

  const updateCrawler = async (id: string, updates: Partial<Crawler>) => {
    logger.log('[GameState] 📝 Updating crawler:', { id, updates });
    const current = crawlers.find((c) => c.id === id);
    // Activity stats and trophies are only changed by their own helpers, never by a full-profile save
    const { activityStats: _stats, trophies: _trophies, ...rest } = updates;
    void _stats; void _trophies;
    const finalUpdates: Partial<Crawler> = rest;
    if (current && rest.hp !== undefined && rest.hp < (current.hp ?? 0)) {
      const deltas = getCrawlerHPLossStats(current, current.hp ?? 0, rest.hp, rest.maxHP ?? current.maxHP);
      finalUpdates.activityStats = addActivityStats(current.activityStats, deltas);
    }
    return writeCrawler(id, finalUpdates);
  };

  const addCrawler = async (crawler: Crawler) => {
    logger.log('[GameState] ➕ Adding crawler:', crawler);
    await addItem('crawlers', { ...crawler } as Record<string, unknown>);
    await addItem('inventory', { id: crawler.id, crawlerId: crawler.id, items: [] });
  };

  const deleteCrawler = async (id: string) => {
    await deleteItem('crawlers', id);
    const invToDelete = inventory.find((i) => i.crawlerId === id) as InventoryEntry | undefined;
    if (invToDelete && invToDelete.id) {
      await deleteItem('inventory', invToDelete.id);
    }
  };

  const getCrawlerInventory = (crawlerId: string) => {
    return inventory.find((i) => i.crawlerId === crawlerId)?.items || [];
  };

  const getSharedInventory = () => {
    return inventory.find((i) => i.crawlerId === '__shared__')?.items || [];
  };

  const updateSharedInventory = async (items: InventoryItem[]) => {
    return updateCrawlerInventory('__shared__', items);
  };

  // Only the change from what this client showed is saved, so two people editing the same
  // inventory (e.g. the shared item library) at once don't overwrite each other's items.
  const updateCrawlerInventory = async (crawlerId: string, items: InventoryItem[]) => {
    const existing = inventory.find((i) => i.crawlerId === crawlerId) as InventoryEntry | undefined;
    // Use the existing document ID; new entries use crawlerId as the document ID per convention
    const docId = existing?.id || crawlerId;
    return mergeArrayById(
      'inventory',
      docId,
      'items',
      (existing?.items || []) as unknown as Record<string, unknown>[],
      items as unknown as Record<string, unknown>[],
      { crawlerId },
    );
  };

  // Episode management
  const addEpisode = async (episode: Episode) => {
    return addItem('episodes', {
      ...episode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const updateEpisode = async (id: string, updates: Partial<Episode>) => {
    return updateItem('episodes', id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  };

  const deleteEpisode = async (id: string) => {
    return deleteItem('episodes', id);
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
        items: (template.items ?? []).map(item => ({ ...item, id: crypto.randomUUID() })),
        gold: template.gold,
        locked: true,
        sentAt: new Date().toISOString(),
      } as Record<string, unknown>,
    }));
    if (operations.length > 0) await batchWrite(operations);
  };

  const unlockLootBox = async (lootBoxId: string) => {
    return updateItem('lootBoxes', lootBoxId, { locked: false, unlockedAt: new Date().toISOString() });
  };

  const claimLootBoxItems = async (lootBoxId: string, crawlerId: string, itemIds: string[], claimGold = false) => {
    const box = lootBoxes.find(b => b.id === lootBoxId);
    if (!box) {
      console.warn('[GameState] Attempted to claim loot from non-existent box:', lootBoxId);
      return;
    }

    const itemsToClaim = box.items.filter(i => itemIds.includes(i.id));

    // Add items to crawler inventory
    if (itemsToClaim.length > 0) {
      const currentItems = getCrawlerInventory(crawlerId);
      await updateCrawlerInventory(crawlerId, [...currentItems, ...itemsToClaim]);
    }

    // Add gold to crawler if claiming gold
    if (claimGold && box.gold && box.gold > 0) {
      const crawler = crawlers.find(c => c.id === crawlerId);
      if (crawler) {
        await updateCrawler(crawlerId, { gold: (crawler.gold || 0) + box.gold });
      }
    }

    // Remove claimed items from loot box
    const remainingItems = box.items.filter(i => !itemIds.includes(i.id));
    const remainingGold = claimGold ? 0 : (box.gold || 0);

    // Delete box if empty, otherwise update
    if (remainingItems.length === 0 && remainingGold === 0) {
      await deleteItem('lootBoxes', lootBoxId);
    } else {
      await updateItem('lootBoxes', lootBoxId, {
        items: remainingItems,
        gold: remainingGold
      });
    }
  };

  const deleteLootBox = async (lootBoxId: string) => {
    return deleteItem('lootBoxes', lootBoxId);
  };

  const getCrawlerLootBoxes = (crawlerId: string) => {
    return lootBoxes.filter(b => b.crawlerId === crawlerId);
  };

  // --- Loot Box Templates ---
  const lootBoxTemplates = useMemo(() => {
    return getStableCollection<LootBoxTemplate>('lootBoxTemplates');
  }, [getCollection, isLoaded]);

  const addLootBoxTemplate = async (template: LootBoxTemplate) => {
    return addItem('lootBoxTemplates', { ...template } as Record<string, unknown>);
  };

  const updateLootBoxTemplate = async (id: string, updates: Partial<LootBoxTemplate>) => {
    return updateItem('lootBoxTemplates', id, updates as Record<string, unknown>);
  };

  const deleteLootBoxTemplate = async (id: string) => {
    return deleteItem('lootBoxTemplates', id);
  };

  // --- Quests ---
  const quests = useMemo(() => {
    return getStableCollection<Quest>('quests');
  }, [getCollection, isLoaded]);

  // --- Assigned Quests (must be declared before deleteQuest to avoid TDZ) ---
  const assignedQuests = useMemo(() => {
    return getStableCollection<AssignedQuest>('assignedQuests');
  }, [getCollection, isLoaded]);

  const addQuest = async (quest: Quest) => {
    return addItem('quests', {
      ...quest,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
  };

  const updateQuest = async (id: string, updates: Partial<Quest>) => {
    return updateItem('quests', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
  };

  const deleteQuest = async (id: string) => {
    // Also delete all assigned quests referencing this quest
    const assigned = assignedQuests.filter(a => a.questId === id);
    if (assigned.length > 0) {
      const ops: BatchOperation[] = assigned.map(a => ({
        type: 'delete' as const,
        collection: 'assignedQuests' as const,
        id: a.id,
      }));
      await batchWrite(ops);
    }
    return deleteItem('quests', id);
  };

  const assignQuest = async (questId: string, crawlerIds: string[], episodeId?: string) => {
    const allCrawlerIds = crawlers.filter(c => c.id !== 'dungeonai').map(c => c.id);
    const isPartyQuest = crawlerIds.length >= allCrawlerIds.length && allCrawlerIds.every(id => crawlerIds.includes(id));
    const assignment: AssignedQuest = {
      id: crypto.randomUUID(),
      questId,
      crawlerIds,
      isPartyQuest,
      episodeId,
      assignedAt: new Date().toISOString(),
    };
    return addItem('assignedQuests', { ...assignment } as Record<string, unknown>);
  };

  const updateAssignedQuest = async (id: string, updates: Partial<AssignedQuest>) => {
    return updateItem('assignedQuests', id, updates as Record<string, unknown>);
  };

  const deleteAssignedQuest = async (id: string) => {
    return deleteItem('assignedQuests', id);
  };

  const getCrawlerAssignedQuests = (crawlerId: string) => {
    return assignedQuests.filter(a => a.crawlerIds.includes(crawlerId));
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
      feetMoved: {},
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
      feetMoved: {},
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

      logger.log('[GameState] 🛌 Short rest for', crawler.name, {
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

      logger.log('[GameState] 🛏️ Long rest for', crawler.name, {
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
        };
      }),
      ...mobEntries.map(entry => {
        const mob = mobs.find(m => m.id === entry.mobId);
        const roll = Math.floor(Math.random() * 20) + 1;

        // Use persisted HP from episode if available (from previous combat)
        let initialHP = mob?.hitPoints;
        if (episodeId) {
          const episode = episodes.find(e => e.id === episodeId);
          if (episode) {
            const colonIdx = entry.combatId.indexOf(':');
            if (colonIdx > 0) {
              const placementIdx = parseInt(entry.combatId.substring(colonIdx + 1), 10);
              if (!isNaN(placementIdx) && placementIdx < episode.mobPlacements.length) {
                const placement = episode.mobPlacements[placementIdx];
                if (placement.currentHP !== undefined) initialHP = placement.currentHP;
              }
            } else {
              const placement = episode.mobPlacements.find(p => p.mobId === entry.mobId);
              if (placement?.currentHP !== undefined) initialHP = placement.currentHP;
            }
          }
        }

        return {
          id: entry.combatId,
          sourceId: entry.mobId,
          type: 'mob' as const,
          name: entry.name,
          initiative: roll,
          hasRolledInitiative: true,
          hasUsedAction: false,
          hasUsedBonusAction: false,
          currentHP: initialHP,
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
      turnTimerMode: 'countdown',
      turnTimerDuration: 60,
      turnTimerPaused: false,
      turnStartedAt: undefined,
    };

    const current = combatState;
    if (current) {
      await updateItem('combatState', 'current', combatData);
    } else {
      await addItem('combatState', { id: 'current', ...combatData });
    }

    // Log mob initiative rolls to dice panel
    const mobCombatants = combatants.filter(c => c.type === 'mob' && c.hasRolledInitiative);
    for (const mc of mobCombatants) {
      await addDiceRoll({
        id: crypto.randomUUID(),
        crawlerName: mc.name,
        crawlerId: mc.id,
        timestamp: Date.now(),
        results: [{ dice: 'D20', result: mc.initiative }],
        total: mc.initiative,
        statRoll: { stat: 'Initiative', modifier: 0, rawRoll: mc.initiative },
      });
    }

    logger.log('[GameState] ⚔️ Combat started with', combatants.length, 'combatants (mobs auto-rolled). Combat #', prevCount + 1);
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
    logger.log('[GameState] 🎲 Mob initiatives rolled');
  };

  // DM override: roll initiative for every combatant who hasn't rolled yet.
  // Crawlers use d20 + effective DEX modifier, mobs a plain d20 (same as auto-roll).
  const forceRollInitiatives = async () => {
    if (!combatState || combatState.phase !== 'initiative') return;
    const rolls: DiceRollEntry[] = [];
    const updatedCombatants = combatState.combatants.map(c => {
      if (c.hasRolledInitiative) return c;
      const rawRoll = Math.floor(Math.random() * 20) + 1;
      let modifier = 0;
      if (c.type === 'crawler') {
        const crawler = crawlers.find(cr => cr.id === c.id);
        if (crawler) {
          const mods = getEquippedModifiers(crawler, getCrawlerInventory(crawler.id));
          modifier = Math.floor(((crawler.dex + (mods.dex ?? 0)) - 10) / 2);
        }
      }
      const total = rawRoll + modifier;
      rolls.push({
        id: crypto.randomUUID(),
        crawlerName: c.name,
        crawlerId: c.id,
        timestamp: Date.now(),
        results: [{ dice: 'D20', result: rawRoll }],
        total,
        statRoll: { stat: 'Initiative', modifier, rawRoll },
      });
      return { ...c, initiative: total, hasRolledInitiative: true };
    });
    if (rolls.length === 0) return;
    await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
    for (const roll of rolls) await addDiceRoll(roll);
    logger.log('[GameState] 🎲 DM forced initiative for', rolls.length, 'combatants');
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

  // Checkpoint of the game at the start of a combat turn, so the player can undo that turn
  const buildTurnSnapshot = (combatants: CombatantEntry[], turnIndex: number): CombatTurnSnapshot | undefined => {
    const active = combatants[turnIndex];
    if (!active) return undefined;
    const snapCrawlers: CombatTurnSnapshot['crawlers'] = {};
    for (const c of combatants) {
      if (c.type !== 'crawler') continue;
      const crawler = crawlers.find(cr => cr.id === c.id);
      if (!crawler) continue;
      snapCrawlers[c.id] = { hp: crawler.hp ?? 0, mana: crawler.mana ?? 0, activityStats: crawler.activityStats };
    }
    const activeCrawler = active.type === 'crawler' ? crawlers.find(cr => cr.id === active.id) : undefined;
    return {
      combatantId: active.id,
      takenAt: Date.now(),
      combatants: combatants.map(c => ({
        id: c.id,
        currentHP: c.currentHP,
        hasUsedAction: c.hasUsedAction,
        hasUsedBonusAction: c.hasUsedBonusAction,
        feetMovedThisTurn: c.feetMovedThisTurn,
      })),
      crawlers: snapCrawlers,
      knownSpells: activeCrawler?.knownSpells,
    };
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
      turnStartedAt: Date.now(),
      turnTimerPaused: false,
      turnSnapshot: buildTurnSnapshot(sorted, 0) ?? null,
    } as Record<string, unknown>);
    logger.log('[GameState] ⚔️ Combat order confirmed, starting combat phase');
  };

  const advanceCombatTurn = async () => {
    if (!combatState || combatState.combatants.length === 0) return;
    const nextIndex = combatState.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combatState.combatants.length;
    // Reset action flags for the combatant whose turn just ended
    const resetCombatants = combatState.combatants.map((c, i) => {
      if (i === combatState.currentTurnIndex) {
        return { ...c, hasUsedAction: false, hasUsedBonusAction: false, feetMovedThisTurn: 0 };
      }
      return c;
    });
    const newIndex = isNewRound ? 0 : nextIndex;
    await updateItem('combatState', 'current', {
      combatants: resetCombatants,
      currentTurnIndex: newIndex,
      combatRound: isNewRound ? combatState.combatRound + 1 : combatState.combatRound,
      turnStartedAt: Date.now(),
      turnTimerPaused: false,
      turnSnapshot: buildTurnSnapshot(resetCombatants, newIndex) ?? null,
    } as Record<string, unknown>);
  };

  // Undo the current combat turn: put the game back to the checkpoint taken when the turn
  // started (token position, movement, actions, HP, mana, spell casts) and note it in the dice log.
  // Dice rolls already made stay in the log.
  const undoCombatTurn = async (): Promise<boolean> => {
    if (!combatState?.active || combatState.phase !== 'combat') return false;
    const active = combatState.combatants[combatState.currentTurnIndex];
    const snap = combatState.turnSnapshot;
    if (!active || !snap || snap.combatantId !== active.id) {
      toast.error("This turn can't be undone");
      return false;
    }

    const snapById = new Map(snap.combatants.map(s => [s.id, s]));
    const restoredCombatants = combatState.combatants.map(c => {
      const s = snapById.get(c.id);
      if (!s) return c;
      return {
        ...c,
        currentHP: s.currentHP,
        hasUsedAction: s.hasUsedAction,
        hasUsedBonusAction: s.hasUsedBonusAction,
        feetMovedThisTurn: s.feetMovedThisTurn ?? 0,
      };
    });

    // Restore the token first, while the start position is still in the snapshot
    if (snap.startPosition && db) {
      const { episodeId, mapId, x, y } = snap.startPosition;
      const path = roomId
        ? `rooms/${roomId}/crawler-placements/${episodeId}-${mapId}`
        : `crawler-placements/${episodeId}-${mapId}`;
      try {
        const ref = doc(db, path);
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
          const placements = (docSnap.data().placements ?? []) as { crawlerId: string; mapId: string; x: number; y: number }[];
          let moved = false;
          const updated = placements.map(p => {
            if (moved || p.crawlerId !== active.id || p.mapId !== mapId) return p;
            moved = true;
            return { ...p, x, y };
          });
          if (moved) await updateDoc(ref, { placements: updated, updatedAt: serverTimestamp() });
        }
      } catch (error) {
        console.error('[GameState] Failed to restore token position on undo:', error);
      }
    }

    // Crawler HP, mana and stats (damage and healing this turn could have hit anyone in the fight)
    const crawlerOps: BatchOperation[] = [];
    for (const [crawlerId, s] of Object.entries(snap.crawlers)) {
      const current = crawlers.find(c => c.id === crawlerId);
      if (!current || !getCollection<Crawler>('crawlers').some(c => c.id === crawlerId)) continue;
      const data: Record<string, unknown> = {};
      if ((current.hp ?? 0) !== s.hp) data.hp = s.hp;
      if ((current.mana ?? 0) !== s.mana) data.mana = s.mana;
      if (JSON.stringify(current.activityStats ?? {}) !== JSON.stringify(s.activityStats ?? {})) {
        data.activityStats = s.activityStats ?? {};
      }
      if (crawlerId === active.id && snap.knownSpells &&
          JSON.stringify(current.knownSpells ?? []) !== JSON.stringify(snap.knownSpells)) {
        data.knownSpells = snap.knownSpells;
      }
      if (Object.keys(data).length > 0) {
        crawlerOps.push({ type: 'update', collection: 'crawlers', id: crawlerId, data });
      }
    }
    if (crawlerOps.length > 0) await batchWrite(crawlerOps);

    await updateItem('combatState', 'current', {
      combatants: restoredCombatants,
      turnSnapshot: { ...snap, startPosition: null },
    } as Record<string, unknown>);

    await addDiceRoll({
      id: crypto.randomUUID(),
      crawlerName: active.name,
      crawlerId: active.id,
      timestamp: Date.now(),
      results: [],
      total: 0,
      turnResetNotification: { round: combatState.combatRound },
    });
    logger.log('[GameState] ↩️ Turn undone for', active.name);
    return true;
  };

  const updateCombatTimer = async (settings: { turnTimerMode?: 'countdown' | 'stopwatch'; turnTimerDuration?: number; turnTimerPaused?: boolean }) => {
    if (!combatState) return;
    const updates: Record<string, unknown> = {};
    if (settings.turnTimerMode !== undefined) updates.turnTimerMode = settings.turnTimerMode;
    if (settings.turnTimerDuration !== undefined) updates.turnTimerDuration = settings.turnTimerDuration;
    if (settings.turnTimerPaused !== undefined) updates.turnTimerPaused = settings.turnTimerPaused;
    // When switching modes or unpausing, reset the timer start
    if (settings.turnTimerMode !== undefined || settings.turnTimerPaused === false) {
      updates.turnStartedAt = Date.now();
    }
    await updateItem('combatState', 'current', updates);
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

  // Apply damage to one or more combat targets in a single pass, so splash hits don't
  // overwrite each other, and credit the attacking crawler's activity stats.
  const applyCombatDamageBatch = async (
    hits: { targetId: string; targetType: 'crawler' | 'mob'; damage: number }[],
    attackerId?: string,
  ) => {
    let combatants = combatState?.combatants ?? [];
    let combatantsChanged = false;
    const crawlerHP = new Map<string, number>();
    const statDeltas = new Map<string, CrawlerActivityStats>();
    const addDeltas = (crawlerId: string, deltas: CrawlerActivityStats) => {
      statDeltas.set(crawlerId, addActivityStats(statDeltas.get(crawlerId), deltas));
    };
    let killingBlows = 0;

    for (const { targetId, targetType, damage } of hits) {
      let dealt = 0;
      if (targetType === 'crawler') {
        const crawler = crawlers.find(c => c.id === targetId);
        if (!crawler) continue;
        const oldHP = crawlerHP.get(targetId) ?? crawler.hp ?? 0;
        const newHP = Math.max(0, oldHP - damage);
        crawlerHP.set(targetId, newHP);
        addDeltas(targetId, getCrawlerHPLossStats(crawler, oldHP, newHP));
        dealt = oldHP - newHP;
        logger.log('[GameState] ⚔️ Damage applied to crawler', crawler.name, ':', damage, '→ HP:', newHP);
      } else {
        const combatant = combatants.find(c => c.id === targetId);
        const mobId = combatant?.sourceId || targetId;
        const mob = mobs.find(m => m.id === mobId);
        if (!mob) continue;
        const hpBefore = combatant?.currentHP ?? mob.hitPoints ?? 0;
        const newHP = Math.max(0, hpBefore - damage);
        // Per-combatant HP in combat state (independent per instance). The shared mob
        // document's hitPoints is the base/max HP for the mob type and is not changed.
        if (combatState) {
          combatants = combatants.map(c => (c.id === targetId ? { ...c, currentHP: newHP } : c));
          combatantsChanged = true;
        }
        dealt = hpBefore - newHP;
        if (hpBefore > 0 && newHP === 0) killingBlows++;
        logger.log('[GameState] ⚔️ Damage applied to mob', combatant?.name ?? mob.name, ':', damage, '→ HP:', newHP);
      }
      if (attackerId && dealt > 0) addDeltas(attackerId, { damageDealt: dealt });
    }

    if (attackerId && killingBlows > 0) {
      // A killing blow ends the fight when no mob combatant is left standing
      const mobCombatants = combatants.filter(c => c.type === 'mob');
      const isDown = (c: CombatantEntry) =>
        (c.currentHP ?? mobs.find(m => m.id === (c.sourceId || c.id))?.hitPoints ?? 1) <= 0;
      const endsCombat = mobCombatants.length > 0 && mobCombatants.every(isDown);
      addDeltas(attackerId, { killingBlows, combatEndingBlows: endsCombat ? 1 : 0 });
      if (endsCombat) {
        const attacker = crawlers.find(c => c.id === attackerId);
        if (attacker) toast.success(`${attacker.name} landed the final blow!`);
      }
    }

    if (combatantsChanged) {
      await updateItem('combatState', 'current', { combatants } as Record<string, unknown>);
    }
    const crawlerIds = new Set([...crawlerHP.keys(), ...statDeltas.keys()]);
    for (const id of crawlerIds) {
      const crawler = crawlers.find(c => c.id === id);
      if (!crawler) continue;
      const updates: Partial<Crawler> = {};
      if (crawlerHP.has(id)) updates.hp = crawlerHP.get(id);
      const deltas = statDeltas.get(id);
      if (deltas) updates.activityStats = addActivityStats(crawler.activityStats, deltas);
      await writeCrawler(id, updates);
    }
  };

  const applyCombatDamage = async (targetId: string, targetType: 'crawler' | 'mob', damage: number, attackerId?: string) => {
    await applyCombatDamageBatch([{ targetId, targetType, damage }], attackerId);
  };

  // Record feet a crawler moved. When movement is limited this also spends the crawler's
  // movement for the current combat turn, or for the current noncombat turn outside combat.
  // `from` is where the token was before this move; the first move of a combat turn
  // remembers it so the turn can be undone.
  const recordCrawlerMove = async (
    crawlerId: string,
    feet: number,
    spendTurnMovement: boolean,
    from?: { episodeId: string; mapId: string; x: number; y: number },
  ) => {
    if (feet <= 0) return;
    const addFeet = (used: number | undefined) => Math.round(((used ?? 0) + feet) * 10) / 10;
    if (spendTurnMovement && combatState?.active && combatState.phase === 'combat') {
      const combatants = combatState.combatants.map(c =>
        c.id === crawlerId && c.type === 'crawler' ? { ...c, feetMovedThisTurn: addFeet(c.feetMovedThisTurn) } : c
      );
      const updates: Record<string, unknown> = { combatants };
      const snap = combatState.turnSnapshot;
      if (from && snap && snap.combatantId === crawlerId && !snap.startPosition) {
        updates.turnSnapshot = { ...snap, startPosition: from };
      }
      await updateItem('combatState', 'current', updates);
    } else if (spendTurnMovement && noncombatTurnState) {
      const feetMoved = { ...(noncombatTurnState.feetMoved ?? {}), [crawlerId]: addFeet(noncombatTurnState.feetMoved?.[crawlerId]) };
      await updateItem('noncombatTurns', 'current', { feetMoved } as Record<string, unknown>);
    }
    const crawler = crawlers.find(c => c.id === crawlerId);
    const rounded = Math.round(feet);
    if (crawler && rounded > 0) {
      await writeCrawler(crawlerId, { activityStats: addActivityStats(crawler.activityStats, { feetMoved: rounded }) });
    }
  };

  // DM trophies: awarding an existing trophy name again increments its count
  const awardTrophy = async (crawlerId: string, name: string, description?: string) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    const trimmed = name.trim();
    if (!crawler || !trimmed) return;
    const trophies = [...(crawler.trophies ?? [])];
    const awardedAt = new Date().toISOString();
    const idx = trophies.findIndex(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (idx >= 0) {
      const prev = trophies[idx];
      trophies[idx] = { ...prev, count: prev.count + 1, awardedAt, description: description?.trim() || prev.description };
    } else {
      const trophy: CrawlerTrophy = {
        id: `trophy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        description: description?.trim() || undefined,
        count: 1,
        awardedAt,
      };
      trophies.push(trophy);
    }
    await writeCrawler(crawlerId, { trophies });
    toast.success(`🏆 ${crawler.name} earned "${trimmed}"!`);
  };

  // "No Child Left Behind": if exactly one saved crawler is slower than everyone else, raise
  // their base speed so their effective speed matches the second slowest, and award the trophy.
  const applyNoChildLeftBehind = async () => {
    const stored = getCollection<Crawler>('crawlers');
    const bump = getNoChildLeftBehindBump(stored, getCrawlerInventory);
    if (!bump) return;
    const crawler = stored.find(c => c.id === bump.crawlerId);
    if (!crawler) return;
    logger.log('[GameState] 🐢 No Child Left Behind:', bump);
    await writeCrawler(bump.crawlerId, { moveSpeed: bump.moveSpeed });
    // The trophy is earned once; later speed bumps for the same crawler don't stack it
    const alreadyAwarded = (crawler.trophies ?? []).some(t => t.name === NO_CHILD_LEFT_BEHIND_TROPHY);
    if (!alreadyAwarded) {
      await awardTrophy(bump.crawlerId, NO_CHILD_LEFT_BEHIND_TROPHY, NO_CHILD_LEFT_BEHIND_DESCRIPTION);
    }
    toast.info(`${crawler.name}'s speed went from ${bump.fromSpeed} ft to ${bump.toSpeed} ft.`);
  };

  // Take back one award of a trophy; removes it when the count reaches 0
  const revokeTrophy = async (crawlerId: string, trophyId: string) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;
    const trophies = (crawler.trophies ?? [])
      .map(t => (t.id === trophyId ? { ...t, count: t.count - 1 } : t))
      .filter(t => t.count > 0);
    await writeCrawler(crawlerId, { trophies });
  };

  // Encountered mobs show in players' Mob Profiles; unencountered ones stay hidden there.
  // Same pairing the DM Console uses (encountered ⇔ not hidden).
  // Meeting a character also reveals the creature they are (Grimble → Goblin).
  const setMobEncountered = async (mobId: string, encountered: boolean) => {
    const speciesId = encountered ? mobs.find(m => m.id === mobId)?.speciesId : undefined;
    const species = speciesId ? mobs.find(m => m.id === speciesId) : undefined;
    if (species && !(species.encountered && !species.hidden)) {
      await batchWrite([
        { type: 'update', collection: 'mobs', id: mobId, data: { encountered, hidden: !encountered } },
        { type: 'update', collection: 'mobs', id: species.id, data: { encountered: true, hidden: false } },
      ]);
      return;
    }
    await updateItem('mobs', mobId, { encountered, hidden: !encountered } as Record<string, unknown>);
  };

  const overrideMobHealth = async (combatantId: string, newHP: number) => {
    // Update per-combatant HP in combat state (independent per instance)
    if (combatState) {
      const updatedCombatants = combatState.combatants.map(c =>
        c.id === combatantId ? { ...c, currentHP: newHP } : c
      );
      await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
      // Do NOT update the shared mob document — each combatant instance tracks HP independently
    } else {
      // Fallback when not in combat: direct mob document update
      await updateItem('mobs', combatantId, { hitPoints: newHP } as Record<string, unknown>);
    }
    logger.log('[GameState] ⚔️ DM override: combatant HP set to', newHP);
  };

  const endCombat = async () => {
    if (!combatState) return;

    // Persist mob HP changes to the episode before clearing combat state
    if (combatState.episodeId) {
      const episode = episodes.find(e => e.id === combatState.episodeId);
      if (episode && episode.mobPlacements.length > 0) {
        const updatedPlacements = [...episode.mobPlacements];
        let changed = false;

        for (const c of combatState.combatants) {
          if (c.type !== 'mob' || c.currentHP === undefined) continue;
          const mobDocId = c.sourceId || c.id;

          // Check if this is an indexed combatId (e.g., "mobId:3")
          if (c.sourceId && c.id !== c.sourceId && c.id.startsWith(c.sourceId + ':')) {
            const placementIdx = parseInt(c.id.substring(c.sourceId.length + 1), 10);
            if (!isNaN(placementIdx) && placementIdx < updatedPlacements.length) {
              updatedPlacements[placementIdx] = { ...updatedPlacements[placementIdx], currentHP: c.currentHP };
              changed = true;
            }
          } else {
            // Non-indexed: find the first episode placement with this mobId
            const idx = updatedPlacements.findIndex(p => p.mobId === mobDocId);
            if (idx >= 0) {
              updatedPlacements[idx] = { ...updatedPlacements[idx], currentHP: c.currentHP };
              changed = true;
            }
          }
        }

        if (changed) {
          await updateEpisode(episode.id, { mobPlacements: updatedPlacements });
          logger.log('[GameState] ⚔️ Persisted mob HP to episode', episode.id);
        }
      }
    }

    await updateItem('combatState', 'current', {
      active: false,
      phase: 'ended',
      combatants: [],
      currentTurnIndex: 0,
    } as Record<string, unknown>);
    logger.log('[GameState] ⚔️ Combat ended');
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
    logger.log('[GameState] ⚔️ Combat cancelled (count reverted to', revertedCount, ')');
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

  const addCombatant = async (newCombatants: CombatantEntry[]) => {
    if (!combatState || newCombatants.length === 0) return;
    const existing = combatState.combatants;
    // Filter out any that are already in combat
    const existingIds = new Set(existing.map(c => c.id));
    const toAdd = newCombatants.filter(c => !existingIds.has(c.id));
    if (toAdd.length === 0) return;

    let updatedCombatants: CombatantEntry[];
    if (combatState.phase === 'combat') {
      // During combat phase, insert sorted by initiative
      updatedCombatants = [...existing, ...toAdd].sort((a, b) => b.initiative - a.initiative);
    } else {
      // During initiative phase, just append
      updatedCombatants = [...existing, ...toAdd];
    }

    await updateItem('combatState', 'current', {
      combatants: updatedCombatants,
    } as Record<string, unknown>);

    // Log mob initiative rolls to dice panel
    const mobsAdded = toAdd.filter(c => c.type === 'mob' && c.hasRolledInitiative);
    for (const mc of mobsAdded) {
      await addDiceRoll({
        id: crypto.randomUUID(),
        crawlerName: mc.name,
        crawlerId: mc.id,
        timestamp: Date.now(),
        results: [{ dice: 'D20', result: mc.initiative }],
        total: mc.initiative,
        statRoll: { stat: 'Initiative', modifier: 0, rawRoll: mc.initiative },
      });
    }

    logger.log('[GameState] ➕ Added', toAdd.length, 'combatant(s) to active combat');
  };

  // ======== Spells ========
  const spells = useMemo(() => {
    return getStableCollection<Spell>('spells');
  }, [getCollection, isLoaded]);

  const addSpell = async (spell: Spell) => {
    await addItem('spells', spell as unknown as Record<string, unknown>);
  };

  const updateSpell = async (id: string, updates: Partial<Spell>) => {
    await updateItem('spells', id, updates as unknown as Record<string, unknown>);
  };

  const deleteSpell = async (id: string) => {
    await deleteItem('spells', id);
  };

  // Add a spell to a crawler's knownSpells; blocks duplicates
  const learnSpell = async (crawlerId: string, spell: Spell, source: SpellLearnedFrom) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;
    const existing = crawler.knownSpells ?? [];
    if (existing.some(ks => ks.spellId === spell.id)) {
      toast.error(`${crawler.name} already knows ${spell.name}!`);
      return;
    }
    const newEntry: KnownSpell = {
      spellId: spell.id,
      spellName: spell.name,
      learnedFrom: source,
      learnedAt: new Date().toISOString(),
      castCount: 0,
    };
    await updateCrawler(crawlerId, { knownSpells: [...existing, newEntry] });
    toast.success(`${crawler.name} learned ${spell.name}!`);
  };

  // Remove a spell from a crawler's knownSpells
  const forgetSpell = async (crawlerId: string, spellId: string) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;
    const updated = (crawler.knownSpells ?? []).filter(ks => ks.spellId !== spellId);
    await updateCrawler(crawlerId, { knownSpells: updated });
  };

  // Spend the spell's mana (after mastery discount) and increment its cast count.
  // Returns false without changing anything when the crawler can't afford it.
  const castSpell = async (crawlerId: string, spellId: string): Promise<boolean> => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return false;
    const knownSpells = [...(crawler.knownSpells ?? [])];
    const idx = knownSpells.findIndex(ks => ks.spellId === spellId);
    if (idx === -1) return false;
    const prev = knownSpells[idx];
    const spell = spells.find(s => s.id === spellId) ?? prev.customSpell;
    const prevMastery = getSpellMasteryLevel(prev.castCount);
    const cost = spell ? getEffectiveManaCost(spell.spellData.manaCost, prevMastery) : 0;
    const currentMana = crawler.mana ?? 0;
    if (cost > currentMana) {
      toast.error(`${crawler.name} doesn't have enough mana for ${prev.spellName} (${cost} MP needed, ${currentMana} left)`);
      return false;
    }
    const newCastCount = prev.castCount + 1;
    const newMastery = getSpellMasteryLevel(newCastCount);
    knownSpells[idx] = { ...prev, castCount: newCastCount };
    await updateCrawler(crawlerId, { knownSpells, mana: currentMana - cost });
    if (newMastery > prevMastery) {
      toast.success(`${crawler.name} leveled up ${prev.spellName} to mastery level ${newMastery}!`);
    }
    return true;
  };

  // Restore HP to a crawler, capped at their effective max HP (equipment included)
  const healCrawler = async (crawlerId: string, amount: number) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler || amount <= 0) return;
    const mods = getEquippedModifiers(crawler, getCrawlerInventory(crawlerId));
    const effectiveMaxHP = (crawler.maxHP || 0) + (mods.maxHP ?? 0);
    const newHP = Math.min(effectiveMaxHP, (crawler.hp ?? 0) + amount);
    await updateCrawler(crawlerId, { hp: newHP });
  };

  // Consume a spell tome item: learn all spells in the tome (skipping known ones) and remove the item
  const consumeSpellTome = async (crawlerId: string, itemId: string) => {
    const crawlerInv = getCrawlerInventory(crawlerId);
    const item = crawlerInv.find(i => i.id === itemId);
    if (!item?.isSpellTome || !item.spellTomeData) return;

    const entries = item.spellTomeData.entries ?? [];
    if (entries.length === 0) {
      toast.error('This spell tome has no spells.');
      return;
    }

    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;

    // Resolve each entry to a Spell, skipping unresolvable and already-known
    const alreadyKnown = new Set((crawler.knownSpells ?? []).map(ks => ks.spellId));
    const toLearn: Spell[] = [];
    const skippedAlreadyKnown: string[] = [];

    for (const entry of entries) {
      let spell: Spell | undefined;
      if (entry.customSpell) {
        spell = entry.customSpell;
      } else if (entry.spellId) {
        spell = spells.find(s => s.id === entry.spellId);
      }
      if (!spell) continue;
      if (alreadyKnown.has(spell.id)) {
        skippedAlreadyKnown.push(spell.name);
      } else {
        toLearn.push(spell);
        alreadyKnown.add(spell.id); // prevent learning same spell twice within one tome
      }
    }

    if (toLearn.length === 0) {
      toast.error(`${crawler.name} already knows all spells in this tome!`);
      return;
    }

    const now = new Date().toISOString();
    const newKnownSpells: KnownSpell[] = toLearn.map(spell => ({
      spellId: spell.id,
      spellName: spell.name,
      learnedFrom: 'tome',
      learnedAt: now,
      castCount: 0,
      // Keep the full data of one-off tome spells so the crawler can still see and cast them
      ...(spells.some(s => s.id === spell.id) ? {} : { customSpell: spell }),
    }));

    await batchWrite([
      {
        type: 'update' as const,
        collection: 'inventory' as const,
        id: crawlerId,
        data: { items: crawlerInv.filter(i => i.id !== itemId) } as Record<string, unknown>,
      },
      {
        type: 'update' as const,
        collection: 'crawlers' as const,
        id: crawlerId,
        data: { knownSpells: [...(crawler.knownSpells ?? []), ...newKnownSpells] } as Record<string, unknown>,
      },
    ]);

    const learnedNames = toLearn.map(s => s.name).join(', ');
    if (skippedAlreadyKnown.length > 0) {
      toast.success(`${crawler.name} learned ${learnedNames}! (Skipped: ${skippedAlreadyKnown.join(', ')} — already known)`);
    } else {
      toast.success(`${crawler.name} consumed the tome and learned: ${learnedNames}!`);
    }
  };

  // Promote an embedded custom spell from a tome to the shared spell library
  const promoteSpellToLibrary = async (spell: Spell) => {
    if (spells.some(s => s.id === spell.id)) return; // already in library
    await addSpell(spell);
    toast.success(`${spell.name} added to the spell library.`);
  };

  // ======== Wiki ========
  const wikiPages = useMemo(() => {
    return getStableCollection<WikiPage>('wiki');
  }, [getCollection, isLoaded]);

  const addWikiPage = async (page: WikiPage) => {
    await addItem('wiki', page as unknown as Record<string, unknown>);
  };

  const updateWikiPage = async (id: string, updates: Partial<WikiPage>) => {
    await updateItem('wiki', id, updates as unknown as Record<string, unknown>);
  };

  // ======== In-game chat & talking NPCs ========
  // Only the most recent lines are kept in memory for the chat panel and NPC context
  const CHAT_DISPLAY_LIMIT = 150;
  const chatMessages = useMemo(() => {
    const stored = getStableCollection<ChatMessage>('chatMessages');
    return [...stored].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).slice(-CHAT_DISPLAY_LIMIT);
  }, [getCollection, isLoaded]);

  const npcAiDocs = useMemo(() => getStableCollection<Record<string, unknown>>('npcAi'), [getCollection, isLoaded]);
  const npcAiSettings = useMemo(
    () => (npcAiDocs.find(d => d.id === 'settings') as unknown as NpcAiSettings | undefined) ?? null,
    [npcAiDocs]
  );
  const npcAiStatus = useMemo(
    () => (npcAiDocs.find(d => d.id === 'status') as unknown as NpcAiStatus | undefined) ?? null,
    [npcAiDocs]
  );
  const npcSecrets = useMemo((): Record<string, NpcSecretEntry> => {
    const docData = npcAiDocs.find(d => d.id === 'secrets');
    if (!docData) return {};
    const { id: _id, ...entries } = docData;
    return entries as Record<string, NpcSecretEntry>;
  }, [npcAiDocs]);
  const npcPersonalities = useMemo((): Record<string, NpcGeneratedPersonality> => {
    const docData = npcAiDocs.find(d => d.id === 'personalities');
    if (!docData) return {};
    const { id: _id, ...entries } = docData;
    return entries as Record<string, NpcGeneratedPersonality>;
  }, [npcAiDocs]);

  const sendChatMessage = async (message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    const text = message.text.trim();
    if (!text) return;
    const entry: ChatMessage = {
      ...message,
      text: text.slice(0, 500),
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    await addItem('chatMessages', entry as unknown as Record<string, unknown>);
  };

  // Deletes chat lines (all of them, or one episode's). Batches are capped well under Firestore's 500.
  const clearChat = async (episodeId?: string) => {
    const all = getCollection('chatMessages') as unknown as ChatMessage[];
    const toDelete = episodeId ? all.filter(m => m.episodeId === episodeId) : all;
    for (let i = 0; i < toDelete.length; i += 400) {
      await batchWrite(toDelete.slice(i, i + 400).map(m => ({
        type: 'delete' as const,
        collection: 'chatMessages' as const,
        id: m.id,
      })));
    }
  };

  // Singleton docs in npcAi: create on first write, merge afterwards
  const writeNpcAiDoc = async (docId: 'settings' | 'secrets', data: Record<string, unknown>) => {
    if (npcAiDocs.some(d => d.id === docId)) {
      await updateItem('npcAi', docId, data);
    } else {
      await addItem('npcAi', { id: docId, ...data });
    }
  };

  const updateNpcAiSettings = async (updates: Partial<Omit<NpcAiSettings, 'id'>>) => {
    await writeNpcAiDoc('settings', updates as Record<string, unknown>);
  };

  const setNpcSecretState = async (mobId: string, state: NpcSecretState) => {
    const entry: NpcSecretEntry = { state, at: Date.now() };
    await writeNpcAiDoc('secrets', { [mobId]: entry });
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
    mapNames,
    mapDocs,
    updateMapName,
    setMaps,
    setMapPublic,
    markMapsShared,
    importMaps,
    importMob,
    importEpisode,
    setCreator,
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
    quests,
    addQuest,
    updateQuest,
    deleteQuest,
    assignedQuests,
    assignQuest,
    updateAssignedQuest,
    deleteAssignedQuest,
    getCrawlerAssignedQuests,
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
    forceRollInitiatives,
    confirmInitiative,
    advanceCombatTurn,
    recordCombatAction,
    applyCombatDamage,
    applyCombatDamageBatch,
    recordCrawlerMove,
    undoCombatTurn,
    awardTrophy,
    applyNoChildLeftBehind,
    revokeTrophy,
    overrideMobHealth,
    setMobEncountered,
    endCombat,
    cancelCombat,
    removeCombatant,
    addCombatant,
    updateCombatTimer,
    wikiPages,
    addWikiPage,
    updateWikiPage,
    chatMessages,
    npcAiSettings,
    npcAiStatus,
    npcSecrets,
    npcPersonalities,
    sendChatMessage,
    clearChat,
    updateNpcAiSettings,
    setNpcSecretState,
    spells,
    addSpell,
    updateSpell,
    deleteSpell,
    learnSpell,
    forgetSpell,
    castSpell,
    healCrawler,
    consumeSpellTome,
    promoteSpellToLibrary,
    roomId,
    setRoomId,
    isLoaded,
  };
};
