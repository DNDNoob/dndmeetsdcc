import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Mob, EpisodeMobPlacement } from "@/lib/gameData";
import MobIcon from "@/components/ui/MobIcon";
import GridOverlay from "@/components/ui/GridOverlay";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Grid3x3, Trash2, RotateCcw } from "lucide-react";

interface MapMobPlacementEditorProps {
  mapUrl: string;
  mobs: Mob[];
  placements: EpisodeMobPlacement[];
  onPlacementsChange: (placements: EpisodeMobPlacement[]) => void;
  onAddMob?: (mobId: string) => void;
  onRemoveMob?: (mobId: string) => void;
}

const MapMobPlacementEditor: React.FC<MapMobPlacementEditorProps> = ({
  mapUrl,
  mobs,
  placements,
  onPlacementsChange,
  onAddMob,
  onRemoveMob,
}) => {
  const [draggingMobId, setDraggingMobId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridCellSize, setGridCellSize] = useState(50);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent, mobId: string) => {
    e.preventDefault();
    setDraggingMobId(mobId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingMobId || !mapContainerRef.current) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp to 0-100
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    const updatedPlacements = placements.map(p =>
      p.mobId === draggingMobId
        ? { ...p, x: clampedX, y: clampedY }
        : p
    );

    onPlacementsChange(updatedPlacements);
  };

  const handleMouseUp = () => {
    setDraggingMobId(null);
  };

  const handleRemoveMob = (mobId: string) => {
    const updated = placements.filter(p => p.mobId !== mobId);
    onPlacementsChange(updated);
    if (onRemoveMob) {
      onRemoveMob(mobId);
    }
  };

  const handleResetPositions = () => {
    const reset = placements.map(p => ({
      ...p,
      x: 50,
      y: 50,
    }));
    onPlacementsChange(reset);
  };

  const placedMobIds = placements.map(p => p.mobId);
  const unplacedMobs = mobs.filter(m => !placedMobIds.includes(m.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-primary text-lg">Map Mob Placement</h4>
        <div className="flex items-center gap-2">
          <DungeonButton
            variant={showGrid ? "admin" : "default"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            {showGrid ? "Grid On" : "Grid Off"}
          </DungeonButton>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={handleResetPositions}
            disabled={placements.length === 0}
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
        <GridOverlay 
          isVisible={showGrid} 
          cellSize={gridCellSize} 
          opacity={0.15}
          onCellSizeChange={setGridCellSize}
          showControls={true}
        />

        {/* Placed mobs */}
        {placements.map(placement => {
          const mob = mobs.find(m => m.id === placement.mobId);
          if (!mob) return null;

          return (
            <motion.div
              key={placement.mobId}
              className="absolute"
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: "translate(-50%, -50%)",
                cursor: draggingMobId === placement.mobId ? "grabbing" : "grab",
              }}
              onMouseDown={e => handleMouseDown(e, placement.mobId)}
              whileHover={{ scale: 1.1 }}
              whileDrag={{ scale: 1.15 }}
            >
              <MobIcon
                mob={mob}
                size={40}
                isDragging={draggingMobId === placement.mobId}
              />
            </motion.div>
          );
        })}

        {/* Empty state */}
        {placements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">No mobs placed yet</p>
              <p className="text-xs">Add mobs from the list below</p>
            </div>
          </div>
        )}
      </div>

      {/* Mob list - add mobs to placement */}
      {unplacedMobs.length > 0 && (
        <div className="bg-muted/30 border border-border rounded p-4">
          <h5 className="font-display text-sm text-primary mb-3">Available Mobs</h5>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {unplacedMobs.map(mob => (
              <DungeonButton
                key={mob.id}
                variant="default"
                size="sm"
                className="justify-start h-auto flex-col"
                onClick={() => {
                  const newPlacement: EpisodeMobPlacement = {
                    mobId: mob.id,
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
                <span className="text-xs">{mob.name}</span>
                {mob.hitPoints && <span className="text-xs text-muted-foreground">HP: {mob.hitPoints}</span>}
              </DungeonButton>
            ))}
          </div>
        </div>
      )}

      {/* Placed mobs list - remove mobs */}
      {placements.length > 0 && (
        <div className="bg-muted/30 border border-border rounded p-4">
          <h5 className="font-display text-sm text-primary mb-3">Placed Mobs</h5>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {placements.map(placement => {
              const mob = mobs.find(m => m.id === placement.mobId);
              if (!mob) return null;

              return (
                <div
                  key={placement.mobId}
                  className="flex items-center justify-between bg-background border border-border rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{mob.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ({placement.x.toFixed(0)}%, {placement.y.toFixed(0)}%)
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveMob(placement.mobId)}
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
