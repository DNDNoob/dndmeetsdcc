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
  isPlacementHostile,
  splitMobLoot,
  getLootingLevel,
  getLootDestructionChance,
  DEFAULT_LOOT_DESTRUCTION_CHANCE,
  type MobLootSplit,
  stackItems,
  PARTY_INVENTORY_ID,
  SHARED_LIBRARY_ID,
  SHARED_LIBRARY_DOC_ID,
  CombatTurnSnapshot,
  WikiPage,
  Quest,
  AssignedQuest,
  newQuestProgress,
  ChatMessage,
  NpcAiSettings,
  NpcAiStatus,
  NpcSecretEntry,
  NpcGeneratedPersonality,
  NpcMemory,
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
  type CrawlerStats,
  type CrawlerMoment,
  CRAWLER_MOMENTS_MAX,
  type StatSource,
  type SourceStats,
  statKey,
  abilityOfRoll,
  isBossMob,
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
  type CustomLanguage,
  type LanguageEffect,
  type ActiveCondition,
  type SpellEffect,
  type MerchantState,
  type MerchantStockEntry,
  type MerchantHaggle,
  createMerchantState,
  getEffectiveScrooge,
  getMerchantBuyPrice,
  getMerchantSellPrice,
  merchantItemKey,
  DEFAULT_HAGGLE_DC,
  getHaggleBlocker,
  rollD20,
  rollsWithDisadvantage,
  isCheckSuccess,
  XP_REWARDS,
  getLevelUpIncrease,
  XP_LOG_LIMIT,
  getXPForLevel,
  getLevelForXP,
  getCrawlerXP,
  getSkillRank,
  getSkillXP,
  getSkillXPToSpend,
  getSkillRankForXP,
  getWeaponProficiency,
  getWeaponProficiencyXP,
  WEAPON_XP_PER_HIT,
  withSkillXP,
  MAX_SKILL_XP,
  SKILL_XP_PER_LEVEL,
  SKILL_XP_PER_SUCCESS,
  SKILL_XP_PER_TRADE,
  SKILLS,
  type SkillId,
  type AbilityKey,
  type XPLogEntry,
  type GameSettings,
  type ItemUpgrade,
  type UpgradeKind,
  type UpgradePath,
  type UpgradeTree,
  type CrawlerStatsById,
  getUpgradeKind,
  baseItemName,
} from "@/lib/gameData";
import { applyUpgradeToItem, undoLastItemUpgrade, resolveKnownSpell, upgradeUseCost, describeUpgradeEffect, describeUpgradeDrawback, FIRST_UPGRADE_ACHIEVEMENTS, CURSED_BARGAIN_ACHIEVEMENT } from "@/lib/upgrades";
import type { IconSubject } from "@/lib/iconGen";
import { FULLY_EVOLVED_ACHIEVEMENT, MEDITATING_TEXT, findDueUpgrades, nextTreeStep, stepToUpgrade, type DueUpgrade } from "@/lib/upgradeTrees";

