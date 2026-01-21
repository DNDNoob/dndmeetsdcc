import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { ResizableMobDisplay } from "@/components/ui/ResizableMobDisplay";
import { GridOverlay } from "@/components/ui/GridOverlay";
import { MobIcon } from "@/components/ui/MobIcon";
import { FogOfWar } from "@/components/ui/FogOfWar";
import { Episode, Mob, MapSettings } from "@/lib/gameData";
import { Map, X, Eye, Layers, ChevronLeft, ChevronRight, PlayCircle, Grid3x3, CloudFog, Eraser, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { useFirebaseStore } from "@/hooks/useFirebaseStore";

interface ShowTimeViewProps {
  maps: string[];
  mapNames?: string[];
  episodes: Episode[];
  mobs: Mob[];
  isAdmin: boolean;
  onUpdateEpisode?: (id: string, updates: Partial<Episode>) => void;
}

const ShowTimeView: React.FC<ShowTimeViewProps> = ({ maps, mapNames, episodes, mobs, isAdmin, onUpdateEpisode }) => {
  const { roomId } = useFirebaseStore();
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [displayedMobIds, setDisplayedMobIds] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [draggingMobId, setDraggingMobId] = useState<string | null>(null);
  const [remoteDragState, setRemoteDragState] = useState<{placementIndex: number; x: number; y: number} | null>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const hasAutoLoaded = useRef(false);
  const mountTime = useRef(Timestamp.now());
  const lastBroadcastTime = useRef<number>(0);
  const BROADCAST_THROTTLE_MS = 50; // Throttle to ~20 updates per second

  // Fog of war state
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [fogBrushSize, setFogBrushSize] = useState(5);
  const [revealedAreas, setRevealedAreas] = useState<{ x: number; y: number; radius: number }[]>([]);
  const [mapScale, setMapScale] = useState(100);
  const lastFogBroadcastTime = useRef<number>(0);
  const FOG_BROADCAST_THROTTLE_MS = 100;

  // Get current map ID for fog of war storage - MUST be defined before useEffects that use it
  const currentMapId = useMemo(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0) return null;
    return selectedEpisode.mapIds[currentMapIndex];
  }, [selectedEpisode, currentMapIndex]);

  // Auto-select first episode and first map when episodes load (only once)
  useEffect(() => {
    if (episodes.length > 0 && !selectedEpisode && !hasAutoLoaded.current) {
      const firstEpisode = episodes[0];
      setSelectedEpisode(firstEpisode);
      if (firstEpisode.mapIds.length > 0) {
        const mapIndex = parseInt(firstEpisode.mapIds[0], 10);
        setSelectedMap(maps[mapIndex] || null);
        setCurrentMapIndex(0);
        // Load default fog of war and scale settings
        const firstMapId = firstEpisode.mapIds[0];
        const mapSettings = firstEpisode.mapSettings?.[firstMapId];
        setFogOfWarEnabled(mapSettings?.fogOfWar?.enabled ?? firstEpisode.defaultFogOfWar ?? false);
        setRevealedAreas(mapSettings?.fogOfWar?.revealedAreas ?? []);
        setMapScale(mapSettings?.scale ?? 100);
      }
      hasAutoLoaded.current = true;
    }
  }, [episodes, maps]);

  // Load fog of war and scale settings when map changes
  useEffect(() => {
    if (!selectedEpisode || currentMapId === null) return;
    const mapSettings = selectedEpisode.mapSettings?.[currentMapId];
    // Only set defaults if not already set from Firebase listener
    if (mapSettings) {
      setFogOfWarEnabled(mapSettings.fogOfWar?.enabled ?? selectedEpisode.defaultFogOfWar ?? false);
      setRevealedAreas(mapSettings.fogOfWar?.revealedAreas ?? []);
      setMapScale(mapSettings.scale ?? 100);
    } else {
      // Use episode defaults
      setFogOfWarEnabled(selectedEpisode.defaultFogOfWar ?? false);
      setRevealedAreas([]);
      setMapScale(100);
    }
  }, [currentMapId]);

  // Debug logging
  console.log('[ShowTime] Rendering with:', {
    episodeCount: episodes.length,
    mapCount: maps.length,
    mobCount: mobs.length,
    isAdmin,
    selectedEpisode: selectedEpisode?.name
  });

  // Listen for real-time drag updates from other players
  useEffect(() => {
    if (!selectedEpisode) return;

    const episodeId = selectedEpisode.id;

    // Use a single document per episode for drag state
    const dragDocPath = roomId
      ? `rooms/${roomId}/mob-drag-state/${episodeId}`
      : `mob-drag-state/${episodeId}`;

    const dragDocRef = doc(db, dragDocPath);

    console.log('[ShowTime] Setting up drag listener for episode:', episodeId);

    const unsubscribe = onSnapshot(dragDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.log('[ShowTime] Drag doc does not exist');
        return;
      }

      const dragData = snapshot.data();
      console.log('[ShowTime] Received drag update:', {
        dragData,
        isAdmin,
        draggingMobId,
        shouldApply: !isAdmin || !draggingMobId
      });

      // Only apply if we're not the one dragging
      if (!isAdmin || !draggingMobId) {
        if (dragData.updatedAt) {
          const updateTime = dragData.updatedAt.toMillis ? dragData.updatedAt.toMillis() : 0;
          const mountTimeMs = mountTime.current.toMillis();

          console.log('[ShowTime] Time check:', {
            updateTime,
            mountTimeMs,
            shouldApply: updateTime > mountTimeMs
          });

          // Only apply updates that happened after component mounted
          if (updateTime > mountTimeMs) {
            console.log('[ShowTime] APPLYING drag update to placement', dragData.placementIndex, 'with position', dragData.x, dragData.y);

            setRemoteDragState({
              placementIndex: dragData.placementIndex,
              x: dragData.x,
              y: dragData.y
            });

            // Update local episode state with remote drag position
            setSelectedEpisode(prev => {
              if (!prev) return prev;
              console.log('[ShowTime] Updating placement', dragData.placementIndex, 'from', prev.mobPlacements[dragData.placementIndex], 'to', dragData.x, dragData.y);
              return {
                ...prev,
                mobPlacements: prev.mobPlacements.map((p, i) =>
                  i === dragData.placementIndex ? { ...p, x: dragData.x, y: dragData.y } : p
                ),
              };
            });
          } else {
            console.log('[ShowTime] Skipping old update (before mount time)');
          }
        } else {
          console.log('[ShowTime] No updatedAt timestamp in drag data');
        }
      } else {
        console.log('[ShowTime] Skipping update - we are the dragger');
      }
    });

    return () => {
      console.log('[ShowTime] Cleaning up drag listener for episode:', episodeId);
      unsubscribe();
    };
  }, [selectedEpisode?.id, isAdmin, draggingMobId, roomId]);

  // Broadcast drag state to other players
  const broadcastDragState = async (placementIndex: number, x: number, y: number) => {
    if (!selectedEpisode || !isAdmin) return;

    // Use a single document per episode for drag state
    const dragDocPath = roomId
      ? `rooms/${roomId}/mob-drag-state/${selectedEpisode.id}`
      : `mob-drag-state/${selectedEpisode.id}`;

    try {
      await setDoc(doc(db, dragDocPath), {
        episodeId: selectedEpisode.id,
        placementIndex,
        x,
        y,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast drag state:', error);
    }
  };

  // Listen for fog of war updates
  useEffect(() => {
    if (!selectedEpisode || !currentMapId) return;

    const fogDocPath = roomId
      ? `rooms/${roomId}/fog-of-war/${selectedEpisode.id}-${currentMapId}`
      : `fog-of-war/${selectedEpisode.id}-${currentMapId}`;

    const fogDocRef = doc(db, fogDocPath);

    const unsubscribe = onSnapshot(fogDocRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const fogData = snapshot.data();
      if (fogData.updatedAt) {
        const updateTime = fogData.updatedAt.toMillis ? fogData.updatedAt.toMillis() : 0;
        const mountTimeMs = mountTime.current.toMillis();

        if (updateTime > mountTimeMs || !isAdmin) {
          setFogOfWarEnabled(fogData.enabled ?? false);
          setRevealedAreas(fogData.revealedAreas ?? []);
          if (fogData.scale !== undefined) {
            setMapScale(fogData.scale);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

  // Broadcast fog of war state
  const broadcastFogState = useCallback(async (
    enabled: boolean,
    areas: { x: number; y: number; radius: number }[],
    scale: number
  ) => {
    if (!selectedEpisode || !currentMapId || !isAdmin) return;

    const fogDocPath = roomId
      ? `rooms/${roomId}/fog-of-war/${selectedEpisode.id}-${currentMapId}`
      : `fog-of-war/${selectedEpisode.id}-${currentMapId}`;

    try {
      await setDoc(doc(db, fogDocPath), {
        episodeId: selectedEpisode.id,
        mapId: currentMapId,
        enabled,
        revealedAreas: areas,
        scale,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast fog state:', error);
    }
  }, [selectedEpisode?.id, currentMapId, roomId, isAdmin]);

  // Handle revealing fog of war areas
  const handleFogReveal = useCallback((x: number, y: number, radius: number) => {
    setRevealedAreas(prev => {
      const newAreas = [...prev, { x, y, radius }];

      // Throttle broadcast
      const now = Date.now();
      if (now - lastFogBroadcastTime.current >= FOG_BROADCAST_THROTTLE_MS) {
        lastFogBroadcastTime.current = now;
        broadcastFogState(fogOfWarEnabled, newAreas, mapScale);
      }

      return newAreas;
    });
  }, [fogOfWarEnabled, mapScale, broadcastFogState]);

  // Toggle fog of war
  const handleToggleFogOfWar = useCallback(() => {
    const newEnabled = !fogOfWarEnabled;
    setFogOfWarEnabled(newEnabled);
    broadcastFogState(newEnabled, revealedAreas, mapScale);
  }, [fogOfWarEnabled, revealedAreas, mapScale, broadcastFogState]);

  // Clear all fog of war (reset to fully fogged)
  const handleClearFogOfWar = useCallback(() => {
    setRevealedAreas([]);
    broadcastFogState(fogOfWarEnabled, [], mapScale);
  }, [fogOfWarEnabled, mapScale, broadcastFogState]);

  // Handle map scale changes
  const handleScaleChange = useCallback((newScale: number) => {
    setMapScale(newScale);
    broadcastFogState(fogOfWarEnabled, revealedAreas, newScale);
  }, [fogOfWarEnabled, revealedAreas, broadcastFogState]);

  // Get all mobs for the current episode
  const episodeMobs = useMemo(() => {
    if (!selectedEpisode) return [];
    return selectedEpisode.mobPlacements
      .map(placement => mobs.find(m => m.id === placement.mobId))
      .filter(Boolean) as Mob[];
  }, [selectedEpisode, mobs]);

  // Get the current map URL
  const currentMapUrl = useMemo(() => {
    if (!selectedEpisode || selectedEpisode.mapIds.length === 0) return null;
    const mapIndex = parseInt(selectedEpisode.mapIds[currentMapIndex], 10);
    return maps[mapIndex] || null;
  }, [selectedEpisode, maps, currentMapIndex]);

  const handlePreviousMap = () => {
    setCurrentMapIndex(prev =>
      prev > 0 ? prev - 1 : (selectedEpisode?.mapIds.length ?? 1) - 1
    );
  };

  const handleNextMap = () => {
    setCurrentMapIndex(prev =>
      prev < (selectedEpisode?.mapIds.length ?? 1) - 1 ? prev + 1 : 0
    );
  };

  const handleToggleMobDisplay = (mobId: string) => {
    setDisplayedMobIds(prev =>
      prev.includes(mobId) ? prev.filter(id => id !== mobId) : [...prev, mobId]
    );
  };

  const handleHideMob = (mobId: string) => {
    setDisplayedMobIds(prev => prev.filter(id => id !== mobId));
  };

  const handleEndEpisode = () => {
    setSelectedEpisode(null);
    setSelectedMap(null);
    setCurrentMapIndex(0);
    setDisplayedMobIds([]);
  };

  const handleMobMouseDown = (placementKey: string) => {
    if (isAdmin) {
      setDraggingMobId(placementKey);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingMobId || !isAdmin || !mapImageRef.current || !selectedEpisode) return;

    const rect = mapImageRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp coordinates to keep mob icons within the map boundaries (0-100%)
    const x = Math.max(0, Math.min(100, rawX));
    const y = Math.max(0, Math.min(100, rawY));

    // Extract index from placement key (format: "mobId-index")
    const index = parseInt(draggingMobId.split('-').pop() || '0', 10);

    // Update mob placement in local state (always update for smooth dragging)
    setSelectedEpisode(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        mobPlacements: prev.mobPlacements.map((p, i) =>
          i === index ? { ...p, x, y } : p
        ),
      };
    });

    // Throttle broadcast to prevent overwhelming Firestore
    const now = Date.now();
    if (now - lastBroadcastTime.current >= BROADCAST_THROTTLE_MS) {
      lastBroadcastTime.current = now;
      broadcastDragState(index, x, y);
    }
  };

  const handleMouseUp = () => {
    if (draggingMobId && selectedEpisode && onUpdateEpisode) {
      // Extract index from placement key and broadcast final position
      const index = parseInt(draggingMobId.split('-').pop() || '0', 10);
      const finalPlacement = selectedEpisode.mobPlacements[index];
      if (finalPlacement && isAdmin) {
        broadcastDragState(index, finalPlacement.x, finalPlacement.y);
      }

      // Persist the updated mob placements
      onUpdateEpisode(selectedEpisode.id, {
        mobPlacements: selectedEpisode.mobPlacements,
      });
    }
    setDraggingMobId(null);
  };

  // Main view when no episode is selected
  if (!selectedEpisode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background p-4"
      >
        {isAdmin ? (
          <DungeonCard className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl text-accent text-glow-gold mb-6 flex items-center gap-3">
              <Map className="w-6 h-6" />
              SHOW TIME - SELECT EPISODE
            </h2>

            <div className="space-y-4">
              {episodes.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No episodes created. Create episodes in the Dungeon AI console.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {episodes.map(episode => (
                    <motion.div
                      key={episode.id}
                      whileHover={{ scale: 1.02 }}
                      className="border-2 border-primary bg-muted/20 p-4 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setSelectedEpisode(episode)}
                    >
                      <h3 className="font-display text-lg text-primary mb-2">{episode.name}</h3>
                      {episode.description && (
                        <p className="text-sm text-muted-foreground mb-3">{episode.description}</p>
                      )}

                      <div className="space-y-2 text-xs mb-4">
                        <div className="flex items-center gap-2">
                          <Map className="w-4 h-4 text-primary" />
                          <span>
                            {episode.mapIds.length} map{episode.mapIds.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-accent" />
                          <span>
                            {episode.mobPlacements.length} mob
                            {episode.mobPlacements.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <DungeonButton
                        variant="admin"
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedEpisode(episode)}
                      >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Load Episode
                      </DungeonButton>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </DungeonCard>
        ) : (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <Layers className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-lg">
                Waiting for the Dungeon Master to start an episode...
              </p>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Episode selection view for DM
  if (!selectedMap) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-background p-4"
      >
        <DungeonCard className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl text-accent text-glow-gold mb-2 flex items-center gap-3">
                <Layers className="w-6 h-6" />
                {selectedEpisode.name}
              </h2>
              {selectedEpisode.description && (
                <p className="text-muted-foreground text-sm">{selectedEpisode.description}</p>
              )}
            </div>
            <DungeonButton variant="default" onClick={() => setSelectedEpisode(null)}>
              <X className="w-4 h-4 mr-2" /> Back to Episodes
            </DungeonButton>
          </div>

          <div className="space-y-6">
            {/* Map selection */}
            <div>
              <h3 className="font-display text-primary text-lg mb-4">Select Map to Display</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {selectedEpisode.mapIds.map((mapIndexStr, idx) => {
                  const mapIndex = parseInt(mapIndexStr, 10);
                  const mapUrl = maps[mapIndex];
                  if (!mapUrl) return null;
                  const mapName = mapNames?.[mapIndex] || `Map ${mapIndex + 1}`;

                  return (
                    <motion.div
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      className="border-2 border-primary bg-muted/20 p-2 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        setCurrentMapIndex(idx);
                        setSelectedMap(mapUrl);
                      }}
                    >
                      <img
                        src={mapUrl}
                        alt={mapName}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <DungeonButton variant="admin" size="sm" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        {mapName}
                      </DungeonButton>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Mob control */}
            {episodeMobs.length > 0 && (
              <div>
                <h3 className="font-display text-primary text-lg mb-4">Display Mobs</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {episodeMobs.map(mob => (
                    <DungeonButton
                      key={mob.id}
                      variant={displayedMobIds.includes(mob.id) ? "admin" : "default"}
                      size="sm"
                      className="justify-start"
                      onClick={() => handleToggleMobDisplay(mob.id)}
                    >
                      <span>{mob.name}</span>
                      {displayedMobIds.includes(mob.id) && (
                        <span className="ml-auto">✓</span>
                      )}
                    </DungeonButton>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DungeonCard>
      </motion.div>
    );
  }

  // Main display view with map and mobs
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background relative flex flex-col"
    >
      {/* DM controls - above the map */}
      {isAdmin && (
        <div className="p-4 pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-background/80 border border-border p-3 rounded-lg">
            <div>
              <h3 className="font-display text-accent text-glow-gold">
                {selectedEpisode.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Map {currentMapIndex + 1} of {selectedEpisode.mapIds.length} | Scale: {mapScale}%
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Map navigation */}
              {selectedEpisode.mapIds.length > 1 && (
                <>
                  <DungeonButton variant="default" size="sm" onClick={handlePreviousMap}>
                    <ChevronLeft className="w-4 h-4" />
                  </DungeonButton>
                  <DungeonButton variant="default" size="sm" onClick={handleNextMap}>
                    <ChevronRight className="w-4 h-4" />
                  </DungeonButton>
                </>
              )}

              {/* Scale controls */}
              <div className="flex items-center gap-1 border-l border-border pl-2">
                <DungeonButton variant="default" size="sm" onClick={() => handleScaleChange(Math.max(25, mapScale - 25))}>
                  <ZoomOut className="w-4 h-4" />
                </DungeonButton>
                <span className="text-xs text-muted-foreground w-12 text-center">{mapScale}%</span>
                <DungeonButton variant="default" size="sm" onClick={() => handleScaleChange(Math.min(200, mapScale + 25))}>
                  <ZoomIn className="w-4 h-4" />
                </DungeonButton>
              </div>

              {/* Grid toggle */}
              <DungeonButton
                variant={showGrid ? "admin" : "default"}
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3x3 className="w-4 h-4 mr-1" />
                Grid
              </DungeonButton>

              {showGrid && (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-16 h-2 bg-border rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground w-6">{gridSize}</span>
                </div>
              )}

              {/* Fog of War controls */}
              <div className="flex items-center gap-1 border-l border-border pl-2">
                <DungeonButton
                  variant={fogOfWarEnabled ? "admin" : "default"}
                  size="sm"
                  onClick={handleToggleFogOfWar}
                  title="Toggle Fog of War"
                >
                  <CloudFog className="w-4 h-4 mr-1" />
                  Fog
                </DungeonButton>

                {fogOfWarEnabled && (
                  <>
                    <div className="flex items-center gap-1">
                      <Eraser className="w-3 h-3 text-muted-foreground" />
                      <input
                        type="range"
                        min="2"
                        max="15"
                        step="1"
                        value={fogBrushSize}
                        onChange={(e) => setFogBrushSize(Number(e.target.value))}
                        className="w-16 h-2 bg-border rounded-lg appearance-none cursor-pointer"
                        title="Brush size"
                      />
                    </div>
                    <DungeonButton
                      variant="danger"
                      size="sm"
                      onClick={handleClearFogOfWar}
                      title="Clear all revealed areas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </DungeonButton>
                  </>
                )}
              </div>

              <DungeonButton variant="default" size="sm" onClick={() => setSelectedMap(null)}>
                <Layers className="w-4 h-4 mr-1" /> Map
              </DungeonButton>

              <DungeonButton variant="danger" size="sm" onClick={handleEndEpisode}>
                <X className="w-4 h-4 mr-2" /> End Episode
              </DungeonButton>
            </div>
          </div>
        </div>
      )}

      {/* Map display */}
      <div
        className="flex-1 flex items-center justify-center p-4 select-none overflow-auto"
      >
        <div
          className="relative"
          style={{
            transform: `scale(${mapScale / 100})`,
            transformOrigin: 'center center',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={mapImageRef}
            src={selectedMap}
            alt="Current Map"
            className="max-w-full max-h-[90vh] object-contain pointer-events-none"
            draggable={false}
          />

          {/* Grid overlay - only visible to DM */}
          {isAdmin && <GridOverlay isVisible={showGrid} cellSize={gridSize} opacity={0.3} />}

          {/* Displayed mobs on the map */}
          {selectedEpisode?.mobPlacements.map((placement, index) => {
          const mob = mobs.find(m => m.id === placement.mobId);
          if (!mob) return null;

          // Count how many times this mob appears before this index
          const sameIdBefore = selectedEpisode.mobPlacements
            .slice(0, index)
            .filter(p => p.mobId === placement.mobId).length;
          const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

          console.log(`[ShowTime] Rendering mob ${index}:`, { x: placement.x, y: placement.y, mobId: placement.mobId });

          const isDragging = draggingMobId === `${placement.mobId}-${index}`;

          return (
            <motion.div
              key={`${placement.mobId}-${index}`}
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                // When dragging, position updates instantly; when not dragging, use animated values
                ...(isDragging ? {
                  left: `${placement.x}%`,
                  top: `${placement.y}%`,
                } : {}),
              }}
              onMouseDown={() => isAdmin && handleMobMouseDown(`${placement.mobId}-${index}`)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                // Only animate position when NOT dragging
                ...(!isDragging ? {
                  left: `${placement.x}%`,
                  top: `${placement.y}%`
                } : {}),
              }}
              transition={{
                scale: { type: "spring", stiffness: 260, damping: 20 },
                opacity: { type: "spring", stiffness: 260, damping: 20 },
                left: { type: "tween", duration: 0.15, ease: "linear" },
                top: { type: "tween", duration: 0.15, ease: "linear" }
              }}
            >
              <div className="relative">
                <MobIcon
                  mob={mob}
                  size={64}
                  isDragging={isDragging}
                />
                {letter && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent text-background rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {letter}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

          {/* Fog of War overlay - placed AFTER mobs so it covers them */}
          <FogOfWar
            isVisible={fogOfWarEnabled}
            revealedAreas={revealedAreas}
            isAdmin={isAdmin}
            brushSize={fogBrushSize}
            onReveal={handleFogReveal}
            onClearAll={handleClearFogOfWar}
          />
        </div>

        {/* Display mobs - positioned to the LEFT of the dice menu */}
        {displayedMobIds.map((mobId, index) => {
          const mob = mobs.find(m => m.id === mobId);
          if (!mob) return null;

          return (
            <ResizableMobDisplay
              key={mobId}
              mob={mob}
              onClose={() => handleHideMob(mobId)}
              index={index}
            />
          );
        })}
      </div>

      {/* Player view - waiting message */}
      {!isAdmin && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <Layers className="w-4 h-4 inline mr-2" />
          Dungeon Master is presenting: {selectedEpisode.name}
        </div>
      )}
    </motion.div>
  );
};

export default ShowTimeView;
