import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { ResizableMobDisplay } from "@/components/ui/ResizableMobDisplay";
import { GridOverlay } from "@/components/ui/GridOverlay";
import { MobIcon } from "@/components/ui/MobIcon";
import { Episode, Mob } from "@/lib/gameData";
import { Map, X, Eye, Layers, ChevronLeft, ChevronRight, PlayCircle, Grid3x3 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, Timestamp, deleteDoc, getDocs } from "firebase/firestore";
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

  // Auto-select first episode and first map when episodes load (only once)
  useEffect(() => {
    if (episodes.length > 0 && !selectedEpisode && !hasAutoLoaded.current) {
      const firstEpisode = episodes[0];
      setSelectedEpisode(firstEpisode);
      if (firstEpisode.mapIds.length > 0) {
        const mapIndex = parseInt(firstEpisode.mapIds[0], 10);
        setSelectedMap(maps[mapIndex] || null);
        setCurrentMapIndex(0);
      }
      hasAutoLoaded.current = true;
    }
  }, [episodes, maps]);

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

    const dragCollectionName = roomId ? `rooms/${roomId}/mob-drag-state` : 'mob-drag-state';
    const q = query(
      collection(db, dragCollectionName),
      where('episodeId', '==', selectedEpisode.id),
      where('createdAt', '>', mountTime.current)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const dragData = change.doc.data();
          console.log('[ShowTime] Received drag update:', dragData);

          // Only apply if we're not the one dragging
          if (!isAdmin || !draggingMobId) {
            setRemoteDragState({
              placementIndex: dragData.placementIndex,
              x: dragData.x,
              y: dragData.y
            });

            // Update local episode state with remote drag position
            setSelectedEpisode(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                mobPlacements: prev.mobPlacements.map((p, i) =>
                  i === dragData.placementIndex ? { ...p, x: dragData.x, y: dragData.y } : p
                ),
              };
            });
          }

          // Clean up old drag state documents
          deleteDoc(change.doc.ref).catch(console.error);
        }
      });
    });

    return () => unsubscribe();
  }, [selectedEpisode, isAdmin, draggingMobId, roomId]);

  // Broadcast drag state to other players
  const broadcastDragState = async (placementIndex: number, x: number, y: number) => {
    if (!selectedEpisode || !isAdmin) return;

    const dragCollectionName = roomId ? `rooms/${roomId}/mob-drag-state` : 'mob-drag-state';
    try {
      await addDoc(collection(db, dragCollectionName), {
        episodeId: selectedEpisode.id,
        placementIndex,
        x,
        y,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[ShowTime] Failed to broadcast drag state:', error);
    }
  };

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
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Extract index from placement key (format: "mobId-index")
    const index = parseInt(draggingMobId.split('-').pop() || '0', 10);

    // Update mob placement in local state
    setSelectedEpisode(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        mobPlacements: prev.mobPlacements.map((p, i) =>
          i === index ? { ...p, x, y } : p
        ),
      };
    });

    // Broadcast drag state to other players
    broadcastDragState(index, x, y);
  };

  const handleMouseUp = () => {
    if (draggingMobId && selectedEpisode && onUpdateEpisode) {
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
      {/* Map display */}
      <div 
        className="flex-1 flex items-center justify-center p-4 relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={mapImageRef}
          src={selectedMap}
          alt="Current Map"
          className="max-w-full max-h-[90vh] object-contain"
        />

        {/* Grid overlay */}
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

          return (
            <motion.div
              key={`${placement.mobId}-${index}`}
              style={{
                position: "absolute",
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={() => isAdmin && handleMobMouseDown(`${placement.mobId}-${index}`)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <div className="relative">
                <MobIcon
                  mob={mob}
                  size={64}
                  isDragging={draggingMobId === `${placement.mobId}-${index}`}
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

        {/* DM controls overlay */}
        {isAdmin && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between bg-background/80 border border-border p-3 rounded-lg">
            <div>
              <h3 className="font-display text-accent text-glow-gold">
                {selectedEpisode.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Map {currentMapIndex + 1} of {selectedEpisode.mapIds.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
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

              <DungeonButton 
                variant={showGrid ? "admin" : "default"} 
                size="sm" 
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                {showGrid ? "Grid On" : "Grid Off"}
              </DungeonButton>

              {showGrid && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Size:</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-24 h-2 bg-border rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground w-8">{gridSize}</span>
                </div>
              )}

              <DungeonButton variant="default" size="sm" onClick={() => setSelectedMap(null)}>
                <Layers className="w-4 h-4 mr-2" /> Change Map
              </DungeonButton>

              <DungeonButton variant="danger" size="sm" onClick={handleEndEpisode}>
                <X className="w-4 h-4 mr-2" /> End Episode
              </DungeonButton>
            </div>
          </div>
        )}

        {/* Display mobs in bottom-right corner */}
        {displayedMobIds.map(mobId => {
          const mob = mobs.find(m => m.id === mobId);
          if (!mob) return null;

          return (
            <ResizableMobDisplay
              key={mobId}
              mob={mob}
              onClose={() => handleHideMob(mobId)}
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
