/**
 * Pure planning for "Import old content": copying content saved before campaigns existed
 * (top-level Firestore collections) into the current campaign. No Firebase calls here.
 *
 * Every copied document gets `legacyId` (its original document ID) so running the import
 * again skips what was already copied. The originals are never changed.
 */

type Doc = Record<string, unknown>;

export interface LegacySource {
  inventory: Doc[];
  crawlers: Doc[];
  mobs: Doc[];
  maps: Doc[];
  episodes: Doc[];
  quests: Doc[];
  lootBoxTemplates: Doc[];
}

export interface CampaignSnapshot {
  /** Raw persisted docs of the current campaign, per collection */
  crawlers: Doc[];
  mobs: Doc[];
  maps: Doc[];
  episodes: Doc[];
  quests: Doc[];
  lootBoxTemplates: Doc[];
  inventory: Doc[];
  /** Items currently in the campaign's item library */
  libraryItems: Doc[];
}

export interface LegacyImportPlan {
  libraryItems: Doc[];
  crawlers: Doc[];
  crawlerInventories: { crawlerId: string; items: Doc[] }[];
  mobs: Doc[];
  maps: Doc[];
  episodes: Doc[];
  quests: Doc[];
  lootBoxTemplates: Doc[];
}

export const mapImageOf = (m: Doc) =>
  (m?.image as string) || (m?.imageUrl as string) || (m?.url as string) || (m?.value as string) || '';

/** Docs that hold a map image, in Firestore's list order (sorted by ID) — the order episodes index into */
const imageMaps = (docs: Doc[]) =>
  [...docs].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)).filter((m) => !!mapImageOf(m));

