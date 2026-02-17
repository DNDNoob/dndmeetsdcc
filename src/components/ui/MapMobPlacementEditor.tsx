import React, { useState, useRef } from "react";
import { Mob, EpisodeMobPlacement, Crawler, CrawlerPlacement, InventoryItem } from "@/lib/gameData";
import MobIcon from "@/components/ui/MobIcon";
import { CrawlerIcon } from "@/components/ui/CrawlerIcon";
import GridOverlay from "@/components/ui/GridOverlay";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Grid3x3, Trash2, RotateCcw, Package, Plus, Search, X } from "lucide-react";

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
  // Shared inventory for adding items to mob placements
  getSharedInventory?: () => InventoryItem[];
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
  getSharedInventory,
}) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [editingInventoryIndex, setEditingInventoryIndex] = useState<number | null>(null);
  const [mobInvSearch, setMobInvSearch] = useState('');
  const [draggingCrawlerIndex, setDraggingCrawlerIndex] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const baseGridSize = 51; // Base grid size in pixels
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Scale grid inversely to map scale (larger map = smaller grid cells in preview)
  const iconScale = 100 / mapScale;
  const scaledGridSize = baseGridSize * iconScale;

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
        <GridOverlay isVisible={showGrid} cellSize={scaledGridSize} opacity={0.3} />

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
          return (
            <div
              key={`${placement.mobId}-${mapId}-${index}`}
              className="absolute"
              style={{
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: `translate(-50%, -50%) scale(${iconScale})`,
                cursor: draggingIndex === index ? "grabbing" : "grab",
              }}
              onMouseDown={e => handleMouseDown(e, index)}
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
            </div>
          );
        })}

        {/* Placed crawlers - only show crawlers for current map */}
        {currentMapCrawlerPlacements.map((placement, index) => {
          const crawler = crawlers?.find(c => c.id === placement.crawlerId);
          if (!crawler) return null;

          // Count how many times this crawler appears before this index on this map
          const sameIdBefore = currentMapCrawlerPlacements.slice(0, index).filter(p => p.crawlerId === placement.crawlerId).length;
          const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

          return (
            <div
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
            </div>
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
          <div className="space-y-2">
            {currentMapPlacements.map((placement, index) => {
              const mob = mobs.find(m => m.id === placement.mobId);
              if (!mob) return null;
              const fullIndex = getFullArrayIndex(index);

              // Count how many times this mob appears before this index on this map
              const sameIdBefore = currentMapPlacements.slice(0, index).filter(p => p.mobId === placement.mobId).length;
              const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';
              const isEditingInv = editingInventoryIndex === index;
              const mobItems = placement.inventoryOverride ?? mob.defaultInventory ?? [];
              const mobGold = placement.goldOverride ?? mob.defaultGold ?? 0;

              return (
                <div
                  key={`${placement.mobId}-${mapId}-${index}`}
                  className="bg-background border border-border rounded p-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {mob.name}{letter && ` (${letter})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ({placement.x.toFixed(0)}%, {placement.y.toFixed(0)}%)
                        {mobItems.length > 0 && <span className="ml-1 text-accent">· {mobItems.length} items</span>}
                        {mobGold > 0 && <span className="ml-1 text-accent">· {mobGold}g</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => {
                          setEditingInventoryIndex(isEditingInv ? null : index);
                          setMobInvSearch('');
                        }}
                        className={`p-1 rounded transition-colors ${isEditingInv ? 'bg-accent/20 text-accent' : 'hover:bg-accent/10 text-muted-foreground'}`}
                        title="Edit inventory"
                      >
                        <Package className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveMob(index)}
                        className="p-1 hover:bg-destructive/10 rounded transition-colors"
                        title="Remove mob"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Inline inventory editor */}
                  {isEditingInv && (
                    <div className="mt-2 border-t border-border pt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground">Gold:</label>
                        <input
                          type="number"
                          min={0}
                          value={mobGold}
                          onChange={(e) => {
                            if (fullIndex === -1) return;
                            const val = parseInt(e.target.value) || 0;
                            const updated = placements.map((p, i) =>
                              i === fullIndex ? { ...p, goldOverride: val } : p
                            );
                            onPlacementsChange(updated);
                          }}
                          className="w-16 bg-muted border border-border px-1.5 py-0.5 text-xs text-center"
                        />
                      </div>
                      {/* Search items */}
                      {getSharedInventory && (
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search items..."
                            value={mobInvSearch}
                            onChange={(e) => setMobInvSearch(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 bg-muted border border-border text-xs"
                          />
                        </div>
                      )}
                      {mobInvSearch && getSharedInventory && (() => {
                        const allItems = getSharedInventory();
                        const filtered = allItems.filter(item =>
                          item.name.toLowerCase().includes(mobInvSearch.toLowerCase()) &&
                          !mobItems.some(mi => mi.id === item.id)
                        ).slice(0, 5);
                        if (filtered.length === 0) return <p className="text-[10px] text-muted-foreground italic">No matching items</p>;
                        return (
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {filtered.map(item => (
                              <div key={item.id} className="flex items-center justify-between bg-muted/30 border border-border rounded px-2 py-0.5">
                                <span className="text-[10px] text-primary truncate">{item.name}</span>
                                <button
                                  onClick={() => {
                                    if (fullIndex === -1) return;
                                    const updatedItems = [...mobItems, { ...item }];
                                    const updated = placements.map((p, i) =>
                                      i === fullIndex ? { ...p, inventoryOverride: updatedItems } : p
                                    );
                                    onPlacementsChange(updated);
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded shrink-0 ml-1"
                                >
                                  <Plus className="w-3 h-3 inline" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {/* Current items */}
                      {mobItems.length > 0 ? (
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {mobItems.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="flex items-center justify-between bg-muted/30 border border-border rounded px-2 py-0.5">
                              <div className="min-w-0">
                                <span className="text-[10px] text-primary truncate block">{item.name}</span>
                                {item.equipSlot && <span className="text-[9px] text-accent">{item.equipSlot}</span>}
                              </div>
                              <button
                                onClick={() => {
                                  if (fullIndex === -1) return;
                                  const updatedItems = mobItems.filter((_, i) => i !== idx);
                                  const updated = placements.map((p, i) =>
                                    i === fullIndex ? { ...p, inventoryOverride: updatedItems.length > 0 ? updatedItems : undefined } : p
                                  );
                                  onPlacementsChange(updated);
                                }}
                                className="p-0.5 hover:bg-destructive/10 rounded shrink-0 ml-1"
                              >
                                <X className="w-3 h-3 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic">No items</p>
                      )}
                    </div>
                  )}
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
