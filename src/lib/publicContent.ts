import type {
  CampaignMapDoc,
  Episode,
  EpisodeMobPlacement,
  LootBoxTemplate,
  MapSettings,
  Mob,
  PublicEpisode,
  PublicEpisodeAssets,
  Quest,
} from './gameData';
import { stripNpcSecret } from './gameData';

/**
 * Pure helpers for publishing campaign content to the community collections and
 * importing it back into a campaign. No Firebase calls here.
 *
 * NOTE: scripts/publish-my-content.mjs duplicates buildEpisodeBundle (plain JS, run with node).
 * Keep the two in sync if the bundle format changes.
 */

/** Public doc ID — prefixed with the source campaign so campaign copies never collide. */
export const publicDocId = (campaignId: string, sourceId: string) => `${campaignId}__${sourceId}`;

/**
 * Episodes reference maps by their *position* in the campaign's map list, and Firestore
 * lists documents sorted by ID. Random IDs can therefore land mid-list and shift every
 * later map's index. These IDs always sort after every existing ID, so new maps are appended.
 */
export const sortableMapIds = (existingIds: string[], count: number): string[] => {
  let base = 'z' + Date.now().toString(36).padStart(9, '0');
  while (existingIds.some((id) => id >= base)) base = 'z' + base;
  return Array.from({ length: count }, (_, i) => `${base}-${i.toString().padStart(3, '0')}`);
};

/** Strip campaign/community bookkeeping from a mob so it can be bundled or imported. */
const toMobType = (mob: Mob): Mob => {
  const { createdBy: _cb, createdByUsername: _cbu, isPublic: _p, ...rest } = mob as Mob & Record<string, unknown>;
  delete (rest as Record<string, unknown>).sourceId;
  delete (rest as Record<string, unknown>).sourceCampaignId;
  delete (rest as Record<string, unknown>).publishedAt;
  delete (rest as Record<string, unknown>).roomId;
  return stripNpcSecret({ ...(rest as Mob), encountered: false });
};

/** Fresh fog of war for a new playthrough, keeping whether fog is enabled and the map scale. */
const resetMapSettings = (settings: MapSettings): MapSettings => ({
  ...settings,
  fogOfWar: { enabled: settings.fogOfWar?.enabled ?? false, revealedAreas: [] },
});

/** A quest as a reusable template: keep its design, clear every crawler's progress and notes. */
const toQuestTemplate = (quest: Quest): Quest => ({
  id: quest.id,
  name: quest.name,
  description: quest.description || '',
  rewards: (quest.rewards || []).map(({ claimedBy: _c, ...r }) => r),
  actionItems: (quest.actionItems || []).map((a) => ({ ...a, completedBy: [] })),
  notes: [],
  createdAt: quest.createdAt,
  updatedAt: quest.updatedAt,
});

/** Drop per-playthrough state from a placement (HP after combat). */
const resetPlacement = (p: EpisodeMobPlacement, mapId: string): EpisodeMobPlacement => {
  const { currentHP: _hp, ...rest } = p;
  return { ...rest, mapId };
};

/**
 * Turn a campaign episode into a self-contained bundle.
 * @param mapDocs campaign maps aligned with the index-based `episode.mapIds`
 */
export const buildEpisodeBundle = (
  episode: Episode,
  mapDocs: CampaignMapDoc[],
  mobs: Mob[],
  lootBoxTemplates: LootBoxTemplate[],
  quests: Quest[] = [],
): {
  episode: Omit<PublicEpisode, 'id' | 'sourceId' | 'sourceCampaignId' | 'createdBy' | 'createdByUsername' | 'publishedAt'>;
  assets: PublicEpisodeAssets;
} => {
  // Campaign map index (string) → bundle index (string)
  const mapIndexToBundle = new Map<string, string>();
  const bundleMaps: { name: string; image: string }[] = [];
  for (const mapId of episode.mapIds) {
    const doc = mapDocs[parseInt(mapId, 10)];
    if (!doc?.image || mapIndexToBundle.has(mapId)) continue;
    mapIndexToBundle.set(mapId, String(bundleMaps.length));
    bundleMaps.push({ name: doc.name || `Map ${bundleMaps.length + 1}`, image: doc.image });
  }

  // Placements without a mapId belong to the first map (matches DungeonAIView/ShowTimeView)
  const firstMapId = episode.mapIds[0];
  const mobPlacements: EpisodeMobPlacement[] = [];
  for (const p of episode.mobPlacements || []) {
    const bundleIdx = mapIndexToBundle.get(p.mapId || firstMapId);
    if (bundleIdx === undefined) continue;
    if (!mobs.some((m) => m.id === p.mobId)) continue;
    mobPlacements.push(resetPlacement(p, bundleIdx));
  }

  const usedMobIds = new Set(mobPlacements.map((p) => p.mobId));
  const bundleMobs = mobs.filter((m) => usedMobIds.has(m.id)).map(toMobType);

  const mapSettings: { [idx: string]: MapSettings } = {};
  for (const [mapId, settings] of Object.entries(episode.mapSettings || {})) {
    const bundleIdx = mapIndexToBundle.get(mapId);
    if (bundleIdx !== undefined && settings) mapSettings[bundleIdx] = resetMapSettings(settings);
  }

  const templateIds = new Set(episode.lootBoxIds || []);
  const bundleTemplates = [
    ...lootBoxTemplates.filter((t) => templateIds.has(t.id)),
    ...(episode.lootBoxes || []).filter((t) => !templateIds.has(t.id)), // deprecated embedded templates
  ].map(({ id, name, tier, items, gold }) => ({ id, name, tier, items, ...(gold !== undefined ? { gold } : {}) }));

  const questIds = new Set(episode.questIds || []);
  const bundleQuests = quests.filter((q) => questIds.has(q.id)).map(toQuestTemplate);

  return {
    episode: {
      name: episode.name,
      description: episode.description || '',
      mapNames: bundleMaps.map((m) => m.name),
      mobNames: bundleMobs.map((m) => m.name),
      mobPlacements,
      mapSettings,
      ...(episode.defaultFogOfWar !== undefined ? { defaultFogOfWar: episode.defaultFogOfWar } : {}),
      ...(episode.startingGameTime !== undefined ? { startingGameTime: episode.startingGameTime } : {}),
      lootBoxTemplates: bundleTemplates,
      quests: bundleQuests,
    },
    assets: { maps: bundleMaps, mobs: bundleMobs },
  };
};