export const planLegacyImport = (
  source: LegacySource,
  campaign: CampaignSnapshot,
  opts: {
    creator: { createdBy: string; createdByUsername?: string };
    newId: () => string;
    /** IDs that sort after every existing map ID, so new maps are appended */
    mapDocIds: (count: number) => string[];
  },
): LegacyImportPlan => {
  const { creator, newId } = opts;
  const now = new Date().toISOString();
  const withCreator = (d: Doc): Doc => (d.createdBy ? d : { ...d, ...creator });
  const strip = (d: Doc): Doc => {
    const { roomId: _r, storagePath: _s, ...rest } = d;
    return rest;
  };

  /**
   * Copy one collection: keep each document's ID unless the campaign already uses it,
   * skip documents imported before. Returns the copies and old ID → campaign ID.
   */
  const copyDocs = (legacy: Doc[], existing: Doc[]) => {
    const idMap = new Map<string, string>();
    const existingIds = new Set(existing.map((d) => String(d.id)));
    for (const d of existing) if (d.legacyId) idMap.set(String(d.legacyId), String(d.id));
    const copies: Doc[] = [];
    for (const d of legacy) {
      const oldId = String(d.id);
      if (idMap.has(oldId)) continue;
      const id = existingIds.has(oldId) ? newId() : oldId;
      existingIds.add(id);
      idMap.set(oldId, id);
      copies.push({ ...strip(d), id, legacyId: oldId });
    }
    return { copies, idMap };
  };

  const crawlers = copyDocs(source.crawlers, campaign.crawlers);
  const mobs = copyDocs(source.mobs, campaign.mobs);
  const quests = copyDocs(source.quests, campaign.quests);
  const templates = copyDocs(source.lootBoxTemplates, campaign.lootBoxTemplates);

  // ── Maps: appended after the campaign's maps; episodes refer to maps by position ──
  const campaignMaps = imageMaps(campaign.maps);
  const legacyMaps = imageMaps(source.maps);
  const mapIndex = new Map<string, string>(); // legacy index → campaign index
  campaignMaps.forEach((m, i) => {
    const li = legacyMaps.findIndex((lm) => String(lm.id) === m.legacyId);
    if (li !== -1) mapIndex.set(String(li), String(i));
  });
  const newMaps = legacyMaps.map((m, i) => ({ m, i })).filter(({ i }) => !mapIndex.has(String(i)));
  const mapIds = opts.mapDocIds(newMaps.length);
  const maps = newMaps.map(({ m, i }, n) => {
    mapIndex.set(String(i), String(campaignMaps.length + n));
    // No storagePath: the Storage file stays owned by the original, so deleting this copy never deletes it
    return withCreator({
      ...strip(m),
      id: mapIds[n],
      image: mapImageOf(m),
      name: (m.name as string) || `Old map ${i + 1}`,
      legacyId: String(m.id),
      sharedImage: true,
      createdAt: m.createdAt || now,
      updatedAt: now,
    });
  });

  // ── Episodes: point every map, mob, crawler, quest and loot box reference at the copies ──
  const remap = (ids: unknown, idMap: Map<string, string>) =>
    Array.isArray(ids) ? ids.map(String).filter((id) => idMap.has(id)).map((id) => idMap.get(id)!) : undefined;
  const episodes = copyDocs(source.episodes, campaign.episodes).copies.map((e) => {
    const oldMapIds = ((e.mapIds as string[]) || []).map(String);
    const firstMap = oldMapIds[0];
    const mobPlacements = ((e.mobPlacements as Doc[]) || [])
      .filter((p) => mapIndex.has(String(p.mapId ?? firstMap)) && mobs.idMap.has(String(p.mobId)))
      .map((p) => ({ ...p, mapId: mapIndex.get(String(p.mapId ?? firstMap))!, mobId: mobs.idMap.get(String(p.mobId))! }));
    const crawlerPlacements = ((e.crawlerPlacements as Doc[]) || [])
      .filter((p) => mapIndex.has(String(p.mapId ?? firstMap)) && crawlers.idMap.has(String(p.crawlerId)))
      .map((p) => ({ ...p, mapId: mapIndex.get(String(p.mapId ?? firstMap))!, crawlerId: crawlers.idMap.get(String(p.crawlerId))! }));
    const mapSettings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((e.mapSettings as Doc) || {})) {
      if (mapIndex.has(k)) mapSettings[mapIndex.get(k)!] = v;
    }
    const lootBoxIds = remap(e.lootBoxIds, templates.idMap);
    const questIds = remap(e.questIds, quests.idMap);
    return withCreator({
      ...e,
      mapIds: oldMapIds.filter((id) => mapIndex.has(id)).map((id) => mapIndex.get(id)!),
      mobPlacements,
      crawlerPlacements,
      mapSettings,
      ...(lootBoxIds ? { lootBoxIds } : {}),
      ...(questIds ? { questIds } : {}),
      createdAt: e.createdAt || now,
      updatedAt: now,
    });
  });

  // ── Crawler inventories: the old app gave inventory docs random IDs; now the doc ID is the crawler ID ──
  const crawlerInventories = crawlers.copies
    .map((c) => {
      const inv = source.inventory.find((i) => String(i.crawlerId) === String(c.legacyId));
      return { crawlerId: String(c.id), items: ((inv?.items as Doc[]) || []) };
    })
    .filter((inv) => !campaign.inventory.some((d) => String(d.id) === inv.crawlerId || String(d.crawlerId) === inv.crawlerId));

  // ── Item library: add old library items the campaign doesn't have yet ──
  const libraryIds = new Set(campaign.libraryItems.map((i) => String(i.id)));
  const legacyLibrary = source.inventory.find((i) => i.crawlerId === '__shared__');
  const libraryItems = ((legacyLibrary?.items as Doc[]) || [])
    .filter((i) => !libraryIds.has(String(i.id)))
    .map((i) => ({ ...withCreator(i), isPublic: false }));

  return {
    libraryItems,
    crawlers: crawlers.copies,
    crawlerInventories,
    mobs: mobs.copies.map(withCreator),
    maps,
    episodes,
    quests: quests.copies.map(withCreator),
    lootBoxTemplates: templates.copies.map(withCreator),
  };
};

export const legacyPlanCounts = (p: LegacyImportPlan) => ({
  items: p.libraryItems.length,
  crawlers: p.crawlers.length,
  mobs: p.mobs.length,
  maps: p.maps.length,
  episodes: p.episodes.length,
  quests: p.quests.length,
  lootBoxes: p.lootBoxTemplates.length,
});
