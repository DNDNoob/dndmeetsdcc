import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import MapMobPlacementEditor from "@/components/ui/MapMobPlacementEditor";
import MapDesignerPopout from "@/components/ui/MapDesignerPopout";
import { Mob, Episode, EpisodeMobPlacement, Crawler, CrawlerPlacement, InventoryItem, LootBoxTemplate, LootBoxTier, getLootBoxTierColor } from "@/lib/gameData";
import { Brain, Upload, Plus, Trash2, Map, Skull, Image as ImageIcon, Save, Edit2, X, Layers, ChevronLeft, ChevronRight, User, Package, Search, Maximize2 } from "lucide-react";

interface DungeonAIViewProps {
  mobs: Mob[];
  onUpdateMobs: (mobs: Mob[]) => void;
  maps: string[];
  onUpdateMaps: (maps: string[]) => Promise<void> | void;
  mapNames?: string[];
  onUpdateMapName?: (index: number, name: string) => void;
  crawlers: Crawler[];
  episodes: Episode[];
  onAddEpisode: (episode: Episode) => void;
  onUpdateEpisode: (id: string, updates: Partial<Episode>) => void;
  onDeleteEpisode: (id: string) => void;
  onCleanupEmptyMaps?: () => Promise<void>;
  getSharedInventory?: () => InventoryItem[];
  lootBoxTemplates?: LootBoxTemplate[];
  onAddLootBoxTemplate?: (template: LootBoxTemplate) => void;
  onUpdateLootBoxTemplate?: (id: string, updates: Partial<LootBoxTemplate>) => void;
  onDeleteLootBoxTemplate?: (id: string) => void;
  onSetGameClock?: (gameTime: number) => Promise<void>;
}