/**
 * Plan the writes needed to import a public episode into a campaign.
 * New maps must be written with `mapDocIds` (which sort last) so they land at
 * indices `baseMapIndex + i` in the campaign's map list.
 */
export const planEpisodeImport = (
  pub: PublicEpisode,
  assets: PublicEpisodeAssets,
  opts: { baseMapIndex: number; mapDocIds: string[]; newId: () => string },
): {
  maps: { id: string; name: string; image: string }[];
  mobs: Mob[];
  lootBoxTemplates: LootBoxTemplate[];
  quests: Quest[];
  episode: Episode;
} => {
  const maps = assets.maps
    .filter((m) => !!m.image)
    .map((m, i) => ({ id: opts.mapDocIds[i], name: m.name, image: m.image }));
  // Bundle index → new campaign index (skipping any empty map images)
  const bundleToCampaign = new Map<string, string>();
  let next = 0;
  assets.maps.forEach((m, i) => {
    if (m.image) bundleToCampaign.set(String(i), String(opts.baseMapIndex + next++));
  });

  const mobIdMap = new Map<string, string>();
  const mobs = assets.mobs.map((m) => {
    const id = opts.newId();
    mobIdMap.set(m.id, id);
    return {
      ...toMobType(m),
      id,
      ...(pub.createdBy ? { createdBy: pub.createdBy } : {}),
      ...(pub.createdByUsername ? { createdByUsername: pub.createdByUsername } : {}),
    };
  });

  const templateIdMap = new Map<string, string>();
  const lootBoxTemplates = (pub.lootBoxTemplates || []).map((t) => {
    const id = opts.newId();
    templateIdMap.set(t.id, id);
    return { ...t, id };
  });

  const now = new Date().toISOString();
  const quests = (pub.quests || []).map((q) => ({ ...toQuestTemplate(q), id: opts.newId(), createdAt: now, updatedAt: now }));

  const mobPlacements = (pub.mobPlacements || [])
    .filter((p) => bundleToCampaign.has(p.mapId) && mobIdMap.has(p.mobId))
    .map((p) => ({ ...p, mapId: bundleToCampaign.get(p.mapId)!, mobId: mobIdMap.get(p.mobId)! }));

  const mapSettings: { [mapId: string]: MapSettings } = {};
  for (const [idx, settings] of Object.entries(pub.mapSettings || {})) {
    const mapId = bundleToCampaign.get(idx);
    if (mapId !== undefined) mapSettings[mapId] = resetMapSettings(settings);
  }

  return {
    maps,
    mobs,
    lootBoxTemplates,
    quests,
    episode: {
      id: opts.newId(),
      name: pub.name,
      description: pub.description || '',
      mapIds: Array.from(bundleToCampaign.values()),
      mobPlacements,
      mapSettings,
      ...(pub.defaultFogOfWar !== undefined ? { defaultFogOfWar: pub.defaultFogOfWar } : {}),
      ...(pub.startingGameTime !== undefined ? { startingGameTime: pub.startingGameTime } : {}),
      lootBoxIds: lootBoxTemplates.map((t) => t.id),
      ...(quests.length > 0 ? { questIds: quests.map((q) => q.id) } : {}),
      createdBy: pub.createdBy,
      ...(pub.createdByUsername ? { createdByUsername: pub.createdByUsername } : {}),
      createdAt: now,
      updatedAt: now,
    },
  };
};
