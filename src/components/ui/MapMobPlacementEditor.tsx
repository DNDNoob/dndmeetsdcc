import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Mob, EpisodeMobPlacement } from "@/lib/gameData";
import MobIcon from "@/components/ui/MobIcon";
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
}

const MapMobPlacementEditor: React.FC<MapMobPlacementEditorProps> = ({
  mapUrl,
  mapId,
  mobs,
  placements,
  onPlacementsChange,
  onAddMob,
  onRemoveMob,
}) => {
  const [draggingMobId, setDraggingMobId] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const gridSize = 64; // Fixed size to match mob icons
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setDraggingIndex(index);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingIndex === null || !mapContainerRef.current) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp to 0-100
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    // draggingIndex is a local index into currentMapPlacements, need to find full array index
    const fullIndex = getFullArrayIndex(draggingIndex);
    if (fullIndex === -1) return;

    const updatedPlacements = placements.map((p, i) =>
      i === fullIndex
        ? { ...p, x: clampedX, y: clampedY }
        : p
    );

    onPlacementsChange(updatedPlacements);
  };

  const handleMouseUp = () => {
    setDraggingIndex(null);
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
  };

  // Filter placements to only show mobs for current map
  const currentMapPlacements = placements.filter(p => p.mapId === mapId);

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

        {/* Placed mobs - only show mobs for current map */}
        {currentMapPlacements.map((placement, index) => {
          const mob = mobs.find(m => m.id === placement.mobId);
          if (!mob) return null;

          // Count how many times this mob appears before this index on this map
          const sameIdBefore = currentMapPlacements.slice(0, index).filter(p => p.mobId === placement.mobId).length;
          const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

          return (
            <motion.div
              key={`${placement.mobId}-${mapId}-${index}`}
              className="absolute"
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: "translate(-50%, -50%)",
                cursor: draggingIndex === index ? "grabbing" : "grab",
              }}
              onMouseDown={e => handleMouseDown(e, index)}
              whileHover={{ scale: 1.1 }}
              whileDrag={{ scale: 1.15 }}
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

        {/* Empty state */}
        {currentMapPlacements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">No mobs placed on this map yet</p>
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