const DungeonAIView: React.FC<DungeonAIViewProps> = ({
  mobs,
  onUpdateMobs,
  maps,
  onUpdateMaps,
  mapNames,
  onUpdateMapName,
  crawlers,
  episodes,
  onAddEpisode,
  onUpdateEpisode,
  onDeleteEpisode,
  onCleanupEmptyMaps,
  getSharedInventory,
  lootBoxTemplates = [],
  onAddLootBoxTemplate,
  onUpdateLootBoxTemplate,
  onDeleteLootBoxTemplate,
  onSetGameClock,
}) => {
  const [activeTab, setActiveTab] = useState<"mobs" | "maps" | "episodes" | "lootboxes">("mobs");
  const [newMob, setNewMob] = useState<Partial<Mob>>({
    name: "",
    level: 1,
    type: "normal",
    description: "",
    weaknesses: "",
    strengths: "",
    hitPoints: 50,
  });
  const mobImageRef = useRef<HTMLInputElement>(null);
  const mapImageRef = useRef<HTMLInputElement>(null);
  const [editingMobId, setEditingMobId] = useState<string | null>(null);
  const [editedMobData, setEditedMobData] = useState<Mob | null>(null);
  const [editingMapIndex, setEditingMapIndex] = useState<number | null>(null);
  const [editingMapName, setEditingMapName] = useState<string>('');

  // Episode state
  const [newEpisodeName, setNewEpisodeName] = useState("");
  const [newEpisodeDescription, setNewEpisodeDescription] = useState("");
  const [selectedMapsForEpisode, setSelectedMapsForEpisode] = useState<string[]>([]);
  const [selectedMobsForEpisode, setSelectedMobsForEpisode] = useState<EpisodeMobPlacement[]>([]);
  const [selectedCrawlersForEpisode, setSelectedCrawlersForEpisode] = useState<CrawlerPlacement[]>([]);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [currentMapIndexForEditor, setCurrentMapIndexForEditor] = useState(0);
  // Per-map settings: { [mapId]: { fogOfWar: boolean, scale: number } }
  const [mapSettingsForEpisode, setMapSettingsForEpisode] = useState<{ [mapId: string]: { fogOfWar: boolean; scale: number } }>({});
  const [newEpisodeStartingTime, setNewEpisodeStartingTime] = useState("");
  // Map designer popout
  const [isMapDesignerOpen, setIsMapDesignerOpen] = useState(false);

  // Loot box state for episode (selected template IDs)
  const [selectedLootBoxIdsForEpisode, setSelectedLootBoxIdsForEpisode] = useState<string[]>([]);

  // Loot box template editing state (for loot boxes tab)
  const [newLootBoxName, setNewLootBoxName] = useState("");
  const [newLootBoxTier, setNewLootBoxTier] = useState<LootBoxTier>("Copper");
  const [newLootBoxItems, setNewLootBoxItems] = useState<InventoryItem[]>([]);
  const [lootBoxItemSearch, setLootBoxItemSearch] = useState("");
  const [lootBoxItemQuantity, setLootBoxItemQuantity] = useState(1);
  const [newLootBoxGold, setNewLootBoxGold] = useState(0);
  const [editingLootBoxId, setEditingLootBoxId] = useState<string | null>(null);

  const handleAddMob = async () => {
    if (!newMob.name?.trim()) return;
    const mob: Mob = {
      id: Date.now().toString(),
      name: newMob.name,
      level: newMob.level || 1,
      type: newMob.type || "normal",
      description: newMob.description || "",
      encountered: false,
      hidden: true,
      image: newMob.image,
      weaknesses: newMob.weaknesses,
      strengths: newMob.strengths,
      hitPoints: newMob.hitPoints || 50,
      hideHitPoints: false,
      hideWeaknesses: false,
      hideStrengths: false,
    };
    console.log('[DungeonAI] ➕ Add Mob clicked', mob);
    try {
      await onUpdateMobs([...mobs, mob]);
      console.log('[DungeonAI] ✅ Mob persisted request sent');
    } catch (err) {
      console.error('[DungeonAI] ❌ Failed to persist mob', err);
    }
    setNewMob({ name: "", level: 1, type: "normal", description: "", weaknesses: "", strengths: "", hitPoints: 50 });
  };

  const handleDeleteMob = async (id: string) => {
    console.log('[DungeonAI] 🗑️ Delete Mob clicked', id);
    try {
      await onUpdateMobs(mobs.filter((m) => m.id !== id));
      console.log('[DungeonAI] ✅ Delete request sent');
    } catch (err) {
      console.error('[DungeonAI] ❌ Failed to delete mob', err);
    }
    if (editingMobId === id) {
      setEditingMobId(null);
    }
  };

  const handleUpdateMob = async (id: string, updates: Partial<Mob>) => {
    console.log('[DungeonAI] 📝 Update Mob clicked', { id, updates });
    try {
      await onUpdateMobs(mobs.map((m) => (m.id === id ? { ...m, ...updates } : m)));
      console.log('[DungeonAI] ✅ Update request sent');
    } catch (err) {
      console.error('[DungeonAI] ❌ Failed to update mob', err);
    }
  };

  // Resize and compress images before saving to Firestore (keep under size limits)
  const resizeImage = async (file: File, maxDim = 512, quality = 0.7): Promise<string | null> => {
    const readAsDataUrl = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    const dataUrl = await readAsDataUrl(file);
    // If already reasonably small, keep as is (under 800KB to be safe for Firestore's 1MB limit)
    if (dataUrl.length < 800_000) {
      console.log('[DungeonAI] ✅ Image size acceptable, no compression needed:', (dataUrl.length / 1_000_000).toFixed(2) + 'MB');
      return dataUrl;
    }

    console.log('[DungeonAI] 📦 Original image size:', (dataUrl.length / 1_000_000).toFixed(2) + 'MB, compressing...');

    const img = new window.Image();
    const loaded: Promise<void> = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    img.src = dataUrl;
    await loaded;

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    let compressed = canvas.toDataURL('image/jpeg', quality);
    let currentQuality = quality;
    
    // Iteratively reduce quality until under 800KB
    while (compressed.length > 800_000 && currentQuality > 0.1) {
      currentQuality -= 0.1;
      compressed = canvas.toDataURL('image/jpeg', currentQuality);
      console.log('[DungeonAI] 📉 Reduced quality to', currentQuality.toFixed(1), ', size:', (compressed.length / 1_000_000).toFixed(2) + 'MB');
    }
    
    if (compressed.length >= 800_000) {
      console.warn('[DungeonAI] ⚠️ Image still too large even at minimum quality; skipping image', {
        finalSize: (compressed.length / 1_000_000).toFixed(2) + 'MB',
        finalQuality: currentQuality.toFixed(1)
      });
      return null;
    }
    
    console.log('[DungeonAI] ✅ Compressed image to:', (compressed.length / 1_000_000).toFixed(2) + 'MB');
    return compressed;
  };

  const handleToggleEncountered = (id: string, currentEncountered: boolean) => {
    // When marking as encountered, automatically reveal (hidden=false)
    // When marking as unencountered, automatically hide (hidden=true)
    handleUpdateMob(id, { 
      encountered: !currentEncountered,
      hidden: currentEncountered // if was encountered, now hide it; if was unencountered, now reveal it
    });
  };

  const handleStartEdit = (mob: Mob) => {
    setEditingMobId(mob.id);
    setEditedMobData(mob);
  };

  const handleCancelEdit = () => {
    setEditingMobId(null);
    setEditedMobData(null);
  };

  const handleSaveEdit = (mobId: string, editedMob: Partial<Mob>) => {
    handleUpdateMob(mobId, editedMob);
    setEditingMobId(null);
    setEditedMobData(null);
  };

  const handleMobImageUpload = (e: React.ChangeEvent<HTMLInputElement>, mobId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      resizeImage(file).then((base64) => {
        if (!base64) return;
        if (mobId) {
          handleUpdateMob(mobId, { image: base64 });
        } else {
          setNewMob({ ...newMob, image: base64 });
        }
      }).catch((err) => console.error('[DungeonAI] Image resize failed', err)).finally(() => {
        // Reset the file input so the same file can be selected again
        if (e.target) {
          e.target.value = '';
        }
      });
    }
  };

  const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('[DungeonAI] 📤 Uploading map...');
      try {
        const base64 = await resizeImage(file);
        if (!base64) {
          console.error('[DungeonAI] ❌ Map image too large even after compression');
          return;
        }
        console.log('[DungeonAI] ✅ Map loaded, size:', base64.length);
        const updatedMaps = [...maps, base64];
        console.log('[DungeonAI] 📊 Calling onUpdateMaps with', updatedMaps.length, 'maps');
        const result = onUpdateMaps(updatedMaps);
        if (result instanceof Promise) {
          await result;
        }
        console.log('[DungeonAI] ✅ Map upload completed successfully');
      } catch (err) {
        console.error('[DungeonAI] ❌ Failed to process map file', err);
      } finally {
        // Reset the file input so the same file can be selected again
        if (mapImageRef.current) {
          mapImageRef.current.value = '';
        }
      }
    }
  };

  const handleDeleteMap = (index: number) => {
    const result = onUpdateMaps(maps.filter((_, i) => i !== index));
    // If onUpdateMaps returns a Promise, we could await it here if needed
    // For now, just call it and let it handle async internally
    if (result instanceof Promise) {
      result.catch(err => console.error('[DungeonAI] ❌ Failed to delete map:', err));
    }
  };

  const startEditingMapName = (index: number) => {
    setEditingMapIndex(index);
    setEditingMapName((mapNames && mapNames[index]) || `Map ${index + 1}`);
  };

  const saveEditingMapName = (index: number) => {
    if (onUpdateMapName && editingMapName.trim()) {
      onUpdateMapName(index, editingMapName.trim());
    }
    setEditingMapIndex(null);
    setEditingMapName('');
  };

  // Episode handlers
  const handleCreateEpisode = () => {
    if (!newEpisodeName.trim()) return;
    if (selectedMapsForEpisode.length === 0) {
      alert("Select at least one map for the episode");
      return;
    }

    // Create map settings with fog of war and scale from per-map settings
    const mapSettings: { [mapId: string]: { fogOfWar: { enabled: boolean; revealedAreas: { x: number; y: number; radius: number }[] }; scale: number } } = {};
    selectedMapsForEpisode.forEach(mapId => {
      const settings = mapSettingsForEpisode[mapId] || { fogOfWar: false, scale: 100 };
      mapSettings[mapId] = {
        fogOfWar: { enabled: settings.fogOfWar, revealedAreas: [] },
        scale: settings.scale
      };
    });

    console.log('[DungeonAI] Saving episode mapSettings:', JSON.stringify(mapSettings));

    const parsedStartingTime = newEpisodeStartingTime ? new Date(newEpisodeStartingTime).getTime() : undefined;

    if (editingEpisodeId) {
      // Update existing episode
      onUpdateEpisode(editingEpisodeId, {
        name: newEpisodeName,
        description: newEpisodeDescription,
        mapIds: selectedMapsForEpisode,
        mobPlacements: selectedMobsForEpisode,
        crawlerPlacements: selectedCrawlersForEpisode,
        mapSettings: mapSettings,
        lootBoxIds: selectedLootBoxIdsForEpisode.length > 0 ? selectedLootBoxIdsForEpisode : undefined,
        startingGameTime: parsedStartingTime,
      });
      setEditingEpisodeId(null);
    } else {
      // Create new episode
      const episode: Episode = {
        id: crypto.randomUUID(),
        name: newEpisodeName,
        description: newEpisodeDescription,
        mapIds: selectedMapsForEpisode,
        mobPlacements: selectedMobsForEpisode,
        crawlerPlacements: selectedCrawlersForEpisode,
        mapSettings: mapSettings,
        lootBoxIds: selectedLootBoxIdsForEpisode.length > 0 ? selectedLootBoxIdsForEpisode : undefined,
        startingGameTime: parsedStartingTime,
      };
      onAddEpisode(episode);

      // Initialize game clock when creating episode with a starting time
      if (parsedStartingTime && onSetGameClock) {
        onSetGameClock(parsedStartingTime);
      }
    }

    // Reset form
    setNewEpisodeName("");
    setNewEpisodeDescription("");
    setSelectedMapsForEpisode([]);
    setSelectedMobsForEpisode([]);
    setSelectedCrawlersForEpisode([]);
    setCurrentMapIndexForEditor(0);
    setMapSettingsForEpisode({});
    setSelectedLootBoxIdsForEpisode([]);
    setNewEpisodeStartingTime("");
  };

  const handleToggleMapForEpisode = (mapIndex: number) => {
    const mapIdStr = mapIndex.toString();
    setSelectedMapsForEpisode(prev => {
      const isRemoving = prev.includes(mapIdStr);
      const newMaps = isRemoving ? prev.filter(i => i !== mapIdStr) : [...prev, mapIdStr];

      // Initialize default settings for newly added map
      if (!isRemoving) {
        setMapSettingsForEpisode(settings => ({
          ...settings,
          [mapIdStr]: settings[mapIdStr] || { fogOfWar: false, scale: 100 }
        }));
      } else {
        // Remove settings, mob placements, and crawler placements for removed map
        setMapSettingsForEpisode(settings => {
          const { [mapIdStr]: _, ...rest } = settings;
          return rest;
        });
        setSelectedMobsForEpisode(mobs => mobs.filter(m => m.mapId !== mapIdStr));
        setSelectedCrawlersForEpisode(crawlers => crawlers.filter(c => c.mapId !== mapIdStr));
      }

      // Reset to first map if current index is out of bounds
      if (currentMapIndexForEditor >= newMaps.length) {
        setCurrentMapIndexForEditor(Math.max(0, newMaps.length - 1));
      }
      return newMaps;
    });
  };

  const handleAddMobToEpisode = (mobId: string) => {
    // Get current map ID
    const currentMapId = selectedMapsForEpisode[currentMapIndexForEditor];
    if (!currentMapId) return;

    // Allow duplicate mobs - each placement is independent
    setSelectedMobsForEpisode([...selectedMobsForEpisode, { mobId, mapId: currentMapId, x: 50, y: 50 }]);
  };

  const handleRemoveMobFromEpisode = (_mobId: string) => {
    // This is called from the MapMobPlacementEditor which handles the removal internally
    // We don't need to do anything here since onPlacementsChange handles it
  };

  const handleStartEditEpisode = (episode: Episode) => {
    // Load episode data into create form
    setEditingEpisodeId(episode.id);
    setNewEpisodeName(episode.name);
    setNewEpisodeDescription(episode.description || "");
    setSelectedMapsForEpisode(episode.mapIds);

    // Load mob placements - add mapId if missing (backwards compatibility)
    setSelectedMobsForEpisode(episode.mobPlacements.map(p => ({
      mobId: p.mobId,
      mapId: p.mapId || episode.mapIds[0] || '0', // Default to first map if no mapId
      x: p.x,
      y: p.y,
      scale: p.scale
    })));

    // Load crawler placements
    setSelectedCrawlersForEpisode(episode.crawlerPlacements?.map(p => ({
      crawlerId: p.crawlerId,
      mapId: p.mapId || episode.mapIds[0] || '0',
      x: p.x,
      y: p.y,
    })) || []);

    // Load per-map settings
    const loadedMapSettings: { [mapId: string]: { fogOfWar: boolean; scale: number } } = {};
    episode.mapIds.forEach(mapId => {
      const settings = episode.mapSettings?.[mapId];
      loadedMapSettings[mapId] = {
        fogOfWar: settings?.fogOfWar?.enabled ?? false,
        scale: settings?.scale ?? 100
      };
    });
    setMapSettingsForEpisode(loadedMapSettings);
    // Support both old embedded lootBoxes and new lootBoxIds
    if (episode.lootBoxIds) {
      setSelectedLootBoxIdsForEpisode(episode.lootBoxIds);
    } else if (episode.lootBoxes) {
      // Backwards compatibility: map old embedded templates to IDs if they exist in templates
      setSelectedLootBoxIdsForEpisode(episode.lootBoxes.map(b => b.id));
    } else {
      setSelectedLootBoxIdsForEpisode([]);
    }

    // Load starting game time
    if (episode.startingGameTime) {
      const d = new Date(episode.startingGameTime);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setNewEpisodeStartingTime(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    } else {
      setNewEpisodeStartingTime("");
    }

    setCurrentMapIndexForEditor(0);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEpisode = (id: string) => {
    if (confirm("Are you sure you want to delete this episode?")) {
      onDeleteEpisode(id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-4 md:p-6"
    >
      <DungeonCard glowColor="gold">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-8 h-8 text-accent" />
          <h2 className="font-display text-2xl text-accent text-glow-gold">
            DUNGEON AI - DM CONSOLE
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <DungeonButton
            variant={activeTab === "mobs" ? "admin" : "default"}
            onClick={() => setActiveTab("mobs")}
            className="flex-1"
          >
            <Skull className="w-4 h-4 mr-2" /> Mobs
          </DungeonButton>
          <DungeonButton
            variant={activeTab === "maps" ? "admin" : "default"}
            onClick={() => setActiveTab("maps")}
            className="flex-1"
          >
            <Map className="w-4 h-4 mr-2" /> Maps
          </DungeonButton>
          <DungeonButton
            variant={activeTab === "episodes" ? "admin" : "default"}
            onClick={() => setActiveTab("episodes")}
            className="flex-1"
          >
            <Layers className="w-4 h-4 mr-2" /> Episodes
          </DungeonButton>
          <DungeonButton
            variant={activeTab === "lootboxes" ? "admin" : "default"}
            onClick={() => setActiveTab("lootboxes")}
            className="flex-1"
          >
            <Package className="w-4 h-4 mr-2" /> Loot Boxes
          </DungeonButton>
        </div>

        {activeTab === "mobs" && (
          <div className="space-y-6">
            {/* Add new mob form */}
            <div className="bg-muted/30 border border-border p-4">
              <h3 className="font-display text-primary text-lg mb-4">Add New Mob</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <input
                      type="text"
                      placeholder="Mob name"
                      value={newMob.name || ""}
                      onChange={(e) => setNewMob({ ...newMob, name: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Level</label>
                      <input
                        type="number"
                        placeholder="Level"
                        value={newMob.level || ""}
                        onChange={(e) => setNewMob({ ...newMob, level: parseInt(e.target.value) || 1 })}
                        className="w-full bg-muted border border-border px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Hit Points</label>
                      <input
                        type="number"
                        placeholder="HP"
                        value={newMob.hitPoints || ""}
                        onChange={(e) => setNewMob({ ...newMob, hitPoints: parseInt(e.target.value) || 50 })}
                        className="w-full bg-muted border border-border px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                      <select
                        value={newMob.type || "normal"}
                        onChange={(e) => setNewMob({ ...newMob, type: e.target.value as "normal" | "boss" | "npc" })}
                        className="w-full bg-muted border border-border px-3 py-2"
                      >
                        <option value="normal">Normal</option>
                        <option value="boss">Boss</option>
                        <option value="npc">NPC</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                    <textarea
                      placeholder="Description"
                      value={newMob.description || ""}
                      onChange={(e) => setNewMob({ ...newMob, description: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2 min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Weaknesses</label>
                    <input
                      type="text"
                      placeholder="e.g., fire, water"
                      value={newMob.weaknesses || ""}
                      onChange={(e) => setNewMob({ ...newMob, weaknesses: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Strengths</label>
                    <input
                      type="text"
                      placeholder="e.g., armor, speed"
                      value={newMob.strengths || ""}
                      onChange={(e) => setNewMob({ ...newMob, strengths: e.target.value })}
                      className="w-full bg-muted border border-border px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center border border-dashed border-border p-4">
                  <label className="text-xs text-muted-foreground mb-2">Mob Image</label>
                  {newMob.image ? (
                    <img src={newMob.image} alt="Mob preview" className="max-h-32 mb-2" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                  )}
                  <input
                    ref={mobImageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMobImageUpload(e)}
                    className="hidden"
                  />
                  <DungeonButton
                    variant="default"
                    size="sm"
                    onClick={() => mobImageRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-1" /> Upload Image
                  </DungeonButton>
                </div>
              </div>
              <div className="mt-4">
                <DungeonButton variant="admin" onClick={handleAddMob}>
                  <Plus className="w-4 h-4 mr-2" /> Add Mob
                </DungeonButton>
              </div>
            </div>

            {/* Existing mobs list */}
            <div className="space-y-3">
              <h3 className="font-display text-primary text-lg">Existing Mobs</h3>
              {mobs.map((mob) => {
                const isEditing = editingMobId === mob.id;
                const editedMob = (isEditing && editedMobData) ? editedMobData : mob;

                return (
                  <div
                    key={mob.id}
                    className={`border p-3 ${
                      mob.type === "boss" ? "border-destructive bg-destructive/5" : "border-border bg-muted/20"
                    }`}
                  >
                    {isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                            <input
                              type="text"
                              value={editedMob.name}
                              onChange={(e) => setEditedMobData(prev => prev ? { ...prev, name: e.target.value } : prev)}
                              className="w-full bg-muted border border-border px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Level</label>
                              <input
                                type="number"
                                value={editedMob.level}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, level: parseInt(e.target.value) || 1 } : prev)}
                                className="w-full bg-muted border border-border px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">HP</label>
                              <input
                                type="number"
                                value={editedMob.hitPoints || 50}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hitPoints: parseInt(e.target.value) || 50 } : prev)}
                                className="w-full bg-muted border border-border px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                              <select
                                value={editedMob.type}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, type: e.target.value as "normal" | "boss" | "npc" } : prev)}
                                className="w-full bg-muted border border-border px-2 py-1 text-sm"
                              >
                                <option value="normal">Normal</option>
                                <option value="boss">Boss</option>
                                <option value="npc">NPC</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                          <textarea
                            value={editedMob.description}
                            onChange={(e) => setEditedMobData(prev => prev ? { ...prev, description: e.target.value } : prev)}
                            className="w-full bg-muted border border-border px-2 py-1 text-sm min-h-[50px]"
                          />
                        </div>
                        
                        {/* Image Upload */}
                        <div className="flex items-center gap-3 bg-muted/40 border border-border p-2 rounded">
                          {editedMob.image && (
                            <img src={editedMob.image} alt="Mob preview" className="w-16 h-16 object-cover" />
                          )}
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Mob Image</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  resizeImage(file).then((base64) => {
                                    if (!base64) return;
                                    setEditedMobData(prev => prev ? { ...prev, image: base64 } : prev);
                                  }).catch((err) => console.error('[DungeonAI] Image resize failed', err));
                                }
                              }}
                              className="text-xs w-full"
                            />
                          </div>
                          {editedMob.image && (
                            <DungeonButton
                              variant="default"
                              size="sm"
                              onClick={() => setEditedMobData(prev => prev ? { ...prev, image: undefined } : prev)}
                            >
                              <X className="w-3 h-3" />
                            </DungeonButton>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Weaknesses</label>
                            <input
                              type="text"
                              value={editedMob.weaknesses || ""}
                              onChange={(e) => setEditedMobData(prev => prev ? { ...prev, weaknesses: e.target.value } : prev)}
                              className="w-full bg-muted border border-border px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Strengths</label>
                            <input
                              type="text"
                              value={editedMob.strengths || ""}
                              onChange={(e) => setEditedMobData(prev => prev ? { ...prev, strengths: e.target.value } : prev)}
                              className="w-full bg-muted border border-border px-2 py-1 text-sm"
                            />
                          </div>
                        </div>

                        {/* Hide Detail Toggles */}
                        <div className="bg-muted/40 border border-border p-2 mt-3 rounded">
                          <p className="text-xs text-muted-foreground font-semibold mb-2">Hide Details From Players:</p>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editedMob.hideHitPoints || false}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hideHitPoints: e.target.checked } : prev)}
                                className="w-4 h-4"
                              />
                              <span>Hide HP</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editedMob.hideWeaknesses || false}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hideWeaknesses: e.target.checked } : prev)}
                                className="w-4 h-4"
                              />
                              <span>Hide Weaknesses</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={editedMob.hideStrengths || false}
                                onChange={(e) => setEditedMobData(prev => prev ? { ...prev, hideStrengths: e.target.checked } : prev)}
                                className="w-4 h-4"
                              />
                              <span>Hide Strengths</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <DungeonButton
                            variant="admin"
                            size="sm"
                            onClick={() => handleSaveEdit(mob.id, editedMob)}
                          >
                            <Save className="w-4 h-4 mr-1" /> Save
                          </DungeonButton>
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </DungeonButton>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex flex-wrap items-start gap-4">
                        {mob.image ? (
                          <img src={mob.image} alt={mob.name} className="w-16 h-16 object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 bg-muted flex items-center justify-center flex-shrink-0">
                            <Skull className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-display text-foreground">{mob.name}</span>
                            <span className="text-xs text-muted-foreground">Lvl {mob.level}</span>
                            {mob.hitPoints !== undefined && (
                              <span className="text-xs text-muted-foreground">HP: {mob.hitPoints}</span>
                            )}
                            {mob.type === "boss" && (
                              <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5">BOSS</span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 ${
                                mob.encountered ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {mob.encountered ? "ENCOUNTERED" : "UNENCOUNTERED"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">{mob.description}</p>
                          {mob.weaknesses && (
                            <p className="text-xs text-muted-foreground">
                              <span className="text-destructive">Weaknesses:</span> {mob.weaknesses}
                            </p>
                          )}
                          {mob.strengths && (
                            <p className="text-xs text-muted-foreground">
                              <span className="text-primary">Strengths:</span> {mob.strengths}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={() => handleToggleEncountered(mob.id, mob.encountered)}
                          >
                            {mob.encountered ? "Mark Unencountered" : "Mark Encountered"}
                          </DungeonButton>
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={() => handleStartEdit(mob)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </DungeonButton>
                          <DungeonButton variant="danger" size="sm" onClick={() => handleDeleteMob(mob.id)}>
                            <Trash2 className="w-4 h-4" />
                          </DungeonButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "maps" && (
          <div className="space-y-6">
            {/* Upload map */}
            <div className="bg-muted/30 border border-border p-4 space-y-4">
              <div>
                <h3 className="font-display text-primary text-lg mb-4">Upload Map</h3>
                <input
                  ref={mapImageRef}
                  type="file"
                  accept="image/*"
                  onChange={handleMapUpload}
                  className="hidden"
                />
                <DungeonButton variant="admin" onClick={() => mapImageRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Map Image
                </DungeonButton>
              </div>
              {onCleanupEmptyMaps && (
                <DungeonButton 
                  variant="default" 
                  onClick={() => {
                    if (confirm('Delete all empty/corrupted maps from Firestore? This cannot be undone.')) {
                      onCleanupEmptyMaps().catch(err => console.error('[DungeonAI] ❌ Cleanup failed:', err));
                    }
                  }}
                >
                  🧹 Cleanup Empty Maps
                </DungeonButton>
              )}
            </div>

            {/* Maps grid */}
            <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
              {maps.map((map, index) => (
                <div key={index} className="border border-border p-2 relative group w-full bg-muted/20">
                  {/* Map image */}
                  <img src={map} alt={`Map ${index + 1}`} className="w-full h-auto object-contain max-h-[40vh]" />
                  
                  {/* Map name display/edit */}
                  <div className="mt-2 p-2 bg-background border-t border-border">
                    {editingMapIndex === index ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingMapName}
                          onChange={(e) => setEditingMapName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditingMapName(index);
                            if (e.key === 'Escape') setEditingMapIndex(null);
                          }}
                          autoFocus
                          className="flex-1 bg-muted border border-border px-2 py-1 text-sm"
                          placeholder="Map name..."
                        />
                        <DungeonButton
                          variant="admin"
                          size="sm"
                          onClick={() => saveEditingMapName(index)}
                        >
                          <Save className="w-3 h-3" />
                        </DungeonButton>
                        <DungeonButton
                          variant="default"
                          size="sm"
                          onClick={() => setEditingMapIndex(null)}
                        >
                          <X className="w-3 h-3" />
                        </DungeonButton>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {mapNames?.[index] || `Map ${index + 1}`}
                        </span>
                        <DungeonButton
                          variant="default"
                          size="sm"
                          onClick={() => startEditingMapName(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </DungeonButton>
                      </div>
                    )}
                  </div>
                  
                  {/* Delete button */}
                  <DungeonButton
                    variant="danger"
                    size="sm"
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteMap(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </DungeonButton>
                </div>
              ))}
              {maps.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-2 text-center py-8">
                  No maps uploaded yet. Upload your first map!
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "episodes" && (
          <div className="space-y-6">
            {/* Create new episode form */}
            <div className="bg-muted/30 border border-border p-4">
              <h3 className="font-display text-primary text-lg mb-4">
                {editingEpisodeId ? "Edit Episode" : "Create Episode"}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Episode Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., The Goblin Caves"
                    value={newEpisodeName}
                    onChange={(e) => setNewEpisodeName(e.target.value)}
                    className="w-full bg-muted border border-border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <textarea
                    placeholder="Optional description of this episode..."
                    value={newEpisodeDescription}
                    onChange={(e) => setNewEpisodeDescription(e.target.value)}
                    className="w-full bg-muted border border-border px-3 py-2 min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Starting Game Time</label>
                  <input
                    type="datetime-local"
                    value={newEpisodeStartingTime}
                    onChange={(e) => setNewEpisodeStartingTime(e.target.value)}
                    className="w-full bg-muted border border-border px-3 py-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sets the in-game clock when this episode begins
                  </p>
                </div>

                {/* Map selection */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block font-semibold">Select Maps for Episode *</label>
                  <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {maps.length === 0 ? (
                      <p className="text-sm text-muted-foreground col-span-2">No maps available. Upload maps first.</p>
                    ) : (
                      maps.map((map, index) => (
                        <label
                          key={index}
                          className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                            selectedMapsForEpisode.includes(index.toString())
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMapsForEpisode.includes(index.toString())}
                            onChange={() => handleToggleMapForEpisode(index)}
                            className="w-4 h-4"
                          />
                          <img src={map} alt={mapNames?.[index] || `Map ${index + 1}`} className="w-12 h-12 object-cover" />
                          <span className="text-sm">{mapNames?.[index] || `Map ${index + 1}`}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Per-map settings - only show if at least one map is selected */}
                {selectedMapsForEpisode.length > 0 && (
                  <div className="space-y-4">
                    {/* Map navigation header */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground font-semibold">
                        Map Settings & Mob Placement
                      </label>
                      {selectedMapsForEpisode.length > 1 && (
                        <div className="flex items-center gap-2">
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={() => setCurrentMapIndexForEditor(prev =>
                              prev > 0 ? prev - 1 : selectedMapsForEpisode.length - 1
                            )}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </DungeonButton>
                          <span className="text-xs text-muted-foreground">
                            Map {currentMapIndexForEditor + 1} of {selectedMapsForEpisode.length}
                          </span>
                          <DungeonButton
                            variant="default"
                            size="sm"
                            onClick={() => setCurrentMapIndexForEditor(prev =>
                              prev < selectedMapsForEpisode.length - 1 ? prev + 1 : 0
                            )}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </DungeonButton>
                        </div>
                      )}
                    </div>

                    {/* Current map name */}
                    <div className="text-sm font-medium text-primary">
                      {mapNames?.[parseInt(selectedMapsForEpisode[currentMapIndexForEditor], 10)] || `Map ${parseInt(selectedMapsForEpisode[currentMapIndexForEditor], 10) + 1}`}
                    </div>

                    {/* Per-map settings controls */}
                    <div className="flex flex-wrap items-center gap-4 p-3 bg-background/50 border border-border rounded">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mapSettingsForEpisode[selectedMapsForEpisode[currentMapIndexForEditor]]?.fogOfWar ?? false}
                          onChange={(e) => {
                            const mapId = selectedMapsForEpisode[currentMapIndexForEditor];
                            setMapSettingsForEpisode(prev => ({
                              ...prev,
                              [mapId]: {
                                ...prev[mapId],
                                fogOfWar: e.target.checked,
                                scale: prev[mapId]?.scale ?? 100
                              }
                            }));
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Fog of War</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">Scale:</label>
                        <select
                          value={mapSettingsForEpisode[selectedMapsForEpisode[currentMapIndexForEditor]]?.scale ?? 100}
                          onChange={(e) => {
                            const mapId = selectedMapsForEpisode[currentMapIndexForEditor];
                            setMapSettingsForEpisode(prev => ({
                              ...prev,
                              [mapId]: {
                                ...prev[mapId],
                                fogOfWar: prev[mapId]?.fogOfWar ?? false,
                                scale: Number(e.target.value)
                              }
                            }));
                          }}
                          className="bg-muted border border-border px-2 py-1 text-sm"
                        >
                          <option value={25}>25%</option>
                          <option value={50}>50%</option>
                          <option value={75}>75%</option>
                          <option value={100}>100%</option>
                          <option value={150}>150%</option>
                          <option value={200}>200%</option>
                          <option value={300}>300%</option>
                          <option value={500}>500%</option>
                          <option value={1000}>1000%</option>
                          <option value={2000}>2000%</option>
                          <option value={3000}>3000%</option>
                          <option value={5000}>5000%</option>
                        </select>
                        <DungeonButton
                          variant="admin"
                          size="sm"
                          onClick={() => setIsMapDesignerOpen(true)}
                          title="Open full-screen map designer"
                        >
                          <Maximize2 className="w-4 h-4 mr-1" />
                          Designer
                        </DungeonButton>
                      </div>
                    </div>

                    {/* Mob and Crawler placement editor */}
                    <MapMobPlacementEditor
                      mapUrl={maps[parseInt(selectedMapsForEpisode[currentMapIndexForEditor], 10)]}
                      mapId={selectedMapsForEpisode[currentMapIndexForEditor]}
                      mobs={mobs}
                      placements={selectedMobsForEpisode}
                      onPlacementsChange={setSelectedMobsForEpisode}
                      onAddMob={handleAddMobToEpisode}
                      onRemoveMob={handleRemoveMobFromEpisode}
                      crawlers={crawlers}
                      crawlerPlacements={selectedCrawlersForEpisode}
                      mapScale={mapSettingsForEpisode[selectedMapsForEpisode[currentMapIndexForEditor]]?.scale ?? 100}
                      onCrawlerPlacementsChange={setSelectedCrawlersForEpisode}
                    />

                    {/* Crawler placement section */}
                    {crawlers.length > 0 && (
                      <div className="bg-muted/30 border border-border rounded p-4 mt-4">
                        <h5 className="font-display text-sm text-blue-400 mb-3 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Crawler Starting Positions (This Map)
                        </h5>

                        {/* Current map crawler placements */}
                        {selectedCrawlersForEpisode.filter(p => p.mapId === selectedMapsForEpisode[currentMapIndexForEditor]).length > 0 && (
                          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                            {selectedCrawlersForEpisode
                              .map((placement, globalIndex) => ({ placement, globalIndex }))
                              .filter(({ placement }) => placement.mapId === selectedMapsForEpisode[currentMapIndexForEditor])
                              .map(({ placement, globalIndex }) => {
                                const crawler = crawlers.find(c => c.id === placement.crawlerId);
                                if (!crawler) return null;
                                return (
                                  <div
                                    key={`crawler-${placement.crawlerId}-${globalIndex}`}
                                    className="flex items-center justify-between bg-background border border-blue-400/30 rounded p-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {crawler.avatar ? (
                                        <img src={crawler.avatar} alt={crawler.name} className="w-8 h-8 rounded-full object-cover" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                          <User className="w-4 h-4 text-blue-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{crawler.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          ({placement.x.toFixed(0)}%, {placement.y.toFixed(0)}%)
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSelectedCrawlersForEpisode(prev => prev.filter((_, i) => i !== globalIndex));
                                      }}
                                      className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
                                      title="Remove crawler"
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        )}

                        {/* Add crawler buttons */}
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {crawlers.map(crawler => {
                            const currentMapId = selectedMapsForEpisode[currentMapIndexForEditor];
                            const count = selectedCrawlersForEpisode.filter(p => p.crawlerId === crawler.id && p.mapId === currentMapId).length;
                            return (
                              <DungeonButton
                                key={crawler.id}
                                variant="default"
                                size="sm"
                                className="justify-start"
                                onClick={() => {
                                  const newPlacement: CrawlerPlacement = {
                                    crawlerId: crawler.id,
                                    mapId: currentMapId,
                                    x: 50,
                                    y: 50,
                                  };
                                  setSelectedCrawlersForEpisode(prev => [...prev, newPlacement]);
                                }}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  {crawler.avatar ? (
                                    <img src={crawler.avatar} alt={crawler.name} className="w-5 h-5 rounded-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 text-blue-400" />
                                  )}
                                  <span className="text-xs truncate flex-1">{crawler.name}</span>
                                  {count > 0 && (
                                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                                      {count}
                                    </span>
                                  )}
                                </div>
                              </DungeonButton>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click a crawler to add their starting position on this map. Positions can be adjusted in ShowTime.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Loot Boxes - Template picker */}
                {lootBoxTemplates.length > 0 && (
                  <div className="bg-muted/30 border border-border rounded p-4 mt-4">
                    <h5 className="font-display text-sm text-amber-400 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Loot Boxes
                    </h5>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {lootBoxTemplates.map(template => {
                        const isSelected = selectedLootBoxIdsForEpisode.includes(template.id);
                        return (
                          <button
                            key={template.id}
                            onClick={() => setSelectedLootBoxIdsForEpisode(prev =>
                              isSelected ? prev.filter(id => id !== template.id) : [...prev, template.id]
                            )}
                            className={`text-left p-2 border rounded transition-colors ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500'
                                : 'bg-background border-border hover:border-amber-500/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 flex-shrink-0" style={{ color: getLootBoxTierColor(template.tier) }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{template.name}</p>
                                <p className="text-xs text-muted-foreground">{template.tier} · {template.items.length} items{template.gold ? ` · ${template.gold}g` : ''}</p>
                              </div>
                              {isSelected && <span className="text-amber-500">✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Create loot boxes in the Loot Boxes tab, then select them here to include in this episode.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  {editingEpisodeId && (
                    <DungeonButton
                      variant="default"
                      onClick={() => {
                        setEditingEpisodeId(null);
                        setNewEpisodeName("");
                        setNewEpisodeDescription("");
                        setSelectedMapsForEpisode([]);
                        setSelectedMobsForEpisode([]);
                        setSelectedCrawlersForEpisode([]);
                        setCurrentMapIndexForEditor(0);
                        setMapSettingsForEpisode({});
                        setSelectedLootBoxIdsForEpisode([]);
                        setNewEpisodeStartingTime("");
                      }}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" /> Cancel
                    </DungeonButton>
                  )}
                  <DungeonButton variant="admin" onClick={handleCreateEpisode} className="flex-1">
                    {editingEpisodeId ? (
                      <><Save className="w-4 h-4 mr-2" /> Update Episode</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-2" /> Create Episode</>
                    )}
                  </DungeonButton>
                </div>
              </div>
            </div>

            {/* Existing episodes list */}
            <div className="space-y-3">
              <h3 className="font-display text-primary text-lg">Existing Episodes</h3>
              {episodes.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8">No episodes created yet.</p>
              ) : (
                episodes.map(episode => (
                  <div key={episode.id} className="border border-primary bg-muted/20 p-4">
                    <div className="mb-3">
                      <h4 className="font-display text-foreground mb-1">{episode.name}</h4>
                      {episode.description && (
                        <p className="text-sm text-muted-foreground mb-2">{episode.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs">
                        <span className="text-muted-foreground">
                          📍 {episode.mapIds.length} map{episode.mapIds.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground">
                          👹 {episode.mobPlacements.length} mob{episode.mobPlacements.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground">
                          📦 {(episode.lootBoxIds?.length ?? episode.lootBoxes?.length ?? 0)} loot box{(episode.lootBoxIds?.length ?? episode.lootBoxes?.length ?? 0) !== 1 ? "es" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <DungeonButton
                        variant="default"
                        size="sm"
                        onClick={() => handleStartEditEpisode(episode)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> Edit
                      </DungeonButton>
                      <DungeonButton
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteEpisode(episode.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </DungeonButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "lootboxes" && (
          <div className="space-y-6">
            {/* Create/Edit Loot Box form */}
            <div className="bg-muted/30 border border-border p-4">
              <h3 className="font-display text-amber-400 text-lg mb-4">
                {editingLootBoxId ? "Edit Loot Box" : "Create Loot Box"}
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <input
                      type="text"
                      placeholder="Loot box name"
                      value={newLootBoxName}
                      onChange={e => setNewLootBoxName(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tier</label>
                    <select
                      value={newLootBoxTier}
                      onChange={e => setNewLootBoxTier(e.target.value as LootBoxTier)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                      style={{ color: getLootBoxTierColor(newLootBoxTier) }}
                    >
                      {(['Dirt', 'Copper', 'Silver', 'Gold'] as LootBoxTier[]).map(tier => (
                        <option key={tier} value={tier} style={{ color: getLootBoxTierColor(tier) }}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Gold</label>
                    <input
                      type="number"
                      min="0"
                      value={newLootBoxGold}
                      onChange={e => setNewLootBoxGold(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Item search with quantity */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Add Items from Shared Inventory</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={lootBoxItemSearch}
                        onChange={e => setLootBoxItemSearch(e.target.value)}
                        className="w-full bg-background border border-border rounded pl-10 pr-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground">Qty:</label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={lootBoxItemQuantity}
                        onChange={e => setLootBoxItemQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                        className="w-14 bg-background border border-border rounded px-2 py-2 text-sm text-center"
                      />
                    </div>
                  </div>
                  {lootBoxItemSearch && getSharedInventory && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded bg-background">
                      {getSharedInventory()
                        .filter(item => item.name.toLowerCase().includes(lootBoxItemSearch.toLowerCase()))
                        .slice(0, 15)
                        .map(item => (
                          <button
                            key={item.id}
                            onClick={() => {
                              const itemsToAdd = Array.from({ length: lootBoxItemQuantity }, () => ({
                                ...item,
                                id: crypto.randomUUID()
                              }));
                              setNewLootBoxItems(prev => [...prev, ...itemsToAdd]);
                              setLootBoxItemSearch("");
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border last:border-b-0 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold">{item.name}</span>
                              {item.description && <span className="text-muted-foreground ml-2 text-xs">- {item.description}</span>}
                            </div>
                            <span className="text-xs text-primary">+{lootBoxItemQuantity}</span>
                          </button>
                        ))}
                      {getSharedInventory().filter(item => item.name.toLowerCase().includes(lootBoxItemSearch.toLowerCase())).length === 0 && (
                        <p className="text-sm text-muted-foreground p-3">No matching items found</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected items with counts */}
                {newLootBoxItems.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Items in Box ({newLootBoxItems.length} total)</label>
                    <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded p-2 bg-background/50">
                      {/* Group items by name */}
                      {Object.entries(
                        newLootBoxItems.reduce((acc, item) => {
                          acc[item.name] = (acc[item.name] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5">
                          <span className="text-sm">
                            {name} {count > 1 && <span className="text-muted-foreground">×{count}</span>}
                          </span>
                          <button
                            onClick={() => {
                              // Remove one instance of this item
                              const idx = newLootBoxItems.findIndex(i => i.name === name);
                              if (idx !== -1) {
                                setNewLootBoxItems(prev => prev.filter((_, i) => i !== idx));
                              }
                            }}
                            className="p-1 hover:bg-destructive/10 rounded"
                            title="Remove one"
                          >
                            <X className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {editingLootBoxId && (
                    <DungeonButton
                      variant="default"
                      onClick={() => {
                        setEditingLootBoxId(null);
                        setNewLootBoxName("");
                        setNewLootBoxTier("Copper");
                        setNewLootBoxItems([]);
                        setNewLootBoxGold(0);
                      }}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" /> Cancel
                    </DungeonButton>
                  )}
                  <DungeonButton
                    variant="admin"
                    disabled={!newLootBoxName.trim() || (newLootBoxItems.length === 0 && newLootBoxGold === 0) || !onAddLootBoxTemplate}
                    onClick={() => {
                      if (!newLootBoxName.trim() || (newLootBoxItems.length === 0 && newLootBoxGold === 0)) return;
                      if (editingLootBoxId && onUpdateLootBoxTemplate) {
                        onUpdateLootBoxTemplate(editingLootBoxId, {
                          name: newLootBoxName,
                          tier: newLootBoxTier,
                          items: newLootBoxItems,
                          gold: newLootBoxGold > 0 ? newLootBoxGold : undefined,
                        });
                        setEditingLootBoxId(null);
                      } else if (onAddLootBoxTemplate) {
                        onAddLootBoxTemplate({
                          id: crypto.randomUUID(),
                          name: newLootBoxName,
                          tier: newLootBoxTier,
                          items: newLootBoxItems,
                          gold: newLootBoxGold > 0 ? newLootBoxGold : undefined,
                        });
                      }
                      setNewLootBoxName("");
                      setNewLootBoxTier("Copper");
                      setNewLootBoxItems([]);
                      setNewLootBoxGold(0);
                    }}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {editingLootBoxId ? "Update Loot Box" : "Create Loot Box"}
                  </DungeonButton>
                </div>

                {!getSharedInventory && (
                  <p className="text-sm text-muted-foreground">
                    Add items to the Shared Inventory Library (Inventory tab) to populate loot boxes.
                  </p>
                )}
              </div>
            </div>

            {/* Existing Loot Box Templates */}
            <div className="space-y-3">
              <h3 className="font-display text-primary text-lg">Loot Box Library</h3>
              {lootBoxTemplates.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8">No loot boxes created yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {lootBoxTemplates.map(template => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-3 bg-muted/20"
                      style={{ borderColor: getLootBoxTierColor(template.tier) }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-5 h-5 flex-shrink-0" style={{ color: getLootBoxTierColor(template.tier) }} />
                          <div className="min-w-0">
                            <h4 className="font-semibold truncate">{template.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {template.tier} · {template.items.length} item{template.items.length !== 1 ? 's' : ''}{template.gold ? ` · ${template.gold}g` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingLootBoxId(template.id);
                              setNewLootBoxName(template.name);
                              setNewLootBoxTier(template.tier);
                              setNewLootBoxItems([...template.items]);
                              setNewLootBoxGold(template.gold ?? 0);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {onDeleteLootBoxTemplate && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete loot box "${template.name}"?`)) {
                                  onDeleteLootBoxTemplate(template.id);
                                }
                              }}
                              className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Item preview */}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(
                          template.items.reduce((acc, item) => {
                            acc[item.name] = (acc[item.name] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).slice(0, 3).map(([name, count]) => (
                          <span key={name} className="mr-2">
                            {name}{count > 1 && ` ×${count}`}
                          </span>
                        ))}
                        {Object.keys(template.items.reduce((acc, item) => { acc[item.name] = 1; return acc; }, {} as Record<string, number>)).length > 3 && (
                          <span>...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DungeonCard>

      {/* Map Designer Popout */}
      {selectedMapsForEpisode.length > 0 && (
        <MapDesignerPopout
          isOpen={isMapDesignerOpen}
          onClose={() => setIsMapDesignerOpen(false)}
          mapUrl={maps[parseInt(selectedMapsForEpisode[currentMapIndexForEditor], 10)]}
          mapId={selectedMapsForEpisode[currentMapIndexForEditor]}
          mapScale={mapSettingsForEpisode[selectedMapsForEpisode[currentMapIndexForEditor]]?.scale ?? 100}
          mobs={mobs}
          placements={selectedMobsForEpisode}
          onPlacementsChange={setSelectedMobsForEpisode}
          crawlers={crawlers}
          crawlerPlacements={selectedCrawlersForEpisode}
          onCrawlerPlacementsChange={setSelectedCrawlersForEpisode}
        />
      )}
    </motion.div>
  );
};

export default DungeonAIView;