/** An item in a crawler's inventory or one of their known spells. */
export type UpgradeTarget = { kind: 'item' | 'spell'; id: string };
export interface PendingUpgradeIcon {
  key: string;
  crawlerId: string;
  target: UpgradeTarget;
  subject: IconSubject;
  baseName: string; // the name before any upgrade renamed it
  upgrades: ItemUpgrade[];
}
import { useGame } from "@/contexts/GameContext";
import { DEFAULT_LANGUAGE_ID, questionEffectFor } from "@/lib/languages";
import type { BatchOperation } from "@/hooks/useFirebaseStore";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, FieldPath } from "firebase/firestore";
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
  statRoll?: { stat: string; modifier: number; rawRoll: number; diceLabel?: string; rollType?: string; dc?: number; success?: boolean };
  mobRoll?: boolean; // rolled by the DM for a mob (crawlerId holds the mob's combatant id)
  source?: StatSource; // the weapon or spell an attack roll was made with (counts its uses)
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
  // For a defeated mob's loot being handed out
  mobLootNotification?: {
    mobNames: string[];
    gold: number; // total gold handed out
    shares: string[]; // one line per crawler, e.g. "Vex: 5 gold, Health Potion ×2"
    partyItems: string[]; // what went to the party inventory
    destroyed?: string[]; // what got smashed while looting
  };
  // For a player undoing their combat turn
  turnResetNotification?: {
    round: number;
  };
  // For an item or spell getting an upgrade
  upgradeNotification?: {
    line: string;         // e.g. "Vex's Rusty Sword gained Heavy Edge"
    flavor?: string;
    effects: string[];
    drawback?: string;    // a cursed bargain's price, shown in red
  };
  // For XP being handed out
  xpNotification?: {
    lines: string[];    // one per crawler, e.g. "Vex: +18 XP (Killing blow on Goblin)"
    levelUps: string[]; // e.g. "Vex reached Level 4!"
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
    transact,
    bumpCounters,
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
  const inventory = useMemo(() => {
    const stored = getStableCollection<InventoryEntry>('inventory');
    if (!isLoaded || stored.length === 0) return defaultInventory;
    return stored;
  }, [getCollection, isLoaded]);

  // Crawlers, with itemLanguages worked out from what they have equipped (a druid's charm grants Beast)
  const crawlers = useMemo(() => {
    const stored = getStableCollection<Crawler>('crawlers');
    if (!isLoaded || stored.length === 0) return defaultCrawlers;
    return stored.map(c => {
      const equippedIds = Object.values(c.equippedItems ?? {});
      const items = equippedIds.length ? (inventory.find(e => e.crawlerId === c.id)?.items ?? []) : [];
      const itemLanguages = [...new Set(items.filter(i => equippedIds.includes(i.id) && i.grantsLanguage).map(i => i.grantsLanguage as string))];
      if (itemLanguages.length) return { ...c, itemLanguages };
      return c.itemLanguages ? { ...c, itemLanguages: undefined } : c;
    });
  }, [getCollection, isLoaded, inventory]);

  const mobs = useMemo(() => {
    const stored = getStableCollection<Mob>('mobs');
    if (!isLoaded || stored.length === 0) return defaultMobs;
    return stored;
  }, [getCollection, isLoaded]);

  // How each crawler plays: one counters doc per crawler (doc id = crawlerId)
  const crawlerStats = useMemo(() => getStableCollection<CrawlerStats>('crawlerStats'), [getCollection, isLoaded]);

  // Add to a crawler's stat counters. Each bump is a path in the doc plus an amount (or a new max).
  type StatBump = { path: string[]; inc?: number; max?: number; set?: unknown };
  const bumpCrawlerStats = async (crawlerId: string, bumps: StatBump[]) => {
    if (!crawlerId || bumps.length === 0) return;
    await bumpCounters('crawlerStats', crawlerId, bumps);
  };
  // A standout moment for the crawler's log (newest first, capped), used by the profile and AI prompts
  // The last list written per crawler, so moments added back to back (before the store re-renders) all stay
  const lastMoments = useRef<Record<string, CrawlerMoment[]>>({});
  const addMoment = async (crawlerId: string, text: string) => {
    if (!crawlers.some(c => c.id === crawlerId)) return;
    const stored = getCollection<CrawlerStats>('crawlerStats').find(st => st.id === crawlerId)?.moments ?? [];
    const written = lastMoments.current[crawlerId] ?? [];
    const current = (written[0]?.at ?? 0) > (stored[0]?.at ?? 0) ? written : stored;
    const moments: CrawlerMoment[] = [{ at: Date.now(), text: text.slice(0, 120) }, ...current].slice(0, CRAWLER_MOMENTS_MAX);
    lastMoments.current[crawlerId] = moments;
    await bumpCrawlerStats(crawlerId, [{ path: ['moments'], set: moments }]);
  };
  // Bumps for a weapon's or spell's own counters, plus its name so the profile can show it
  const sourceBumps = (source: StatSource | undefined, counters: Partial<Record<keyof SourceStats, number>>, maxes: Partial<Record<keyof SourceStats, number>> = {}): StatBump[] => {
    if (!source?.id) return [];
    const base = [source.kind === 'spell' ? 'spells' : 'items', statKey(source.id)];
    const bumps: StatBump[] = Object.entries(counters)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ path: [...base, k], inc: v }));
    for (const [k, v] of Object.entries(maxes)) if (v) bumps.push({ path: [...base, k], max: v });
    if (bumps.length > 0) bumps.push({ path: [...base, 'name'], set: source.name });
    return bumps;
  };

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

  // --- Experience and levels ---
  const gameSettings = useMemo((): GameSettings | null => {
    const stored = getStableCollection<GameSettings>('gameSettings');
    return stored.find(s => s.id === 'current') ?? null;
  }, [getCollection, isLoaded]);

  const setXPScale = async (xpScale: number) => {
    if (gameSettings) await updateItem('gameSettings', 'current', { xpScale } as Record<string, unknown>);
    else await addItem('gameSettings', { id: 'current', xpScale } as Record<string, unknown>);
  };

  const setLibraryHidden = async (library: 'items' | 'spells', hidden: boolean) => {
    const field = library === 'items' ? 'hideItemLibrary' : 'hideSpellLibrary';
    if (gameSettings) await updateItem('gameSettings', 'current', { [field]: hidden } as Record<string, unknown>);
    else await addItem('gameSettings', { id: 'current', [field]: hidden } as Record<string, unknown>);
  };

  const setDungeonFloor = async (dungeonFloor: number) => {
    const floor = Math.max(1, Math.floor(dungeonFloor) || 1);
    if (gameSettings) await updateItem('gameSettings', 'current', { dungeonFloor: floor } as Record<string, unknown>);
    else await addItem('gameSettings', { id: 'current', dungeonFloor: floor } as Record<string, unknown>);
  };

  /**
   * Adds XP to crawlers in one transaction, so grants landing at the same moment never lose each
   * other. Automatic grants are multiplied by the campaign's XP scale; DM awards (scaled = false)
   * are exact. Each level gained adds max HP and mana (current HP and mana rise by the same),
   * a skill point and an ability point. Posts one line per crawler to the dice history.
   */
  const awardXP = async (grants: { crawlerId: string; amount: number; reason: string }[], scaled = true) => {
    const scale = scaled ? gameSettings?.xpScale ?? 1 : 1;
    const at = Date.now();
    const byCrawler = new Map<string, XPLogEntry[]>();
    for (const g of grants) {
      const amount = Math.round(g.amount * scale);
      if (amount <= 0) continue;
      byCrawler.set(g.crawlerId, [...(byCrawler.get(g.crawlerId) ?? []), { amount, reason: g.reason, at }]);
    }
    // Default crawlers that were never saved have no document to add XP to
    const saved = getCollection<Crawler>('crawlers');
    const ids = [...byCrawler.keys()].filter(id => saved.some(c => c.id === id));
    if (ids.length === 0) return;
    let levelUps: { id: string; level: number }[] = [];
    const ok = await transact(ids.map(id => ({ collection: 'crawlers' as const, id })), (docs) => {
      levelUps = [];
      const ops: BatchOperation[] = [];
      docs.forEach((doc, i) => {
        if (!doc) return;
        const id = ids[i];
        const crawler = doc as unknown as Crawler;
        const entries = byCrawler.get(id) ?? [];
        const xp = getCrawlerXP(crawler) + entries.reduce((sum, e) => sum + e.amount, 0);
        const oldLevel = Math.max(1, Number(crawler.level) || 1);
        const gained = Math.max(0, getLevelForXP(xp) - oldLevel);
        const data: Record<string, unknown> = {
          xp,
          xpLog: [...[...entries].reverse(), ...(crawler.xpLog ?? [])].slice(0, XP_LOG_LIMIT),
        };
        if (gained > 0) {
          // 5% of max HP and mana per level, rounded up; several levels at once compound
          let maxHP = Number(crawler.maxHP) || 0;
          let maxMana = Number(crawler.maxMana) || 0;
          for (let l = 0; l < gained; l++) {
            maxHP += getLevelUpIncrease(maxHP);
            maxMana += getLevelUpIncrease(maxMana);
          }
          Object.assign(data, {
            level: oldLevel + gained,
            maxHP,
            hp: (Number(crawler.hp) || 0) + maxHP - (Number(crawler.maxHP) || 0),
            maxMana,
            mana: (Number(crawler.mana) || 0) + maxMana - (Number(crawler.maxMana) || 0),
            skillXPToSpend: getSkillXPToSpend(crawler) + SKILL_XP_PER_LEVEL * gained,
            skillPoints: 0, // old field; its points were counted into skillXPToSpend
            abilityPoints: (crawler.abilityPoints ?? 0) + gained,
          });
          levelUps.push({ id, level: oldLevel + gained });
        }
        ops.push({ type: 'update', collection: 'crawlers', id, data });
      });
      return ops;
    });
    if (!ok) return;
    const nameOf = (id: string) => crawlers.find(c => c.id === id)?.name ?? 'Unknown';
    const lines = ids.map(id => {
      const entries = byCrawler.get(id) ?? [];
      const total = entries.reduce((sum, e) => sum + e.amount, 0);
      return `${nameOf(id)}: +${total} XP (${entries.map(e => e.reason).join(', ')})`;
    });
    await addDiceRoll({
      id: crypto.randomUUID(),
      crawlerName: 'System',
      crawlerId: '__system__',
      timestamp: Date.now(),
      results: [],
      total: 0,
      xpNotification: { lines, levelUps: levelUps.map(l => `${nameOf(l.id)} reached Level ${l.level}!`) },
    });
    for (const { id, level } of levelUps) toast.success(`${nameOf(id)} reached Level ${level}!`, { icon: '⭐' });
    for (const { id, level } of levelUps) await addMoment(id, `Reached level ${level}`);
  };

  /** DM: give the same XP to one or more crawlers, exactly as typed (not scaled). */
  const awardCrawlerXP = async (crawlerIds: string[], amount: number, reason: string) => {
    const xp = Math.floor(amount);
    if (xp <= 0 || crawlerIds.length === 0) return;
    await awardXP(crawlerIds.map(crawlerId => ({ crawlerId, amount: xp, reason: reason.trim() || 'DM award' })), false);
  };

  /** Spends skill XP from level-ups on a skill. Adds to the XP the skill already has, so nothing resets. */
  const spendSkillXP = async (crawlerId: string, skillId: SkillId, amount: number) => {
    const def = SKILLS.find(s => s.id === skillId);
    const want = Math.floor(amount);
    if (!def || want <= 0) return false;
    return transact([{ collection: 'crawlers', id: crawlerId }], ([doc]) => {
      const crawler = doc as unknown as Crawler | null;
      if (!crawler) throw new Error('Crawler not found.');
      const pool = getSkillXPToSpend(crawler);
      const room = MAX_SKILL_XP - getSkillXP(crawler, skillId);
      if (room <= 0) throw new Error(`${def.name} is already at its top rank.`);
      const spend = Math.min(want, pool, room);
      if (spend <= 0) throw new Error('No skill XP to spend.');
      return [{
        type: 'update', collection: 'crawlers', id: crawlerId,
        data: { skillXP: withSkillXP(crawler, skillId, spend), skillXPToSpend: pool - spend, skillPoints: 0 },
      }];
    });
  };

  /** Skill XP a crawler earned by using a skill (a successful check). Toasts a new rank. */
  const awardSkillXP = async (crawlerId: string, skillId: SkillId, amount: number) => {
    const def = SKILLS.find(s => s.id === skillId);
    if (!def || amount <= 0 || !getCollection<Crawler>('crawlers').some(c => c.id === crawlerId)) return;
    let before = 0;
    let after = 0;
    const ok = await transact([{ collection: 'crawlers', id: crawlerId }], ([doc]) => {
      const crawler = doc as unknown as Crawler | null;
      if (!crawler) return [];
      const xp = getSkillXP(crawler, skillId);
      before = getSkillRankForXP(xp);
      after = getSkillRankForXP(Math.min(MAX_SKILL_XP, xp + amount));
      if (xp >= MAX_SKILL_XP) return [];
      return [{ type: 'update', collection: 'crawlers', id: crawlerId, data: { skillXP: withSkillXP(crawler, skillId, amount) } }];
    });
    const name = crawlers.find(c => c.id === crawlerId)?.name ?? 'Crawler';
    if (ok && after > before) toast.success(`${name} reached ${def.name} rank ${after}!`, { icon: '✨' });
  };

  /** Spends one ability point: +1 to that ability's rolls (+2 to the score). No 5-point limit after creation. */
  const spendAbilityPoint = async (crawlerId: string, ability: AbilityKey) => {
    return transact([{ collection: 'crawlers', id: crawlerId }], ([doc]) => {
      const crawler = doc as unknown as Crawler | null;
      if (!crawler) throw new Error('Crawler not found.');
      if ((crawler.abilityPoints ?? 0) <= 0) throw new Error('No ability points to spend.');
      return [{
        type: 'update', collection: 'crawlers', id: crawlerId,
        data: { [ability]: (Number(crawler[ability]) || 10) + 2, abilityPoints: (crawler.abilityPoints ?? 0) - 1 },
      }];
    });
  };

  /** A crawler finished every visible action item of a quest handout: give the quest's XP once per handout. */
  const awardQuestXP = async (assignedQuestId: string, crawlerId: string) => {
    let amount = 0;
    let questName = '';
    const ok = await transact([{ collection: 'assignedQuests', id: assignedQuestId }], ([doc]) => {
      amount = 0;
      const assigned = doc as unknown as AssignedQuest | null;
      if (!assigned || (assigned.xpAwardedTo ?? []).includes(crawlerId)) return [];
      const quest = getCollection<Quest>('quests').find(q => q.id === assigned.questId);
      if (!quest) return [];
      amount = quest.xpReward ?? XP_REWARDS.questDefault;
      questName = quest.name;
      return [{ type: 'update', collection: 'assignedQuests', id: assignedQuestId, data: { xpAwardedTo: [...(assigned.xpAwardedTo ?? []), crawlerId] } }];
    });
    if (ok && questName) {
      await bumpCrawlerStats(crawlerId, [{ path: ['questsFinished'], inc: 1 }]);
      await addMoment(crawlerId, `Finished the quest ${questName}`);
    }
    if (ok && amount > 0) await awardXP([{ crawlerId, amount, reason: `Quest: ${questName}` }]);
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
    const { activityStats: _stats, trophies: _trophies, xpLog: _xpLog, barterTrades: _trades, ...rest } = updates;
    void _stats; void _trophies; void _xpLog; void _trades;
    const finalUpdates: Partial<Crawler> = rest;
    // A profile save carries the XP and points it was opened with; only send them when edited,
    // so XP earned while the form was open isn't overwritten
    if (current) {
      for (const key of ['xp', 'skills', 'skillPoints', 'skillXP', 'skillXPToSpend', 'abilityPoints'] as const) {
        if (key in finalUpdates && JSON.stringify(finalUpdates[key]) === JSON.stringify(current[key])) delete finalUpdates[key];
      }
      // Setting the level by hand (Admin Override) moves XP to the start of that level
      if (finalUpdates.level !== undefined && finalUpdates.level !== current.level && finalUpdates.xp === undefined) {
        finalUpdates.xp = getXPForLevel(finalUpdates.level);
      }
    }
    let nearDeath = false;
    // A full profile save (it always carries maxHP) is the DM or player fixing the sheet, not damage,
    // so it doesn't count toward HP Lost. Combat damage is counted in applyCombatDamageBatch.
    const isProfileSave = rest.maxHP !== undefined;
    if (current && !isProfileSave && rest.hp !== undefined && rest.hp < (current.hp ?? 0)) {
      const deltas = getCrawlerHPLossStats(current, current.hp ?? 0, rest.hp);
      finalUpdates.activityStats = addActivityStats(current.activityStats, deltas);
      nearDeath = !!deltas.lowHealthCount;
    }
    const result = await writeCrawler(id, finalUpdates);
    if (current && finalUpdates.equippedItems) {
      const before = current.equippedItems ?? {};
      const swaps = Object.entries(finalUpdates.equippedItems)
        .filter(([slot, itemId]) => itemId && before[slot as keyof typeof before] !== itemId).length;
      await bumpCrawlerStats(id, [{ path: ['gearSwaps'], inc: swaps }]);
    }
    if (nearDeath) await awardXP([{ crawlerId: id, amount: XP_REWARDS.nearDeath, reason: 'Near death' }]);
    return result;
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
    return inventory.find((i) => i.crawlerId === SHARED_LIBRARY_ID)?.items || [];
  };

  const updateSharedInventory = async (items: InventoryItem[]) => {
    return updateCrawlerInventory(SHARED_LIBRARY_ID, items);
  };

  // Only the change from what this client showed is saved, so two people editing the same
  // inventory (e.g. the shared item library) at once don't overwrite each other's items.
  const updateCrawlerInventory = async (crawlerId: string, items: InventoryItem[]) => {
    const existing = inventory.find((i) => i.crawlerId === crawlerId) as InventoryEntry | undefined;
    // Use the existing document ID; new entries use crawlerId as the document ID per convention,
    // except the item library, whose crawlerId Firestore won't accept as a document ID
    const docId = existing?.id || (crawlerId === SHARED_LIBRARY_ID ? SHARED_LIBRARY_DOC_ID : crawlerId);
    return mergeArrayById(
      'inventory',
      docId,
      'items',
      (existing?.items || []) as unknown as Record<string, unknown>[],
      items as unknown as Record<string, unknown>[],
      { crawlerId },
    );
  };

  // Party inventory: looted items nobody has claimed yet (see lootDefeatedMobs)
  const getPartyInventory = () => getCrawlerInventory(PARTY_INVENTORY_ID);

  const updatePartyInventory = async (items: InventoryItem[]) => updateCrawlerInventory(PARTY_INVENTORY_ID, items);

  /** Moves items from the party inventory into a crawler's own, so two players can't take the same one. */
  const takeFromPartyInventory = async (crawlerId: string, itemIds: string[]) => {
    if (itemIds.length === 0) return false;
    const invDocIdOf = (ownerId: string) =>
      (inventory.find(i => i.crawlerId === ownerId) as { id?: string } | undefined)?.id || ownerId;
    const partyDocId = invDocIdOf(PARTY_INVENTORY_ID);
    const crawlerDocId = invDocIdOf(crawlerId);
    return transact(
      [{ collection: 'inventory', id: partyDocId }, { collection: 'inventory', id: crawlerDocId }],
      ([partyDoc, crawlerDoc]) => {
        const partyItems = (partyDoc?.items as InventoryItem[]) ?? [];
        const wanted = new Set(itemIds);
        const taken = partyItems.filter(i => wanted.has(i.id));
        if (taken.length === 0) throw new Error('Someone else already took that item.');
        const items = [...((crawlerDoc?.items as InventoryItem[]) ?? []), ...taken];
        return [
          { type: 'update', collection: 'inventory', id: partyDocId, data: { items: partyItems.filter(i => !wanted.has(i.id)) } },
          crawlerDoc
            ? { type: 'update', collection: 'inventory', id: crawlerDocId, data: { items } }
            : { type: 'add', collection: 'inventory', id: crawlerDocId, data: { crawlerId, items } },
        ];
      },
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
        achievement: template.achievement ?? undefined,
        locked: true,
        sentAt: new Date().toISOString(),
      } as Record<string, unknown>,
    }));
    if (operations.length > 0) await batchWrite(operations);
  };

  const unlockLootBox = async (lootBoxId: string) => {
    const box = lootBoxes.find(b => b.id === lootBoxId);
    await updateItem('lootBoxes', lootBoxId, { locked: false, unlockedAt: new Date().toISOString() });
    if (box?.locked) await bumpCrawlerStats(box.crawlerId, [{ path: ['lootBoxesByTier', statKey(box.tier)], inc: 1 }]);
    // A box's achievement lands on the crawler's profile the moment it's unlocked
    if (box?.locked && box.achievement?.name) {
      await awardTrophy(box.crawlerId, box.achievement.name, box.achievement.description);
      // A box that held only an achievement has nothing left to claim
      if (box.items.length === 0 && !box.gold) await deleteItem('lootBoxes', lootBoxId);
    }
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
        await bumpCrawlerStats(crawlerId, [{ path: ['goldEarned'], inc: box.gold }]);
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
    const quest = quests.find(q => q.id === questId);
    const allCrawlerIds = crawlers.filter(c => c.id !== 'dungeonai').map(c => c.id);
    const isPartyQuest = crawlerIds.length >= allCrawlerIds.length && allCrawlerIds.every(id => crawlerIds.includes(id));
    const assignment: AssignedQuest = {
      id: crypto.randomUUID(),
      questId,
      crawlerIds,
      isPartyQuest,
      episodeId,
      assignedAt: new Date().toISOString(),
      ...(quest ? newQuestProgress(quest) : {}),
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

  // Dice counters for crawler rolls: d20s (average, natural 20s and 1s, disadvantage), abilities
  // used, checks passed or failed, and attack rolls made with each weapon
  const diceStatBumps = (entry: DiceRollEntry): StatBump[] => {
    const roll = entry.statRoll;
    if (entry.mobRoll || !roll || !crawlers.some(c => c.id === entry.crawlerId)) return [];
    const bumps: StatBump[] = [];
    const isD20 = entry.results.some(r => r.dice.startsWith('D20')) && roll.rollType !== 'Damage' && roll.rollType !== 'Healing';
    if (isD20 && roll.rawRoll >= 1 && roll.rawRoll <= 20) {
      bumps.push({ path: ['d20Rolls'], inc: 1 }, { path: ['d20Total'], inc: roll.rawRoll });
      if (roll.rawRoll === 20) bumps.push({ path: ['nat20s'], inc: 1 });
      if (roll.rawRoll === 1) bumps.push({ path: ['nat1s'], inc: 1 });
      if (roll.diceLabel === '2d20 low' || entry.results.some(r => r.dice.includes('(Dis)'))) bumps.push({ path: ['disadvantageRolls'], inc: 1 });
    }
    const ability = abilityOfRoll(roll.stat);
    if (ability) {
      bumps.push({ path: ['rollsByAbility', ability], inc: 1 });
      // Rings and other gear that raise this ability earn upgrade XP from the roll
      const crawler = crawlers.find(c => c.id === entry.crawlerId);
      const equippedIds = new Set(Object.values(crawler?.equippedItems ?? {}));
      for (const item of getCrawlerInventory(entry.crawlerId)) {
        if (equippedIds.has(item.id) && (item.statModifiers?.[ability] ?? 0) > 0) {
          bumps.push(...sourceBumps({ kind: 'item', id: item.id, name: item.name }, { boostedRolls: 1 }));
        }
      }
    }
    if (/persuasion/i.test(roll.stat)) bumps.push({ path: ['persuasionRolls'], inc: 1 });
    if (roll.success === true) bumps.push({ path: ['checksPassed'], inc: 1 });
    if (roll.success === false) bumps.push({ path: ['checksFailed'], inc: 1 });
    if (roll.rollType === 'Attack roll' && entry.source?.kind === 'item') {
      bumps.push(...sourceBumps(entry.source, { uses: 1 }));
    }
    return bumps;
  };

  const addDiceRoll = async (entry: DiceRollEntry) => {
    await addItem('diceRolls', { ...entry } as Record<string, unknown>);
    await bumpCrawlerStats(entry.crawlerId, diceStatBumps(entry));
    // A weapon with a cursed bargain costs HP or mana on every attack roll
    if (!entry.mobRoll && entry.source?.kind === 'item' && entry.statRoll?.rollType === 'Attack roll') {
      const weapon = getCrawlerInventory(entry.crawlerId).find(i => i.id === entry.source!.id);
      const cost = upgradeUseCost(weapon?.upgrades);
      const crawler = crawlers.find(c => c.id === entry.crawlerId);
      if (crawler && (cost.hp || cost.mana)) {
        await updateCrawler(crawler.id, {
          ...(cost.hp ? { hp: Math.max(0, (crawler.hp ?? 0) - cost.hp) } : {}),
          ...(cost.mana ? { mana: Math.max(0, (crawler.mana ?? 0) - cost.mana) } : {}),
        });
        toast(`${weapon!.name} took its price: ${[cost.hp ? `${cost.hp} HP` : '', cost.mana ? `${cost.mana} mana` : ''].filter(Boolean).join(' and ')}`, { icon: '🩸' });
      }
    }
    const roll = entry.statRoll;
    if (!entry.mobRoll && roll?.rollType === 'Attack roll' && roll.rawRoll === 20 && entry.results.some(r => r.dice.startsWith('D20'))) {
      await addMoment(entry.crawlerId, `Rolled a natural 20 attacking with ${entry.source?.name ?? roll.stat.replace(/ \(.*$/, '')}`);
    }
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

    if (current) await tickLanguageEffects('noncombat');

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
    await bumpCrawlerStats(crawlerId, [{ path: ['noncombatRolls'], inc: 1 }]);
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
      let modifier = 0;
      let disadvantage = false;
      if (c.type === 'crawler') {
        const crawler = crawlers.find(cr => cr.id === c.id);
        if (crawler) {
          const mods = getEquippedModifiers(crawler, getCrawlerInventory(crawler.id));
          const dex = crawler.dex + (mods.dex ?? 0);
          modifier = Math.floor((dex - 10) / 2);
          disadvantage = rollsWithDisadvantage(crawler, dex);
        }
      }
      const { rawRoll, results, diceLabel } = rollD20(disadvantage);
      const total = rawRoll + modifier;
      rolls.push({
        id: crypto.randomUUID(),
        crawlerName: c.name,
        crawlerId: c.id,
        timestamp: Date.now(),
        results,
        total,
        statRoll: { stat: 'Initiative', modifier, rawRoll, diceLabel },
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
  // crawlerHP overrides HP written this same moment (e.g. damage over time at the start of the turn)
  const buildTurnSnapshot = (combatants: CombatantEntry[], turnIndex: number, crawlerHP: Record<string, number> = {}): CombatTurnSnapshot | undefined => {
    const active = combatants[turnIndex];
    if (!active) return undefined;
    const snapCrawlers: CombatTurnSnapshot['crawlers'] = {};
    for (const c of combatants) {
      if (c.type !== 'crawler') continue;
      const crawler = crawlers.find(cr => cr.id === c.id);
      if (!crawler) continue;
      // The active crawler's stat counters (what their turn adds to them is theirs to undo)
      const stats = c.id === active.id ? crawlerStats.find(st => st.id === c.id) : undefined;
      snapCrawlers[c.id] = { hp: crawlerHP[c.id] ?? crawler.hp ?? 0, mana: crawler.mana ?? 0, activityStats: crawler.activityStats, ...(stats ? { stats } : {}) };
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
        conditions: c.conditions ?? [],
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
    const count = combatState.combatants.length;
    // Mobs at 0 HP are skipped; if everyone left is down, the turn just passes to the next slot
    const isDownedMob = (c: CombatantEntry) => c.type === 'mob' && c.currentHP != null && c.currentHP <= 0;
    let step = 1;
    while (step < count && isDownedMob(combatState.combatants[(combatState.currentTurnIndex + step) % count])) step++;
    if (step === count && isDownedMob(combatState.combatants[combatState.currentTurnIndex])) step = 1;
    const nextIndex = combatState.currentTurnIndex + step;
    const isNewRound = nextIndex >= count;
    // Reset action flags for the combatant whose turn just ended, and count down its spell effects
    let resetCombatants = combatState.combatants.map((c, i) => {
      if (i === combatState.currentTurnIndex) {
        return { ...c, hasUsedAction: false, hasUsedBonusAction: false, feetMovedThisTurn: 0, conditions: tickConditions(c.conditions) };
      }
      return c;
    });
    const newIndex = nextIndex % count;
    // The crawler whose turn ended: how far they moved, whether they did anything, and how long it took
    const ended = combatState.combatants[combatState.currentTurnIndex];
    if (ended?.type === 'crawler') {
      const feet = Math.round(ended.feetMovedThisTurn ?? 0);
      const idle = !ended.hasUsedAction && !ended.hasUsedBonusAction && feet === 0;
      const seconds = combatState.turnStartedAt && !combatState.turnTimerPaused
        ? Math.min(600, Math.round((Date.now() - combatState.turnStartedAt) / 1000)) : 0;
      await bumpCrawlerStats(ended.id, [
        { path: ['turnsTaken'], inc: 1 },
        { path: ['turnFeet'], inc: feet },
        { path: ['idleTurns'], inc: idle ? 1 : 0 },
        { path: ['timedTurns'], inc: seconds > 0 ? 1 : 0 },
        { path: ['turnSeconds'], inc: seconds },
      ]);
    }
    if (isNewRound) await tickLanguageEffects('combat');
    // Damage or healing over time lands at the start of the next combatant's turn
    const startResult = await applyStartOfTurnConditions(resetCombatants, newIndex);
    resetCombatants = startResult.combatants;
    await updateItem('combatState', 'current', {
      combatants: resetCombatants,
      currentTurnIndex: newIndex,
      combatRound: isNewRound ? combatState.combatRound + 1 : combatState.combatRound,
      turnStartedAt: Date.now(),
      turnTimerPaused: false,
      turnSnapshot: buildTurnSnapshot(resetCombatants, newIndex, startResult.crawlerHP) ?? null,
    } as Record<string, unknown>);
    if (startResult.killedMobIds.length > 0) await lootDefeatedMobs(startResult.killedMobIds);
  };

  // One turn of a combatant's spell effects has passed; effects with no turns left wear off
  const tickConditions = (conditions?: ActiveCondition[]): ActiveCondition[] =>
    (conditions ?? []).flatMap(cond => (cond.turnsLeft > 1 ? [{ ...cond, turnsLeft: cond.turnsLeft - 1 }] : []));

  // Roll damage/healing-over-time effects for the combatant whose turn is starting.
  // Crawler HP is written straight away; mob HP is returned in the combatants list.
  const applyStartOfTurnConditions = async (combatants: CombatantEntry[], turnIndex: number) => {
    const active = combatants[turnIndex];
    const killedMobIds: string[] = [];
    const crawlerHP: Record<string, number> = {};
    const ticking = (active?.conditions ?? []).filter(c => c.perTurnType && (c.perTurnDice ?? []).some(d => d.count > 0));
    if (!active || ticking.length === 0) return { combatants, killedMobIds, crawlerHP };

    const crawler = active.type === 'crawler' ? crawlers.find(c => c.id === active.id) : undefined;
    const mob = active.type === 'mob' ? mobs.find(m => m.id === (active.sourceId || active.id)) : undefined;
    if (!crawler && !mob) return { combatants, killedMobIds, crawlerHP };
    const maxHP = crawler
      ? (crawler.maxHP || 0) + (getEquippedModifiers(crawler, getCrawlerInventory(crawler.id)).maxHP ?? 0)
      : mob?.hitPoints ?? 0;
    const startHP = crawler ? crawler.hp ?? 0 : active.currentHP ?? mob?.hitPoints ?? 0;
    let hp = startHP;

    for (const cond of ticking) {
      const results: { dice: string; result: number }[] = [];
      let total = 0;
      for (const die of cond.perTurnDice ?? []) {
        for (let i = 0; i < die.count; i++) {
          const roll = Math.floor(Math.random() * die.sides) + 1;
          results.push({ dice: `d${die.sides}`, result: roll });
          total += roll;
        }
      }
      const isHealing = cond.perTurnType === 'healing';
      hp = isHealing ? Math.min(maxHP, hp + total) : Math.max(0, hp - total);
      await addDiceRoll({
        id: crypto.randomUUID(),
        crawlerName: active.name,
        crawlerId: active.id,
        timestamp: Date.now(),
        results,
        total,
        statRoll: {
          stat: `${cond.name} from ${cond.source} (${isHealing ? 'Healing' : 'Damage'} → ${active.name})`,
          modifier: 0,
          rawRoll: total,
          diceLabel: (cond.perTurnDice ?? []).filter(d => d.count > 0).map(d => `${d.count}d${d.sides}`).join(' + '),
          rollType: isHealing ? 'Healing' : 'Damage',
        },
      });
    }

    if (crawler) {
      if (hp !== startHP) {
        crawlerHP[crawler.id] = hp;
        await writeCrawler(crawler.id, {
          hp,
          activityStats: addActivityStats(crawler.activityStats, getCrawlerHPLossStats(crawler, startHP, hp)),
        });
      }
      return { combatants, killedMobIds, crawlerHP };
    }
    if (startHP > 0 && hp === 0) killedMobIds.push(active.id);
    return { combatants: combatants.map((c, i) => (i === turnIndex ? { ...c, currentHP: hp } : c)), killedMobIds, crawlerHP };
  };

  // Edit combatants against the latest saved combat state, so an effect applied right after
  // damage doesn't overwrite the HP that damage just wrote
  const updateCombatantsFresh = (edit: (combatants: CombatantEntry[]) => CombatantEntry[]) =>
    transact([{ collection: 'combatState', id: 'current' }], ([combatDoc]) => {
      const combatants = (combatDoc?.combatants as CombatantEntry[] | undefined) ?? [];
      return [{ type: 'update', collection: 'combatState', id: 'current', data: { combatants: edit(combatants) } }];
    });

  // Put a spell's effect on each target. Recasting the same spell refreshes its effect instead of stacking.
  const applyCombatConditions = async (targetIds: string[], effect: SpellEffect, spellName: string, casterName?: string, casterId?: string, source?: StatSource) => {
    if (!combatState?.active || targetIds.length === 0 || !effect.condition.trim()) return;
    const targets = new Set(targetIds);
    const name = effect.condition.trim();
    await updateCombatantsFresh(combatants => combatants.map(c => {
      if (!targets.has(c.id)) return c;
      const others = (c.conditions ?? []).filter(cond => !(cond.source === spellName && cond.name === name));
      const condition: ActiveCondition = {
        id: crypto.randomUUID(),
        name,
        turnsLeft: Math.max(1, effect.turns || 1),
        description: effect.description?.trim() || undefined,
        source: spellName,
        casterName,
        perTurnDice: effect.perTurnType ? effect.perTurnDice : undefined,
        perTurnType: effect.perTurnType,
      };
      return { ...c, conditions: [...others, condition] };
    }));
    const names = combatState.combatants.filter(c => targets.has(c.id)).map(c => c.name);
    toast.success(`${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} now ${name}`);
    if (casterId && crawlers.some(c => c.id === casterId)) {
      await bumpCrawlerStats(casterId, sourceBumps(source, { conditions: targets.size }));
    }
  };

  // DM removes an effect early (a passed saving throw, a dispel, etc.)
  const removeCombatCondition = async (combatantId: string, conditionId: string) => {
    if (!combatState) return;
    await updateCombatantsFresh(combatants => combatants.map(c =>
      c.id === combatantId ? { ...c, conditions: (c.conditions ?? []).filter(cond => cond.id !== conditionId) } : c
    ));
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
        conditions: s.conditions ?? [],
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
    // The active crawler's stat counters go back to the turn's start too (the snapshot holds the whole doc)
    const statsNow = crawlerStats.find(st => st.id === active.id);
    const statsThen = snap.crawlers[active.id]?.stats ?? { id: active.id };
    if (active.type === 'crawler' && statsNow && JSON.stringify(statsNow) !== JSON.stringify(statsThen)) {
      crawlerOps.push({ type: 'add', collection: 'crawlerStats', id: active.id, data: { ...statsThen, id: active.id } });
    }
    if (crawlerOps.length > 0) await batchWrite(crawlerOps);
    if (active.type === 'crawler') await bumpCrawlerStats(active.id, [{ path: ['undoTurns'], inc: 1 }]);

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

  // --- Mob loot ---
  // A hostile mob that goes down in combat drops its items and gold to the crawlers in the fight
  // (see splitMobLoot). Combat state, crawlers and inventories are read and written in one
  // transaction, and the combatant is marked looted, so a mob never drops its loot twice.
  // Whether a mob combatant is one the crawlers fight (damage to friendly NPCs earns no XP)
  const isHostileMobCombatant = (combatId: string): boolean => {
    const combatant = combatState?.combatants.find(c => c.id === combatId && c.type === 'mob');
    const mob = combatant ? mobs.find(m => m.id === (combatant.sourceId || combatant.id)) : undefined;
    if (!mob) return false;
    const episode = combatState?.episodeId ? episodes.find(e => e.id === combatState.episodeId) : undefined;
    let placement: Episode['mobPlacements'][number] | undefined;
    if (episode) {
      const colonIdx = combatId.indexOf(':');
      const idx = colonIdx > 0 ? parseInt(combatId.substring(colonIdx + 1), 10) : NaN;
      placement = !isNaN(idx) && episode.mobPlacements[idx]?.mobId === mob.id
        ? episode.mobPlacements[idx]
        : episode.mobPlacements.find(p => p.mobId === mob.id);
    }
    return isPlacementHostile(placement, mob);
  };

  const lootDefeatedMobs = async (combatIds: string[]) => {
    if (!combatState || combatIds.length === 0) return;
    const episode = combatState.episodeId ? episodes.find(e => e.id === combatState.episodeId) : undefined;
    const placementIndexFor = (combatId: string, mobId: string) => {
      if (!episode) return -1;
      const colonIdx = combatId.indexOf(':');
      if (colonIdx > 0) {
        const idx = parseInt(combatId.substring(colonIdx + 1), 10);
        return !isNaN(idx) && idx < episode.mobPlacements.length && episode.mobPlacements[idx].mobId === mobId ? idx : -1;
      }
      return episode.mobPlacements.findIndex(p => p.mobId === mobId);
    };

    const drops = combatIds.flatMap(combatId => {
      const combatant = combatState.combatants.find(c => c.id === combatId && c.type === 'mob');
      if (!combatant) return [];
      const mob = mobs.find(m => m.id === (combatant.sourceId || combatant.id));
      if (!mob) return [];
      const placementIdx = placementIndexFor(combatId, mob.id);
      const placement = placementIdx >= 0 ? episode!.mobPlacements[placementIdx] : undefined;
      // Only crawlers are on the other side of a hostile mob; a friendly NPC keeps its things
      if (!isPlacementHostile(placement, mob)) return [];
      const items = placement?.inventoryOverride ?? mob.defaultInventory ?? [];
      const gold = placement?.goldOverride ?? mob.defaultGold ?? 0;
      if (items.length === 0 && gold <= 0) return [];
      const destructionChance = mob.lootDestructionChance ?? DEFAULT_LOOT_DESTRUCTION_CHANCE;
      return [{ combatId, name: combatant.name, items, gold, placementIdx, destructionChance }];
    });
    if (drops.length === 0) return;

    const recipientIds = combatState.combatants.filter(c => c.type === 'crawler').map(c => c.id);
    const invDocIdOf = (ownerId: string) =>
      (inventory.find(i => i.crawlerId === ownerId) as { id?: string } | undefined)?.id || ownerId;
    const owners = [...recipientIds, PARTY_INVENTORY_ID];
    const reads = [
      { collection: 'combatState' as const, id: 'current' },
      ...recipientIds.map(id => ({ collection: 'crawlers' as const, id })),
      ...owners.map(id => ({ collection: 'inventory' as const, id: invDocIdOf(id) })),
    ];

    let looted: typeof drops = [];
    type LootSummary = Omit<MobLootSplit, 'gold'> & { gold: Record<string, number>; levelUps: { id: string; level: number }[] };
    const emptySummary = (): LootSummary => ({ gold: {}, items: {}, party: [], destroyedGold: 0, destroyed: [], levelUps: [] });
    let summary = emptySummary();
    const ok = await transact(reads, (docs) => {
      const [combatDoc, ...rest] = docs;
      const crawlerDocs = rest.slice(0, recipientIds.length);
      const invDocs = rest.slice(recipientIds.length);
      const combatants = ((combatDoc?.combatants as CombatantEntry[]) ?? []);
      looted = drops.filter(d => {
        const c = combatants.find(x => x.id === d.combatId);
        return c && !c.looted && (c.currentHP ?? 1) <= 0;
      });
      summary = emptySummary();
      if (looted.length === 0) return [];
      // Each crawler's Looting level lowers the chance their share gets smashed
      const lootedBefore = recipientIds.map((_, i) =>
        Number((crawlerDocs[i]?.activityStats as CrawlerActivityStats | undefined)?.mobsLooted) || 0);
      const levelOf = new Map(recipientIds.map((id, i) => [id, getLootingLevel(lootedBefore[i])]));
      for (const drop of looted) {
        const split = splitMobLoot(drop.items, drop.gold, recipientIds,
          id => getLootDestructionChance(drop.destructionChance, levelOf.get(id) ?? 0));
        for (const [id, g] of Object.entries(split.gold)) summary.gold[id] = (summary.gold[id] ?? 0) + g;
        for (const [id, list] of Object.entries(split.items)) summary.items[id] = [...(summary.items[id] ?? []), ...list];
        summary.party.push(...split.party);
        summary.destroyed.push(...split.destroyed);
        summary.destroyedGold += split.destroyedGold;
      }
      const lootedIds = new Set(looted.map(d => d.combatId));
      const ops: BatchOperation[] = [{
        type: 'update',
        collection: 'combatState',
        id: 'current',
        data: { combatants: combatants.map(c => (lootedIds.has(c.id) ? { ...c, looted: true } : c)) },
      }];
      recipientIds.forEach((id, i) => {
        const crawlerDoc = crawlerDocs[i];
        if (!crawlerDoc) return;
        const activityStats = addActivityStats(crawlerDoc.activityStats as CrawlerActivityStats | undefined, { mobsLooted: looted.length });
        const data: Record<string, unknown> = { activityStats };
        if (summary.gold[id]) data.gold = (Number(crawlerDoc.gold) || 0) + summary.gold[id];
        const newLevel = getLootingLevel(activityStats.mobsLooted);
        if (newLevel > getLootingLevel(lootedBefore[i])) summary.levelUps.push({ id, level: newLevel });
        ops.push({ type: 'update', collection: 'crawlers', id, data });
      });
      owners.forEach((ownerId, i) => {
        const added = ownerId === PARTY_INVENTORY_ID ? summary.party : summary.items[ownerId];
        if (!added?.length) return;
        const invDoc = invDocs[i];
        const items = [...((invDoc?.items as InventoryItem[]) ?? []), ...added];
        ops.push(invDoc
          ? { type: 'update', collection: 'inventory', id: invDocIdOf(ownerId), data: { items } }
          : { type: 'add', collection: 'inventory', id: invDocIdOf(ownerId), data: { crawlerId: ownerId, items } });
      });
      return ops;
    });
    if (!ok || looted.length === 0) return;

    // The body is empty now, so a later fight in this episode doesn't drop the same loot again
    if (episode && looted.some(d => d.placementIdx >= 0)) {
      const fresh = episodes.find(e => e.id === episode.id) ?? episode;
      const emptied = new Set(looted.map(d => d.placementIdx).filter(i => i >= 0));
      const mobPlacements = fresh.mobPlacements.map((p, i) =>
        emptied.has(i) ? { ...p, inventoryOverride: [], goldOverride: 0 } : p);
      await updateItem('episodes', episode.id, { mobPlacements, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    }

    for (const [id, gold] of Object.entries(summary.gold)) {
      if (gold > 0 && crawlers.some(c => c.id === id)) await bumpCrawlerStats(id, [{ path: ['goldEarned'], inc: gold }]);
    }
    const nameOf = (id: string) => crawlers.find(c => c.id === id)?.name ?? 'Unknown';
    const totalGold = Object.values(summary.gold).reduce((a, b) => a + b, 0);
    const describe = (list: InventoryItem[]) =>
      stackItems(list).map(s => (s.count > 1 ? `${s.item.name} ×${s.count}` : s.item.name));
    const shares = recipientIds
      .filter(id => summary.gold[id] || summary.items[id]?.length)
      .map(id => [nameOf(id), [summary.gold[id] ? `${summary.gold[id]} gold` : '', ...describe(summary.items[id] ?? [])].filter(Boolean).join(', ')].join(': '));
    await addDiceRoll({
      id: crypto.randomUUID(),
      crawlerName: 'System',
      crawlerId: '__system__',
      timestamp: Date.now(),
      results: [],
      total: 0,
      mobLootNotification: {
        mobNames: looted.map(d => d.name),
        gold: totalGold,
        shares,
        partyItems: describe(summary.party),
        destroyed: [summary.destroyedGold ? `${summary.destroyedGold} gold` : '', ...describe(summary.destroyed)].filter(Boolean),
      },
    });
    toast.success(`Looted ${looted.map(d => d.name).join(', ')}`);
    for (const { id, level } of summary.levelUps) toast.success(`${nameOf(id)} reached Looting level ${level}!`, { icon: '💰' });
    if (summary.levelUps.length > 0) {
      await awardXP(summary.levelUps.map(({ id, level }) => ({ crawlerId: id, amount: XP_REWARDS.masteryLevelUp, reason: `Looting level ${level}` })));
    }
  };

  // Apply damage to one or more combat targets in a single pass, so splash hits don't
  // overwrite each other, and credit the attacking crawler's activity stats.
  const applyCombatDamageBatch = async (
    hits: { targetId: string; targetType: 'crawler' | 'mob'; damage: number }[],
    attackerId?: string,
    source?: StatSource,
  ) => {
    // Stat counters for the attacking crawler and the weapon or spell they used
    const attackerIsCrawler = !!attackerId && crawlers.some(c => c.id === attackerId);
    const statBumps: StatBump[] = [];
    const sourceCounts: Partial<Record<keyof SourceStats, number>> = {};
    const countFor = (key: keyof SourceStats, amount: number) => {
      if (!amount) return;
      statBumps.push({ path: [key], inc: amount });
      sourceCounts[key] = (sourceCounts[key] ?? 0) + amount;
    };
    let biggestHit = 0;
    const downedCrawlerIds: string[] = [];
    const moments: string[] = [];
    let combatants = combatState?.combatants ?? [];
    let combatantsChanged = false;
    const crawlerHP = new Map<string, number>();
    const statDeltas = new Map<string, CrawlerActivityStats>();
    const addDeltas = (crawlerId: string, deltas: CrawlerActivityStats) => {
      statDeltas.set(crawlerId, addActivityStats(statDeltas.get(crawlerId), deltas));
    };
    let killingBlows = 0;
    const killedMobIds: string[] = [];
    let hostileDamage = 0;
    const xpReasons: { amount: number; reason: string }[] = [];

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
        if (oldHP > 0 && newHP === 0) downedCrawlerIds.push(targetId);
        if (attackerIsCrawler && attackerId !== targetId) countFor('friendlyFire', dealt);
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
        const hostile = isHostileMobCombatant(targetId);
        if (hostile) hostileDamage += dealt;
        if (attackerIsCrawler && dealt > 0) {
          if (hostile) {
            sourceCounts.hits = (sourceCounts.hits ?? 0) + 1;
            sourceCounts.damage = (sourceCounts.damage ?? 0) + dealt;
            if (source?.damageType) statBumps.push({ path: ['damageByType', statKey(source.damageType)], inc: dealt });
            biggestHit = Math.max(biggestHit, dealt);
          } else {
            countFor('neutralDamage', dealt);
          }
        }
        if (hpBefore > 0 && newHP === 0) {
          killingBlows++;
          killedMobIds.push(targetId);
          if (attackerIsCrawler) {
            if (!hostile) countFor('neutralKills', 1);
            else {
              sourceCounts.kills = (sourceCounts.kills ?? 0) + 1;
              statBumps.push({ path: ['killsByMob', statKey(mob.name)], inc: 1 });
              if (isBossMob(mob)) {
                countFor('bossKills', 1);
                moments.push(`Killed the boss ${combatant?.name ?? mob.name}${source ? ` with ${source.name}` : ''}`);
              }
            }
          }
          if (hostile) {
            xpReasons.push({ amount: XP_REWARDS.killPerMobLevel * Math.max(1, mob.level || 1), reason: `Killing blow on ${combatant?.name ?? mob.name}` });
          }
        }
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
      if (endsCombat) xpReasons.push({ amount: XP_REWARDS.finisher, reason: 'Fight finisher' });
      if (endsCombat) {
        const attacker = crawlers.find(c => c.id === attackerId);
        if (attacker) toast.success(`${attacker.name} landed the final blow!`);
        const lastName = combatants.find(c => c.id === killedMobIds[killedMobIds.length - 1])?.name;
        if (lastName && !moments.some(m => m.includes(lastName))) moments.push(`Landed the final blow on ${lastName}${source ? ` with ${source.name}` : ''}`);
      }
    }

    if (combatantsChanged) {
      await updateItem('combatState', 'current', { combatants } as Record<string, unknown>);
    }
    if (attackerIsCrawler && attackerId) {
      // One weapon proficiency hit per attack, however many targets it splashed
      const profHit = !!sourceCounts.hits && !!source?.weaponType;
      const profStats = getCollection<CrawlerStats>('crawlerStats').find(st => st.id === attackerId);
      const profBefore = getWeaponProficiency(profStats, source?.weaponType);
      const profAfter = getSkillRankForXP(Math.min(MAX_SKILL_XP, getWeaponProficiencyXP(profStats, source?.weaponType) + WEAPON_XP_PER_HIT));
      if (profHit) statBumps.push({ path: ['weaponTypeHits', statKey(source!.weaponType!)], inc: 1 });
      await bumpCrawlerStats(attackerId, [...statBumps, ...sourceBumps(source, sourceCounts, { biggestHit })]);
      if (profHit && profAfter > profBefore) {
        toast.success(`${crawlers.find(c => c.id === attackerId)?.name ?? 'Crawler'} reached ${source.weaponType} proficiency ${profAfter}! (+${profAfter} to hit)`, { icon: '⚔️' });
      }
    }
    if (attackerIsCrawler && attackerId) for (const text of moments) await addMoment(attackerId, text);
    const attackerName = attackerId ? (crawlers.find(c => c.id === attackerId)?.name ?? combatants.find(c => c.id === attackerId)?.name) : undefined;
    for (const id of downedCrawlerIds) {
      await bumpCrawlerStats(id, [{ path: ['zeroHPDrops'], inc: 1 }]);
      await addMoment(id, attackerName && attackerId !== id ? `Knocked to 0 HP by ${attackerName}` : 'Knocked to 0 HP');
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

    const grants: { crawlerId: string; amount: number; reason: string }[] = [];
    if (attackerId) {
      const damageXP = Math.floor(hostileDamage / 2) * XP_REWARDS.damagePer2;
      if (damageXP > 0) grants.push({ crawlerId: attackerId, amount: damageXP, reason: `Dealt ${hostileDamage} damage` });
      grants.push(...xpReasons.map(r => ({ crawlerId: attackerId, ...r })));
    }
    for (const [id, deltas] of statDeltas) {
      if (deltas.lowHealthCount) grants.push({ crawlerId: id, amount: XP_REWARDS.nearDeath, reason: 'Near death' });
    }
    if (grants.length > 0) await awardXP(grants);
    // Loot after the attacker's stats are saved: the loot transaction reads the saved crawler,
    // so the killer's Mobs Looted count isn't overwritten by the older copy above
    if (killedMobIds.length > 0) await lootDefeatedMobs(killedMobIds);
  };

  const applyCombatDamage = async (targetId: string, targetType: 'crawler' | 'mob', damage: number, attackerId?: string, source?: StatSource) => {
    await applyCombatDamageBatch([{ targetId, targetType, damage }], attackerId, source);
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
      const before = combatState.combatants.find(c => c.id === combatantId);
      const updatedCombatants = combatState.combatants.map(c =>
        c.id === combatantId ? { ...c, currentHP: newHP } : c
      );
      await updateItem('combatState', 'current', { combatants: updatedCombatants } as Record<string, unknown>);
      if (before?.type === 'mob' && (before.currentHP ?? 1) > 0 && newHP <= 0) await lootDefeatedMobs([combatantId]);
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

    // Everyone still standing when the fight ends earns survival XP
    const survivors = combatState.combatants
      .filter(c => c.type === 'crawler' && (crawlers.find(cr => cr.id === c.id)?.hp ?? 0) > 0)
      .map(c => c.id);

    await updateItem('combatState', 'current', {
      active: false,
      phase: 'ended',
      combatants: [],
      currentTurnIndex: 0,
    } as Record<string, unknown>);
    logger.log('[GameState] ⚔️ Combat ended');
    if (combatState.phase === 'combat') {
      for (const c of combatState.combatants) {
        if (c.type !== 'crawler') continue;
        await bumpCrawlerStats(c.id, [
          { path: ['combatsFought'], inc: 1 },
          { path: ['combatsSurvived'], inc: survivors.includes(c.id) ? 1 : 0 },
          { path: ['roundsFought'], inc: combatState.combatRound || 1 },
        ]);
      }
    }
    if (combatState.phase === 'combat' && survivors.length > 0) {
      await awardXP(survivors.map(crawlerId => ({ crawlerId, amount: XP_REWARDS.survived, reason: 'Survived the fight' })));
    }
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

  // ======== Languages ========
  // Built-in languages live in code; this collection holds the ones people make up
  const customLanguages = useMemo(() => getStableCollection<CustomLanguage>('languages'), [getCollection, isLoaded]);

  /** Make up a language. When a crawler makes it, they know it straight away. */
  const createLanguage = async (name: string, description: string, crawlerId?: string) => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    const language: CustomLanguage = {
      id: `lang-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      ...(description.trim() ? { description: description.trim().slice(0, 300) } : {}),
      ...(crawlerId ? { createdByCrawlerId: crawlerId } : {}),
      createdAt: Date.now(),
    };
    await addItem('languages', language as unknown as Record<string, unknown>);
    const crawler = crawlerId ? crawlers.find(c => c.id === crawlerId) : undefined;
    if (crawler) {
      const known = crawler.languages ?? [DEFAULT_LANGUAGE_ID];
      await updateCrawler(crawler.id, { languages: [...known, language.id] });
    }
  };

  const deleteLanguage = async (id: string) => {
    await deleteItem('languages', id);
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

  /** Gives an upgrade to one crawler's copy of an item or known spell, announces it in the dice log
   *  and awards the first-upgrade achievements. */
  const giveUpgrade = async (crawlerId: string, target: UpgradeTarget, upgrade: ItemUpgrade, path?: UpgradePath) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler) return;
    let kind: UpgradeKind;
    let targetName: string;
    if (target.kind === 'item') {
      const items = getCrawlerInventory(crawlerId);
      const item = items.find(i => i.id === target.id);
      if (!item) return;
      kind = getUpgradeKind(item);
      targetName = baseItemName(item);
      // The DM's browser redraws the icon to match (see useUpgradeIcons)
      const upgraded = { ...applyUpgradeToItem(item, upgrade), upgradeIconPending: true };
      await updateCrawlerInventory(crawlerId, items.map(i => i.id === item.id ? (path ? { ...upgraded, upgradePath: path } : upgraded) : i));
    } else {
      const knownSpells = crawler.knownSpells ?? [];
      const ks = knownSpells.find(k => k.spellId === target.id);
      if (!ks) return;
      kind = 'spell';
      targetName = ks.spellName;
      await updateCrawler(crawlerId, {
        knownSpells: knownSpells.map(k => k === ks ? { ...k, upgrades: [...(k.upgrades ?? []), upgrade], upgradeIconPending: true, ...(path ? { upgradePath: path } : {}) } : k),
      });
    }
    await addDiceRoll({
      id: crypto.randomUUID(),
      crawlerName: crawler.name,
      crawlerId,
      timestamp: Date.now(),
      results: [],
      total: 0,
      upgradeNotification: {
        line: `${crawler.name}'s ${targetName} gained ${upgrade.name}${upgrade.newName ? ` and is now called ${upgrade.newName}` : ''}`,
        flavor: upgrade.flavor,
        effects: upgrade.effects.map(describeUpgradeEffect),
        drawback: upgrade.drawback ? describeUpgradeDrawback(upgrade.drawback) : undefined,
      },
    });
    await addMoment(crawlerId, `${targetName} gained ${upgrade.name}`);
    // First upgrade of each kind, and the first cursed bargain, are one-time achievements (written together,
    // since two awardTrophy calls would each start from the same trophy list)
    // Fully Evolved (finishing a tree) counts up each time
    const has = (name: string) => (crawler.trophies ?? []).some(t => t.name.toLowerCase() === name.toLowerCase());
    const evolved = !!path?.tree && (path.stepsTaken ?? 0) >= path.tree.steps.length;
    const earned = [FIRST_UPGRADE_ACHIEVEMENTS[kind], upgrade.drawback ? CURSED_BARGAIN_ACHIEVEMENT : undefined]
      .filter((a): a is { name: string; description: string } => !!a && !has(a.name));
    if (earned.length > 0 || evolved) {
      const awardedAt = new Date().toISOString();
      const newTrophy = (a: { name: string; description: string }): CrawlerTrophy => ({
        id: `trophy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: a.name, description: a.description, count: 1, awardedAt,
      });
      const trophies: CrawlerTrophy[] = [...(crawler.trophies ?? []), ...earned.map(newTrophy)];
      if (evolved) {
        const idx = trophies.findIndex(t => t.name === FULLY_EVOLVED_ACHIEVEMENT.name);
        if (idx >= 0) trophies[idx] = { ...trophies[idx], count: trophies[idx].count + 1, awardedAt };
        else trophies.push(newTrophy(FULLY_EVOLVED_ACHIEVEMENT));
        earned.push(FULLY_EVOLVED_ACHIEVEMENT);
        await addMoment(crawlerId, `${upgrade.newName ?? targetName} became Fully Evolved`);
      }
      await writeCrawler(crawlerId, { trophies });
      for (const a of earned) toast.success(`🏆 ${crawler.name} earned "${a.name}"!`);
    }
  };

  /** DM: takes back the latest upgrade on a crawler's item or known spell. */
  const undoLastUpgrade = async (crawlerId: string, target: UpgradeTarget) => {
    if (target.kind === 'item') {
      const items = getCrawlerInventory(crawlerId);
      const item = items.find(i => i.id === target.id);
      if (!item?.upgrades?.length) return;
      await updateCrawlerInventory(crawlerId, items.map(i => i.id === item.id ? undoLastItemUpgrade(item) : i));
    } else {
      const crawler = crawlers.find(c => c.id === crawlerId);
      const knownSpells = crawler?.knownSpells ?? [];
      if (!knownSpells.some(k => k.spellId === target.id && k.upgrades?.length)) return;
      await updateCrawler(crawlerId, {
        knownSpells: knownSpells.map(k => k.spellId === target.id ? { ...k, upgrades: k.upgrades!.slice(0, -1) } : k),
      });
    }
  };

  // ---- Upgrade trees: milestones, the Dungeon AI's meditation, picking a path ----

  const crawlerStatsById = useMemo(() => Object.fromEntries(crawlerStats.map(st => [st.id, st])) as CrawlerStatsById, [crawlerStats]);
  /** Items and known spells whose milestone needs acting on, or whose trees are being written. */
  const dueUpgrades = useMemo(
    () => findDueUpgrades(crawlers, getCrawlerInventory, crawlerStatsById, spells),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crawlers, inventory, crawlerStatsById, spells],
  );

  const getUpgradePath = (crawlerId: string, target: UpgradeTarget): UpgradePath | undefined =>
    target.kind === 'item'
      ? getCrawlerInventory(crawlerId).find(i => i.id === target.id)?.upgradePath
      : crawlers.find(c => c.id === crawlerId)?.knownSpells?.find(k => k.spellId === target.id)?.upgradePath;

  const setUpgradePath = async (crawlerId: string, target: UpgradeTarget, path: UpgradePath) => {
    if (target.kind === 'item') {
      const items = getCrawlerInventory(crawlerId);
      if (!items.some(i => i.id === target.id)) return;
      await updateCrawlerInventory(crawlerId, items.map(i => i.id === target.id ? { ...i, upgradePath: path } : i));
    } else {
      const knownSpells = crawlers.find(c => c.id === crawlerId)?.knownSpells ?? [];
      if (!knownSpells.some(k => k.spellId === target.id)) return;
      await updateCrawler(crawlerId, { knownSpells: knownSpells.map(k => k.spellId === target.id ? { ...k, upgradePath: path } : k) });
    }
  };

  const upgradeLogLine = async (crawlerId: string, crawlerName: string, line: string, flavor?: string) => {
    await addDiceRoll({
      id: crypto.randomUUID(), crawlerName, crawlerId, timestamp: Date.now(), results: [], total: 0,
      upgradeNotification: { line, flavor, effects: [] },
    });
  };

  /** A new milestone: unlock the picked tree's next step, or start a meditation for new trees.
   *  Returns the meditating path when the Dungeon AI now needs asking. */
  const advanceUpgrade = async (due: DueUpgrade): Promise<UpgradePath | null> => {
    const tier = due.path.tiersUsed + 1;
    const step = nextTreeStep(due.path);
    if (step) {
      await setUpgradePath(due.crawlerId, due.target, { ...due.path, tiersUsed: tier, status: 'ready' });
      await upgradeLogLine(due.crawlerId, due.crawlerName, `${due.crawlerName}'s ${due.targetName} reached Tier ${tier}. ${step.name} is ready to claim.`);
      return null;
    }
    const path: UpgradePath = { ...due.path, tiersUsed: tier, status: 'meditating', offeredAt: tier, meditatingSince: Date.now(), trees: undefined };
    await setUpgradePath(due.crawlerId, due.target, path);
    await upgradeLogLine(due.crawlerId, due.crawlerName, `${due.crawlerName}'s ${due.targetName} reached Tier ${tier}.`, MEDITATING_TEXT);
    return path;
  };

  /** The Dungeon AI's trees are in: the player picks one. Ignored if the meditation was re-rolled or finished meanwhile. */
  const offerUpgradeTrees = async (due: DueUpgrade, trees: UpgradeTree[], log: NonNullable<UpgradePath['log']>) => {
    const current = getUpgradePath(due.crawlerId, due.target);
    if (current?.status !== 'meditating') return;
    await setUpgradePath(due.crawlerId, due.target, { ...current, status: 'choosing', trees, log, meditatingSince: undefined });
    await upgradeLogLine(due.crawlerId, due.crawlerName, `The Dungeon AI has finished meditating. ${due.crawlerName}, choose a path for your ${due.targetName}.`);
  };

  /** The player picks one of the offered trees and gets its first step. */
  const chooseUpgradeTree = async (crawlerId: string, target: UpgradeTarget, treeIndex: number) => {
    const path = getUpgradePath(crawlerId, target);
    const tree = path?.status === 'choosing' ? path.trees?.[treeIndex] : undefined;
    if (!path || !tree?.steps.length) return;
    const upgrade = stepToUpgrade(tree.steps[0], tree.name, path.log?.source ?? 'preset');
    await giveUpgrade(crawlerId, target, upgrade, { ...path, status: undefined, trees: undefined, tree, stepsTaken: 1 });
  };

  /** The player claims the picked tree's next step after a new milestone. */
  const claimUpgradeStep = async (crawlerId: string, target: UpgradeTarget) => {
    const path = getUpgradePath(crawlerId, target);
    const step = path?.status === 'ready' ? nextTreeStep(path) : undefined;
    if (!path?.tree || !step) return;
    const upgrade = stepToUpgrade(step, path.tree.name, path.log?.source ?? 'preset');
    await giveUpgrade(crawlerId, target, upgrade, { ...path, status: undefined, stepsTaken: (path.stepsTaken ?? 0) + 1 });
  };

  // The name before any upgrade renamed it
  const originalItemName = (item: InventoryItem) => {
    const before = item.upgrades?.find(u => typeof u.before?.name === 'string')?.before?.name as string | undefined;
    return before ? baseItemName({ name: before, isUpgraded: true }) : baseItemName(item);
  };
  /** Upgraded items and spells whose icon hasn't been redrawn yet. */
  const pendingUpgradeIcons = useMemo((): PendingUpgradeIcon[] => crawlers.flatMap(c => [
    ...getCrawlerInventory(c.id).filter(i => i.upgradeIconPending && i.upgrades?.length).map((item): PendingUpgradeIcon => ({
      key: `${c.id}|item|${item.id}`, crawlerId: c.id, target: { kind: 'item', id: item.id },
      subject: { kind: 'item', item: { ...item, name: baseItemName(item) } }, baseName: originalItemName(item), upgrades: item.upgrades!,
    })),
    ...(c.knownSpells ?? []).filter(k => k.upgradeIconPending && k.upgrades?.length).flatMap((ks): PendingUpgradeIcon[] => {
      const spell = resolveKnownSpell(ks, spells);
      return spell ? [{
        key: `${c.id}|spell|${ks.spellId}`, crawlerId: c.id, target: { kind: 'spell', id: ks.spellId },
        subject: { kind: 'spell', spell }, baseName: ks.spellName, upgrades: ks.upgrades!,
      }] : [];
    }),
  ]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [crawlers, inventory, spells]);

  /** Saves the redrawn icon on the crawler's copy (only theirs; the library item keeps its icon). */
  const setUpgradeIcon = async (crawlerId: string, target: UpgradeTarget, iconId: string) => {
    if (target.kind === 'item') {
      const items = getCrawlerInventory(crawlerId);
      if (!items.some(i => i.id === target.id)) return;
      await updateCrawlerInventory(crawlerId, items.map(i => i.id === target.id ? { ...i, iconId, upgradeIconPending: undefined } : i));
    } else {
      const knownSpells = crawlers.find(c => c.id === crawlerId)?.knownSpells ?? [];
      if (!knownSpells.some(k => k.spellId === target.id)) return;
      await updateCrawler(crawlerId, { knownSpells: knownSpells.map(k => k.spellId === target.id ? { ...k, iconId, upgradeIconPending: undefined } : k) });
    }
  };

  /** DM: throw away the offered trees and ask the Dungeon AI again. */
  const rerollUpgradeTrees = async (crawlerId: string, target: UpgradeTarget) => {
    const path = getUpgradePath(crawlerId, target);
    if (path?.status !== 'choosing' && path?.status !== 'meditating') return;
    await setUpgradePath(crawlerId, target, { ...path, status: 'meditating', trees: undefined, meditatingSince: 0 });
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
    const spell = resolveKnownSpell(prev, spells);
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
    // Spells like Speak with Animals: know the language for the spell's duration (casting again restarts it)
    const grants = spell?.spellData.grantsLanguage;
    let languageEffects: LanguageEffect[] | undefined;
    if (spell && grants) {
      const d = spell.spellData.duration;
      const effect: LanguageEffect = {
        id: `${spellId}-${Date.now()}`,
        name: prev.spellName,
        spellId,
        languageId: grants,
        ...(d?.noncombatTurns ? { noncombatTurnsLeft: d.noncombatTurns } : {}),
        ...(d?.combatTurns ? { combatRoundsLeft: d.combatTurns } : {}),
        ...(spell.spellData.questionLimit ? { questionsLeft: spell.spellData.questionLimit } : {}),
      };
      languageEffects = [...(crawler.languageEffects ?? []).filter(e => e.spellId !== spellId), effect];
    }
    // A cursed bargain can also cost HP per cast (its mana cost is already in the spell's cost)
    const hpCost = upgradeUseCost(prev.upgrades).hp;
    const hpAfter = hpCost ? { hp: Math.max(0, (crawler.hp ?? 0) - hpCost) } : {};
    await updateCrawler(crawlerId, { knownSpells, mana: currentMana - cost, ...hpAfter, ...(languageEffects ? { languageEffects } : {}) });
    if (newMastery > prevMastery) {
      toast.success(`${crawler.name} leveled up ${prev.spellName} to mastery level ${newMastery}!`);
      await awardXP([{ crawlerId, amount: XP_REWARDS.masteryLevelUp, reason: `${prev.spellName} mastery ${newMastery}` }]);
    }
    return true;
  };

  // Count down spell languages at a new noncombat turn or combat round and drop the ones that run out.
  // Spells timed only in combat rounds end when a noncombat turn starts (an hour passes), and Speak with
  // Dead style spells with no questions left end at the next tick.
  const tickLanguageEffects = async (kind: 'noncombat' | 'combat') => {
    const ops: BatchOperation[] = [];
    for (const c of crawlers) {
      const effects = c.languageEffects;
      if (!effects?.length) continue;
      const next = effects.flatMap((e): LanguageEffect[] => {
        if (e.questionsLeft !== undefined && e.questionsLeft <= 0) return [];
        if (kind === 'noncombat') {
          if (e.noncombatTurnsLeft === undefined) return e.combatRoundsLeft === undefined ? [e] : [];
          return e.noncombatTurnsLeft > 1 ? [{ ...e, noncombatTurnsLeft: e.noncombatTurnsLeft - 1 }] : [];
        }
        if (e.combatRoundsLeft === undefined) return [e];
        return e.combatRoundsLeft > 1 ? [{ ...e, combatRoundsLeft: e.combatRoundsLeft - 1 }] : [];
      });
      if (JSON.stringify(next) !== JSON.stringify(effects)) {
        ops.push({ type: 'update', collection: 'crawlers', id: c.id, data: { languageEffects: next } });
      }
    }
    if (ops.length > 0) await batchWrite(ops);
  };

  // Restore HP to a crawler, capped at their effective max HP (equipment included)
  // `healerId` and `source`: the crawler and spell or item that healed, for their stats
  const healCrawler = async (crawlerId: string, amount: number, healerId?: string, source?: StatSource) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    if (!crawler || amount <= 0) return;
    const mods = getEquippedModifiers(crawler, getCrawlerInventory(crawlerId));
    const effectiveMaxHP = (crawler.maxHP || 0) + (mods.maxHP ?? 0);
    const newHP = Math.min(effectiveMaxHP, (crawler.hp ?? 0) + amount);
    await updateCrawler(crawlerId, { hp: newHP });
    const healed = Math.max(0, newHP - (crawler.hp ?? 0));
    if (healed > 0) {
      await bumpCrawlerStats(crawlerId, [{ path: ['healingReceived'], inc: healed }]);
      if (healerId && crawlers.some(c => c.id === healerId)) {
        await bumpCrawlerStats(healerId, [{ path: ['healingDone'], inc: healed }, ...sourceBumps(source, { healing: healed })]);
        if ((crawler.hp ?? 0) <= 0 && healerId !== crawlerId) {
          await addMoment(healerId, `Brought ${crawler.name} back from 0 HP${source ? ` with ${source.name}` : ''}`);
        }
      }
    }
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
  const npcMemories = useMemo((): Record<string, NpcMemory> => {
    const docData = npcAiDocs.find(d => d.id === 'memories');
    if (!docData) return {};
    const { id: _id, ...entries } = docData;
    return entries as Record<string, NpcMemory>;
  }, [npcAiDocs]);

  // --- Merchants ---
  // Live stock and gold live in merchants/{mobId}. Every trade reads that doc, the crawler and
  // their inventory on the server and writes all three at once, so two crawlers can't buy the
  // same last item and gold never goes missing.
  const merchants = useMemo(() => getStableCollection<MerchantState>('merchants'), [getCollection, isLoaded]);

  const merchantDocOps = (mob: Mob, existing: boolean, next: MerchantState): BatchOperation => existing
    ? { type: 'update', collection: 'merchants', id: mob.id, data: { stock: next.stock, gold: next.gold, discounts: next.discounts ?? {}, haggles: next.haggles ?? {} } }
    : { type: 'add', collection: 'merchants', id: mob.id, data: next as unknown as Record<string, unknown> };

  const inventoryOp = (crawlerId: string, invDocId: string, existing: boolean, items: InventoryItem[]): BatchOperation => existing
    ? { type: 'update', collection: 'inventory', id: invDocId, data: { items } }
    : { type: 'add', collection: 'inventory', id: invDocId, data: { crawlerId, items } };

  const tradeReads = (mob: Mob, crawlerId: string) => {
    const invDocId = (inventory.find(i => i.crawlerId === crawlerId) as { id?: string } | undefined)?.id || crawlerId;
    return {
      invDocId,
      reads: [
        { collection: 'merchants' as const, id: mob.id },
        { collection: 'crawlers' as const, id: crawlerId },
        { collection: 'inventory' as const, id: invDocId },
      ],
    };
  };

  // Every completed trade counts toward Barter; say so when it reaches a new rank
  const withBarterNotice = async (crawlerId: string, trade: Promise<boolean>) => {
    const crawler = crawlers.find(c => c.id === crawlerId);
    const before = getSkillRank(crawler, 'barter');
    const ok = await trade;
    if (ok && crawler && getSkillRankForXP(getSkillXP(crawler, 'barter') + SKILL_XP_PER_TRADE) > before) {
      toast.success(`${crawler.name} reached Barter rank ${before + 1}!`, { icon: '🪙' });
    }
    return ok;
  };

  /** Buys one of the stock line matching `item`. Returns true when the trade went through. */
  const buyFromMerchant = async (mob: Mob, crawlerId: string, item: InventoryItem) => {
    if (!mob.merchant) return false;
    const config = mob.merchant;
    const key = merchantItemKey(item);
    const { invDocId, reads } = tradeReads(mob, crawlerId);
    let spent = 0;
    const ok = await withBarterNotice(crawlerId, transact(reads, ([merchantDoc, crawlerDoc, invDoc]) => {
      if (!crawlerDoc) throw new Error('Crawler not found.');
      const state = (merchantDoc as unknown as MerchantState | null) ?? createMerchantState(mob.id, config);
      const idx = state.stock.findIndex(e => merchantItemKey(e.item) === key);
      if (idx < 0 || state.stock[idx].quantity <= 0) throw new Error(`${mob.name} is sold out of ${item.name}.`);
      const trades = Number(crawlerDoc.barterTrades) || 0;
      const trader = crawlerDoc as unknown as Crawler;
      const price = getMerchantBuyPrice(state.stock[idx].item.goldValue, getEffectiveScrooge(config, state, crawlerId, getSkillRank(trader, 'barter')));
      const gold = Number(crawlerDoc.gold) || 0;
      if (gold < price) throw new Error(`Not enough gold: ${item.name} costs ${price}.`);
      const stock: MerchantStockEntry[] = state.stock
        .map((e, i) => (i === idx ? { ...e, quantity: e.quantity - 1 } : e))
        .filter(e => e.quantity > 0);
      const bought: InventoryItem = { ...state.stock[idx].item, id: `item-${crypto.randomUUID()}` };
      const items = [...(((invDoc?.items as InventoryItem[]) ?? [])), bought];
      spent = price;
      return [
        merchantDocOps(mob, !!merchantDoc, { ...state, stock, gold: state.gold + price }),
        { type: 'update', collection: 'crawlers', id: crawlerId, data: { gold: gold - price, barterTrades: trades + 1, skillXP: withSkillXP(trader, 'barter', SKILL_XP_PER_TRADE) } },
        inventoryOp(crawlerId, invDocId, !!invDoc, items),
      ];
    }));
    if (ok) await bumpCrawlerStats(crawlerId, [{ path: ['goldSpent'], inc: spent }, { path: ['itemsBought'], inc: 1 }]);
    return ok;
  };

  /**
   * Sells one inventory item. `minGold` is what the player agreed to take: the full price, or the
   * merchant's remaining gold when they chose to sell for less. If the merchant can no longer pay
   * that much the sale is cancelled.
   */
  const sellToMerchant = async (mob: Mob, crawlerId: string, itemId: string, minGold: number) => {
    if (!mob.merchant) return false;
    const config = mob.merchant;
    const { invDocId, reads } = tradeReads(mob, crawlerId);
    let earned = 0;
    const ok = await withBarterNotice(crawlerId, transact(reads, ([merchantDoc, crawlerDoc, invDoc]) => {
      if (!crawlerDoc) throw new Error('Crawler not found.');
      const state = (merchantDoc as unknown as MerchantState | null) ?? createMerchantState(mob.id, config);
      const owned = ((invDoc?.items as InventoryItem[]) ?? []);
      const item = owned.find(i => i.id === itemId);
      if (!item) throw new Error('That item is no longer in your inventory.');
      const trades = Number(crawlerDoc.barterTrades) || 0;
      const trader = crawlerDoc as unknown as Crawler;
      const price = getMerchantSellPrice(item.goldValue, getEffectiveScrooge(config, state, crawlerId, getSkillRank(trader, 'barter')));
      const paid = Math.min(price, state.gold);
      if (paid < minGold) throw new Error(`${mob.name} only has ${state.gold} gold left now. Try again.`);
      earned = paid;
      const key = merchantItemKey(item);
      const idx = state.stock.findIndex(e => merchantItemKey(e.item) === key);
      const { equipped: _eq, ...cleanItem } = item;
      const stock: MerchantStockEntry[] = idx >= 0
        ? state.stock.map((e, i) => (i === idx ? { ...e, quantity: e.quantity + 1 } : e))
        : [...state.stock, { item: { ...cleanItem, id: `merch-${crypto.randomUUID()}` }, quantity: 1 }];
      // Selling an equipped item takes it off
      const equipped = { ...((crawlerDoc.equippedItems as Record<string, string>) ?? {}) };
      for (const [slot, id] of Object.entries(equipped)) if (id === itemId) delete equipped[slot];
      return [
        merchantDocOps(mob, !!merchantDoc, { ...state, stock, gold: state.gold - paid }),
        { type: 'update', collection: 'crawlers', id: crawlerId, data: { gold: (Number(crawlerDoc.gold) || 0) + paid, equippedItems: equipped, barterTrades: trades + 1, skillXP: withSkillXP(trader, 'barter', SKILL_XP_PER_TRADE) } },
        inventoryOp(crawlerId, invDocId, !!invDoc, owned.filter(i => i.id !== itemId)),
      ];
    }));
    if (ok) await bumpCrawlerStats(crawlerId, [{ path: ['goldEarned'], inc: earned }, { path: ['itemsSold'], inc: 1 }]);
    return ok;
  };

  /** DM: reset stock, gold and haggling from the merchant's settings. */
  const restockMerchant = async (mob: Mob) => {
    if (!mob.merchant) return false;
    const config = mob.merchant;
    return transact([{ collection: 'merchants', id: mob.id }], () => [
      // A restock intentionally replaces the whole live state
      { type: 'add', collection: 'merchants', id: mob.id, data: createMerchantState(mob.id, config) as unknown as Record<string, unknown> },
    ]);
  };

  /**
   * Rolls Persuasion (d20 + CHA mod, with equipment) to haggle. A roll that meets the DC asks the
   * DM to approve one Scrooge level off for this crawler. One try per crawler until the next restock.
   * Uses the crawler's action in combat, or one of their rolls this noncombat turn.
   */
  const haggleWithMerchant = async (mob: Mob, crawler: Crawler) => {
    if (!mob.merchant) return null;
    const config = mob.merchant;
    const existing = merchants.find(m => m.id === mob.id);
    if (existing?.haggles?.[crawler.id]) {
      toast.error(`You already haggled with ${mob.name}. Try again after they restock.`);
      return null;
    }
    const blocker = getHaggleBlocker(crawler.id, combatState, noncombatTurnState);
    if (blocker) {
      toast.error(blocker);
      return null;
    }
    const cha = crawler.cha + (getEquippedModifiers(crawler, getCrawlerInventory(crawler.id)).cha ?? 0);
    const barter = getSkillRank(crawler, 'barter');
    const persuasion = getSkillRank(crawler, 'persuasion');
    const modifier = Math.floor((cha - 10) / 2) + barter + persuasion;
    const { rawRoll, results, diceLabel } = rollD20(rollsWithDisadvantage(crawler, cha));
    const total = rawRoll + modifier;
    const dc = config.haggleDC ?? DEFAULT_HAGGLE_DC;
    const entry: MerchantHaggle = { state: isCheckSuccess(rawRoll, total, dc) ? 'pending' : 'failed', crawlerName: crawler.name, total, dc, at: Date.now() };
    const ok = await transact([{ collection: 'merchants', id: mob.id }], ([merchantDoc]) => {
      const state = (merchantDoc as unknown as MerchantState | null) ?? createMerchantState(mob.id, config);
      if (state.haggles?.[crawler.id]) throw new Error(`You already haggled with ${mob.name}. Try again after they restock.`);
      return [merchantDocOps(mob, !!merchantDoc, { ...state, haggles: { ...(state.haggles ?? {}), [crawler.id]: entry } })];
    });
    if (!ok) return null;
    await bumpCrawlerStats(crawler.id, [{ path: ['haggles'], inc: 1 }]);
    // Haggling costs the action (combat) or one of this turn's rolls (noncombat)
    if (combatState?.active && combatState.phase !== 'ended') await recordCombatAction(crawler.id, 'action');
    else await recordNoncombatRoll(crawler.id);
    await addDiceRoll({
      id: crypto.randomUUID(),
      crawlerName: crawler.name,
      crawlerId: crawler.id,
      timestamp: Date.now(),
      results,
      total,
      statRoll: { stat: `Haggle with ${mob.name} (Persuasion${persuasion ? ` ${persuasion}` : ''}${barter ? ` + Barter ${barter}` : ''})`, modifier, rawRoll, diceLabel, dc, success: entry.state === 'pending' },
    });
    // A haggle roll is a Persuasion check: making the DC trains Persuasion
    if (entry.state === 'pending') await awardSkillXP(crawler.id, 'persuasion', SKILL_XP_PER_SUCCESS);
    return entry;
  };

  /** DM: approve (one Scrooge level off for that crawler) or deny a haggle that met the DC. */
  const resolveMerchantHaggle = async (mob: Mob, crawlerId: string, approve: boolean) => {
    let approved = false;
    const ok = await transact([{ collection: 'merchants', id: mob.id }], ([merchantDoc]) => {
      approved = false;
      const state = merchantDoc as unknown as MerchantState | null;
      const haggle = state?.haggles?.[crawlerId];
      if (!state || !haggle || haggle.state !== 'pending') return [];
      const discounts = { ...(state.discounts ?? {}) };
      if (approve) discounts[crawlerId] = (discounts[crawlerId] ?? 0) + 1;
      approved = approve;
      return [{
        type: 'update', collection: 'merchants', id: mob.id,
        data: { discounts, haggles: { ...state.haggles, [crawlerId]: { ...haggle, state: approve ? 'approved' : 'denied' } } },
      }];
    });
    if (ok && approved) {
      await bumpCrawlerStats(crawlerId, [{ path: ['haggleWins'], inc: 1 }]);
      await addMoment(crawlerId, `Talked ${mob.name} into lower prices`);
    }
    return ok;
  };

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
    if (entry.authorType === 'crawler') {
      await bumpCrawlerStats(entry.authorId, entry.translationOf
        ? [{ path: ['translations'], inc: 1 }]
        : [
          { path: [entry.viaVoice ? 'voiceLines' : 'typedLines'], inc: 1 },
          { path: ['npcLines'], inc: (entry.toMobIds?.length || entry.nearMobIds?.length) ? 1 : 0 },
        ]);
    }
    // Speak with Dead style spells: each line in the language uses up a question
    if (entry.authorType === 'crawler' && !entry.translationOf) {
      const crawler = crawlers.find(c => c.id === entry.authorId);
      const effect = questionEffectFor(crawler, entry.language);
      if (crawler && effect) {
        await updateCrawler(crawler.id, {
          languageEffects: (crawler.languageEffects ?? []).map(e => (e.id === effect.id ? { ...e, questionsLeft: (e.questionsLeft ?? 1) - 1 } : e)),
        });
      }
    }
  };

  // Spoken voices: link the clips the DM's browser made for an NPC line
  const attachChatAudio = async (messageId: string, audio: Pick<ChatMessage, 'audioUrl' | 'audioScrambledUrl'>) => {
    await updateItem('chatMessages', messageId, audio as unknown as Record<string, unknown>);
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
  const writeNpcAiDoc = async (docId: 'settings' | 'secrets' | 'memories', data: Record<string, unknown>) => {
    if (npcAiDocs.some(d => d.id === docId)) {
      await updateItem('npcAi', docId, data);
    } else {
      await addItem('npcAi', { id: docId, ...data });
    }
  };

  // One speaker's entry in npcAi/secrets or npcAi/memories, replaced as a whole. Creature copies have
  // ids like "goblinId~b", and updateDoc rejects "~" in a field path, so write with an explicit FieldPath.
  const writeNpcAiEntry = async (docId: 'secrets' | 'memories', key: string, value: Record<string, unknown>) => {
    if (!db) {
      await writeNpcAiDoc(docId, { [key]: value });
      return;
    }
    const path = roomId ? `rooms/${roomId}/npcAi/${docId}` : `npcAi/${docId}`;
    const clean = JSON.parse(JSON.stringify(value)) as Record<string, unknown>; // drops undefined fields
    try {
      await setDoc(doc(db, path), { [key]: clean }, { mergeFields: [new FieldPath(key)] });
    } catch (err) {
      logger.error('[GameState] ❌ NPC AI write failed', { docId, key, err });
      toast.error('Failed to save changes. Please try again.', { id: 'save-error' });
      throw err;
    }
  };

  const updateNpcAiSettings = async (updates: Partial<Omit<NpcAiSettings, 'id'>>) => {
    await writeNpcAiDoc('settings', updates as Record<string, unknown>);
  };

  // DM edits to what a speaker remembers (an empty note list with no feelings clears it)
  const setNpcMemory = async (speakerId: string, memory: NpcMemory) => {
    await writeNpcAiEntry('memories', speakerId, { ...memory, updatedAt: Date.now() });
  };

  const setNpcSecretState = async (mobId: string, state: NpcSecretState) => {
    const entry: NpcSecretEntry = { state, at: Date.now() };
    await writeNpcAiEntry('secrets', mobId, { ...entry });
  };

  return {
    giveUpgrade,
    undoLastUpgrade,
    crawlerStatsById,
    dueUpgrades,
    advanceUpgrade,
    offerUpgradeTrees,
    chooseUpgradeTree,
    claimUpgradeStep,
    rerollUpgradeTrees,
    pendingUpgradeIcons,
    setUpgradeIcon,
    crawlers,
    crawlerStats,
    updateCrawler,
    addCrawler,
    deleteCrawler,
    inventory,
    getCrawlerInventory,
    updateCrawlerInventory,
    getPartyInventory,
    updatePartyInventory,
    takeFromPartyInventory,
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
    gameSettings,
    setXPScale,
    setDungeonFloor,
    setLibraryHidden,
    awardCrawlerXP,
    spendSkillXP,
    awardSkillXP,
    spendAbilityPoint,
    awardQuestXP,
    applyCombatConditions,
    removeCombatCondition,
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
    npcMemories,
    setNpcMemory,
    sendChatMessage,
    attachChatAudio,
    clearChat,
    customLanguages,
    createLanguage,
    deleteLanguage,
    updateNpcAiSettings,
    setNpcSecretState,
    merchants,
    buyFromMerchant,
    sellToMerchant,
    restockMerchant,
    haggleWithMerchant,
    resolveMerchantHaggle,
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
