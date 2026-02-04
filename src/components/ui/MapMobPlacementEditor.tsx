import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Mob, EpisodeMobPlacement, Crawler, CrawlerPlacement } from "@/lib/gameData";
import MobIcon from "@/components/ui/MobIcon";
import { CrawlerIcon } from "@/components/ui/CrawlerIcon";
import GridOverlay from "@/components/ui/GridOverlay";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Grid3x3, Trash2, RotateCcw } from "lucide-react";

interface MapMobPlacementEditorProps {
  mapUrl: string;
  mapId: string; // The current map ID for filtering placements
  mobs: Mob[];
  placements: EpisodeMobPlacement[];
  onPlacementsChange: (placements: EpisodeMobPlacement[]) => void;
  onAddMob?: (mobId: string) => void;
  onRemoveMob?: (mobId: string) => void;
  // Optional crawler support
  crawlers?: Crawler[];
  crawlerPlacements?: CrawlerPlacement[];
  onCrawlerPlacementsChange?: (placements: CrawlerPlacement[]) => void;
  // Scale preview
  mapScale?: number;
}

const MapMobPlacementEditor: React.FC<MapMobPlacementEditorProps> = ({
  mapUrl,
  mapId,
  mobs,
  placements,
  onPlacementsChange,
  onAddMob,
  onRemoveMob,
  crawlers,
  crawlerPlacements,
  onCrawlerPlacementsChange,
  mapScale = 100,
}) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingCrawlerIndex, setDraggingCrawlerIndex] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const gridSize = 51; // Reduced by 20% from 64px
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setDraggingIndex(index);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mapContainerRef.current) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    // Handle mob dragging
    if (draggingIndex !== null) {
      const fullIndex = getFullArrayIndex(draggingIndex);
      if (fullIndex === -1) return;

      const updatedPlacements = placements.map((p, i) =>
        i === fullIndex ? { ...p, x: clampedX, y: clampedY } : p
      );
      onPlacementsChange(updatedPlacements);
    }

    // Handle crawler dragging
    if (draggingCrawlerIndex !== null && crawlerPlacements && onCrawlerPlacementsChange) {
      const fullIndex = getCrawlerFullArrayIndex(draggingCrawlerIndex);
      if (fullIndex === -1) return;

      const updatedPlacements = crawlerPlacements.map((p, i) =>
        i === fullIndex ? { ...p, x: clampedX, y: clampedY } : p
      );
      onCrawlerPlacementsChange(updatedPlacements);
    }
  };

  const handleMouseUp = () => {
    setDraggingIndex(null);
    setDraggingCrawlerIndex(null);
  };

  const handleRemoveMob = (localIndex: number) => {
    const fullIndex = getFullArrayIndex(localIndex);
    if (fullIndex === -1) return;

    const mobId = placements[fullIndex].mobId;
    const updated = placements.filter((_, i) => i !== fullIndex);
    onPlacementsChange(updated);
    if (onRemoveMob) {
      onRemoveMob(mobId);
    }
  };

  const handleResetPositions = () => {
    // Only reset positions for mobs on the current map
    const reset = placements.map(p =>
      p.mapId === mapId ? { ...p, x: 50, y: 50 } : p
    );
    onPlacementsChange(reset);

    // Also reset crawler positions if available
    if (crawlerPlacements && onCrawlerPlacementsChange) {
      const resetCrawlers = crawlerPlacements.map(p =>
        p.mapId === mapId ? { ...p, x: 50, y: 50 } : p
      );
      onCrawlerPlacementsChange(resetCrawlers);
    }
  };

  // Filter placements to only show mobs for current map
  const currentMapPlacements = placements.filter(p => p.mapId === mapId);

  // Filter crawler placements for current map
  const currentMapCrawlerPlacements = crawlerPlacements?.filter(p => p.mapId === mapId) || [];

  // Get indices of current map placements in the full array
  const getFullArrayIndex = (localIndex: number): number => {
    let count = 0;
    for (let i = 0; i < placements.length; i++) {
      if (placements[i].mapId === mapId) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  };

  // Get indices of current map crawler placements in the full array
  const getCrawlerFullArrayIndex = (localIndex: number): number => {
    if (!crawlerPlacements) return -1;
    let count = 0;
    for (let i = 0; i < crawlerPlacements.length; i++) {
      if (crawlerPlacements[i].mapId === mapId) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  };

  const handleRemoveCrawler = (localIndex: number) => {
    if (!crawlerPlacements || !onCrawlerPlacementsChange) return;
    const fullIndex = getCrawlerFullArrayIndex(localIndex);
    if (fullIndex === -1) return;
    const updated = crawlerPlacements.filter((_, i) => i !== fullIndex);
    onCrawlerPlacementsChange(updated);
  };

  // Show all mobs - allow adding duplicates
  const availableMobs = mobs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-primary text-lg">Map Mob Placement</h4>
        <div className="flex items-center gap-2">
          <DungeonButton
            variant={showGrid ? "admin" : "default"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid (64px cells to match mob icons)"
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            {showGrid ? "Grid On" : "Grid Off"}
          </DungeonButton>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={handleResetPositions}
            disabled={currentMapPlacements.length === 0}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </DungeonButton>
        </div>
      </div>

      {/* Map container with draggable mobs */}
      <div
        ref={mapContainerRef}
        className="relative w-full bg-muted border-2 border-primary rounded-lg overflow-hidden cursor-move select-none"
        style={{
          aspectRatio: "16 / 10",
          backgroundImage: `url(${mapUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <GridOverlay isVisible={showGrid} cellSize={gridSize} opacity={0.3} />

        {/* Scale preview indicator */}
        {mapScale !== 100 && (
          <div className="absolute top-2 left-2 bg-background/80 border border-primary rounded px-2 py-1 text-xs z-10">
            <span className="text-primary font-bold">{mapScale}%</span>
            <span className="text-muted-foreground ml-1">scale</span>
            <div className="mt-1 text-muted-foreground text-[10px]">
              Map will be {mapScale > 100 ? 'larger' : 'smaller'} in ShowTime
            </div>
          </div>
        )}

        {/* Scale visual preview - shows a box representing 100% viewport */}
        {mapScale !== 100 && (
          <div
            className="absolute border-2 border-dashed border-primary/50 pointer-events-none"
            style={{
              width: `${100 * 100 / mapScale}%`,
              height: `${100 * 100 / mapScale}%`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            title="This box shows the approximate viewport at 100% zoom"
          />
        )}

        {/* Placed mobs - only show mobs for current map */}
        {currentMapPlacements.map((placement, index) => {
          const mob = mobs.find(m => m.id === placement.mobId);
          if (!mob) return null;

          // Count how many times this mob appears before this index on this map
          const sameIdBefore = currentMapPlacements.slice(0, index).filter(p => p.mobId === placement.mobId).length;
          const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';
          // Scale icons inversely to map scale (larger map = smaller icons in preview)
          const iconScale = 100 / mapScale;

          return (
            <motion.div
              key={`${placement.mobId}-${mapId}-${index}`}
              className="absolute"
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: `translate(-50%, -50%) scale(${iconScale})`,
                cursor: draggingIndex === index ? "grabbing" : "grab",
              }}
              onMouseDown={e => handleMouseDown(e, index)}
              whileHover={{ scale: 1.1 * iconScale }}
              whileDrag={{ scale: 1.15 * iconScale }}
            >
              <div className="relative">
                <MobIcon
                  mob={mob}
                  size={40}
                  isDragging={draggingIndex === index}
                />
                {letter && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-background rounded-full flex items-center justify-center text-xs font-bold">
                    {letter}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveMob(index);
                  }}
                  className="absolute -top-2 -left-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Placed crawlers - only show crawlers for current map */}
        {currentMapCrawlerPlacements.map((placement, index) => {
          const crawler = crawlers?.find(c => c.id === placement.crawlerId);
          if (!crawler) return null;

          // Count how many times this crawler appears before this index on this map
          const sameIdBefore = currentMapCrawlerPlacements.slice(0, index).filter(p => p.crawlerId === placement.crawlerId).length;
          const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';
          // Scale icons inversely to map scale (larger map = smaller icons in preview)
          const iconScale = 100 / mapScale;

          return (
            <motion.div
              key={`crawler-${placement.crawlerId}-${mapId}-${index}`}
              className="absolute"
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: `translate(-50%, -50%) scale(${iconScale})`,
                cursor: draggingCrawlerIndex === index ? "grabbing" : "grab",
              }}
              onMouseDown={e => {
                e.preventDefault();
                setDraggingCrawlerIndex(index);
              }}
              whileHover={{ scale: 1.1 * iconScale }}
              whileDrag={{ scale: 1.15 * iconScale }}
            >
              <div className="relative">
                <CrawlerIcon
                  crawler={crawler}
                  size={40}
                  isDragging={draggingCrawlerIndex === index}
                />
                {letter && (
                  <div className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {letter}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCrawler(index);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Empty state */}
        {currentMapPlacements.length === 0 && currentMapCrawlerPlacements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">No mobs or crawlers placed on this map yet</p>
              <p className="text-xs">Add mobs from the list below</p>
            </div>
          </div>
        )}
      </div>

      {/* Mob list - add mobs to placement */}
      {availableMobs.length > 0 && (
        <div className="bg-muted/30 border border-border rounded p-4">
          <h5 className="font-display text-sm text-primary mb-3">Available Mobs (Click to Add to This Map)</h5>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableMobs.map(mob => {
              // Count placements of this mob on current map only
              const count = currentMapPlacements.filter(p => p.mobId === mob.id).length;
              return (
                <DungeonButton
                  key={mob.id}
                  variant="default"
                  size="sm"
                  className="justify-start h-auto flex-col"
                  onClick={() => {
                    const newPlacement: EpisodeMobPlacement = {
                      mobId: mob.id,
                      mapId: mapId,
                      x: 50,
                      y: 50,
                      scale: 1,
                    };
                    onPlacementsChange([...placements, newPlacement]);
                    if (onAddMob) {
                      onAddMob(mob.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-xs">{mob.name}</span>
                    {count > 0 && (
                      <span className="text-xs bg-accent text-background px-2 py-0.5 rounded-full font-bold">
                        {count}
                      </span>
                    )}
                  </div>
                  {mob.hitPoints && <span className="text-xs text-muted-foreground">HP: {mob.hitPoints}</span>}
                </DungeonButton>
              );
            })}
          </div>
        </div>
      )}

      {/* Placed mobs list - remove mobs (only show mobs for current map) */}
      {currentMapPlacements.length > 0 && (
        <div className="bg-muted/30 border border-border rounded p-4">
          <h5 className="font-display text-sm text-primary mb-3">Mobs on This Map</h5>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {currentMapPlacements.map((placement, index) => {
              const mob = mobs.find(m => m.id === placement.mobId);
              if (!mob) return null;

              // Count how many times this mob appears before this index on this map
              const sameIdBefore = currentMapPlacements.slice(0, index).filter(p => p.mobId === placement.mobId).length;
              const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

              return (
                <div
                  key={`${placement.mobId}-${mapId}-${index}`}
                  className="flex items-center justify-between bg-background border border-border rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {mob.name}{letter && ` (${letter})`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ({placement.x.toFixed(0)}%, {placement.y.toFixed(0)}%)
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveMob(index)}
                    className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors"
                    title="Remove mob"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapMobPlacementEditor;
