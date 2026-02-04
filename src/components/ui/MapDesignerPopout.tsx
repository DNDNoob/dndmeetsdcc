import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mob, EpisodeMobPlacement, Crawler, CrawlerPlacement } from "@/lib/gameData";
import MobIcon from "@/components/ui/MobIcon";
import { CrawlerIcon } from "@/components/ui/CrawlerIcon";
import GridOverlay from "@/components/ui/GridOverlay";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { X, Grid3x3, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

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
  const [viewZoom, setViewZoom] = useState(100); // User's viewport zoom (separate from episode scale)
  const gridSize = 64; // Match mob icon size

  // Panning (matches ShowTimeView behavior)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Map dimensions for proper layout
  const [mapImageDimensions, setMapImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Refs
  const mapImageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom limits
  const zoomMin = 1;
  const zoomMax = 500;

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

  // Counter-scale for icons - only counters the episode's base scale, NOT the view zoom
  // This matches ShowTimeView behavior where icons zoom WITH the user's scroll
  const iconCounterScale = 100 / mapScale;

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setViewZoom(prev => Math.min(prev + 25, zoomMax));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewZoom(prev => Math.max(prev - 25, zoomMin));
  }, []);

  // Pan start
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Don't pan if clicking on a draggable element
    if ((e.target as HTMLElement).closest('[data-draggable]')) return;

    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y,
    });
  }, [panOffset]);

  // Handle mouse move for dragging and panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle panning
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset({
        x: panStart.panX + dx,
        y: panStart.panY + dy,
      });
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
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
  }, [isPanning]);

  // Handle scroll wheel zoom (matches ShowTimeView)
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) {
        setViewZoom(prev => Math.min(prev + 2, zoomMax));
      } else {
        setViewZoom(prev => Math.max(prev - 2, zoomMin));
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  // Keyboard handler
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

  // Reset pan/zoom on open
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
            Base Scale: {mapScale}% | Zoom: {viewZoom}%
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
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </DungeonButton>
          <div className="text-xs text-center text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border min-w-[50px]">
            {viewZoom}%
          </div>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </DungeonButton>
          <DungeonButton
            variant="default"
            size="sm"
            onClick={() => { setPanOffset({ x: 0, y: 0 }); setViewZoom(100); }}
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
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

      {/* Map container - matches ShowTimeView structure */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 select-none overflow-hidden relative"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Outer transform for pan + user zoom */}
        <div
          className="relative"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${viewZoom / 100})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Spacer div for layout */}
          <div
            className="relative"
            style={{
              width: mapImageDimensions ? `${mapImageDimensions.width * mapScale / 100}px` : `calc(128vh * ${mapScale / 100})`,
              height: `calc(80vh * ${mapScale / 100})`,
            }}
          >
            {/* Inner transform for episode base scale */}
            <div
              className="absolute top-0 left-0"
              style={{
                transform: `scale(${mapScale / 100})`,
                transformOrigin: 'top left',
              }}
            >
              <img
                ref={mapImageRef}
                src={mapUrl}
                alt="Map"
                className="object-contain pointer-events-none border-2 border-primary shadow-[0_0_15px_rgba(0,200,255,0.5)]"
                style={{
                  height: '80vh',
                  width: 'auto',
                  display: 'block',
                }}
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setMapImageDimensions({ width: img.clientWidth, height: img.clientHeight });
                }}
              />

              {/* Grid overlay */}
              <GridOverlay isVisible={showGrid} cellSize={gridSize * iconCounterScale} opacity={0.3} />

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
                    data-draggable
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
                    data-draggable
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
          <p><strong>Click + drag</strong> to pan</p>
          <p><strong>Scroll</strong> to zoom in/out</p>
          <p><strong>Esc</strong> to close</p>
        </div>
      </div>
    </div>
  );
};

export default MapDesignerPopout;
