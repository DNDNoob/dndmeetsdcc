import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mob, EpisodeMobPlacement, Crawler, CrawlerPlacement } from "@/lib/gameData";
import MobIcon from "@/components/ui/MobIcon";
import { CrawlerIcon } from "@/components/ui/CrawlerIcon";
import GridOverlay from "@/components/ui/GridOverlay";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { X, Grid3x3, ZoomIn, ZoomOut, Move } from "lucide-react";

interface MapDesignerPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  mapUrl: string;
  mapId: string;
  mapScale: number; // The episode's configured scale (e.g., 100, 150, 200)
  mobs: Mob[];
  placements: EpisodeMobPlacement[];
  onPlacementsChange: (placements: EpisodeMobPlacement[]) => void;
  crawlers?: Crawler[];
  crawlerPlacements?: CrawlerPlacement[];
  onCrawlerPlacementsChange?: (placements: CrawlerPlacement[]) => void;
}

const MapDesignerPopout: React.FC<MapDesignerPopoutProps> = ({
  isOpen,
  onClose,
  mapUrl,
  mapId,
  mapScale,
  mobs,
  placements,
  onPlacementsChange,
  crawlers,
  crawlerPlacements,
  onCrawlerPlacementsChange,
}) => {
  // Dragging state
  const [draggingMobIndex, setDraggingMobIndex] = useState<number | null>(null);
  const [draggingCrawlerIndex, setDraggingCrawlerIndex] = useState<number | null>(null);

  // Grid and zoom
  const [showGrid, setShowGrid] = useState(false);
  const [viewZoom, setViewZoom] = useState(100); // Additional zoom for viewing (on top of mapScale)
  const gridSize = 64; // Match mob icon size

  // Panning
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Refs
  const mapImageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter placements for current map
  const currentMapPlacements = placements.filter(p => p.mapId === mapId);
  const currentMapCrawlerPlacements = crawlerPlacements?.filter(p => p.mapId === mapId) || [];

  // Get full array index from local index
  const getFullMobIndex = useCallback((localIndex: number): number => {
    let count = 0;
    for (let i = 0; i < placements.length; i++) {
      if (placements[i].mapId === mapId) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  }, [placements, mapId]);

  const getFullCrawlerIndex = useCallback((localIndex: number): number => {
    if (!crawlerPlacements) return -1;
    let count = 0;
    for (let i = 0; i < crawlerPlacements.length; i++) {
      if (crawlerPlacements[i].mapId === mapId) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  }, [crawlerPlacements, mapId]);

  // Combined scale: mapScale is the episode's base scale, viewZoom is additional zoom for this view
  const effectiveScale = (mapScale / 100) * (viewZoom / 100);
  // Counter-scale for icons to maintain consistent physical size
  const iconCounterScale = 1 / effectiveScale;

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle panning
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!mapImageRef.current) return;

    const rect = mapImageRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const x = Math.max(0, Math.min(100, rawX));
    const y = Math.max(0, Math.min(100, rawY));

    // Handle mob dragging
    if (draggingMobIndex !== null) {
      const fullIndex = getFullMobIndex(draggingMobIndex);
      if (fullIndex === -1) return;

      const updated = placements.map((p, i) =>
        i === fullIndex ? { ...p, x, y } : p
      );
      onPlacementsChange(updated);
    }

    // Handle crawler dragging
    if (draggingCrawlerIndex !== null && crawlerPlacements && onCrawlerPlacementsChange) {
      const fullIndex = getFullCrawlerIndex(draggingCrawlerIndex);
      if (fullIndex === -1) return;

      const updated = crawlerPlacements.map((p, i) =>
        i === fullIndex ? { ...p, x, y } : p
      );
      onCrawlerPlacementsChange(updated);
    }
  }, [isPanning, panStart, draggingMobIndex, draggingCrawlerIndex, placements, crawlerPlacements, getFullMobIndex, getFullCrawlerIndex, onPlacementsChange, onCrawlerPlacementsChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingMobIndex(null);
    setDraggingCrawlerIndex(null);
    setIsPanning(false);
    setPanStart(null);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or if holding space - start panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    setViewZoom(prev => Math.max(25, Math.min(200, prev + delta)));
  }, []);

  // Keyboard handler for panning
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset pan on open
  useEffect(() => {
    if (isOpen) {
      setPanOffset({ x: 0, y: 0 });
      setViewZoom(100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-xl text-primary">Map Designer</h2>
          <span className="text-sm text-muted-foreground">
            Episode Scale: {mapScale}% | View Zoom: {viewZoom}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DungeonButton
            variant={showGrid ? "admin" : "default"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            Grid
          </DungeonButton>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={() => setViewZoom(prev => Math.min(200, prev + 25))}
          >
            <ZoomIn className="w-4 h-4" />
          </DungeonButton>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={() => setViewZoom(prev => Math.max(25, prev - 25))}
          >
            <ZoomOut className="w-4 h-4" />
          </DungeonButton>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={() => { setPanOffset({ x: 0, y: 0 }); setViewZoom(100); }}
          >
            <Move className="w-4 h-4 mr-2" />
            Reset View
          </DungeonButton>
          <DungeonButton
            variant="danger"
            size="sm"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </DungeonButton>
        </div>
      </div>

      {/* Map container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}
          >
            {/* Scaled map wrapper */}
            <div
              className="relative"
              style={{
                transform: `scale(${effectiveScale})`,
                transformOrigin: 'center center',
              }}
            >
              <img
                ref={mapImageRef}
                src={mapUrl}
                alt="Map"
                className="max-h-[80vh] w-auto object-contain border-2 border-primary shadow-[0_0_15px_rgba(0,200,255,0.5)]"
                draggable={false}
              />

              {/* Grid overlay */}
              <GridOverlay isVisible={showGrid} cellSize={gridSize} opacity={0.3} />

              {/* Mob placements */}
              {currentMapPlacements.map((placement, localIndex) => {
                const mob = mobs.find(m => m.id === placement.mobId);
                if (!mob) return null;

                const sameIdBefore = currentMapPlacements.slice(0, localIndex).filter(p => p.mobId === placement.mobId).length;
                const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

                return (
                  <div
                    key={`mob-${placement.mobId}-${localIndex}`}
                    className="absolute"
                    style={{
                      left: `${placement.x}%`,
                      top: `${placement.y}%`,
                      transform: `translate(-50%, -50%) scale(${iconCounterScale})`,
                      cursor: draggingMobIndex === localIndex ? 'grabbing' : 'grab',
                      zIndex: draggingMobIndex === localIndex ? 100 : 10,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingMobIndex(localIndex);
                    }}
                  >
                    <MobIcon
                      mob={mob}
                      size={64}
                      isDragging={draggingMobIndex === localIndex}
                    />
                    {letter && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-background rounded-full flex items-center justify-center text-xs font-bold">
                        {letter}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Crawler placements */}
              {currentMapCrawlerPlacements.map((placement, localIndex) => {
                const crawler = crawlers?.find(c => c.id === placement.crawlerId);
                if (!crawler) return null;

                const sameIdBefore = currentMapCrawlerPlacements.slice(0, localIndex).filter(p => p.crawlerId === placement.crawlerId).length;
                const letter = sameIdBefore > 0 ? String.fromCharCode(65 + sameIdBefore) : '';

                return (
                  <div
                    key={`crawler-${placement.crawlerId}-${localIndex}`}
                    className="absolute"
                    style={{
                      left: `${placement.x}%`,
                      top: `${placement.y}%`,
                      transform: `translate(-50%, -50%) scale(${iconCounterScale})`,
                      cursor: draggingCrawlerIndex === localIndex ? 'grabbing' : 'grab',
                      zIndex: draggingCrawlerIndex === localIndex ? 100 : 10,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingCrawlerIndex(localIndex);
                    }}
                  >
                    <CrawlerIcon
                      crawler={crawler}
                      size={64}
                      isDragging={draggingCrawlerIndex === localIndex}
                    />
                    {letter && (
                      <div className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {letter}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Instructions overlay */}
        <div className="absolute bottom-4 left-4 bg-background/80 border border-border rounded p-3 text-xs text-muted-foreground space-y-1">
          <p><strong>Drag</strong> mobs/crawlers to position them</p>
          <p><strong>Scroll</strong> to zoom in/out</p>
          <p><strong>Middle-click + drag</strong> to pan</p>
          <p><strong>Esc</strong> to close</p>
        </div>
      </div>
    </div>
  );
};

export default MapDesignerPopout;
