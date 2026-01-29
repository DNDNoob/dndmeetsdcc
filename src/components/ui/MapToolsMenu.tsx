import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Target, Square, ChevronDown, ChevronUp, Palette, User, Skull, Grid3x3, CloudFog, Eraser, Trash2, Layers, X, ChevronLeft, ChevronRight, Circle, Triangle, RectangleHorizontal } from "lucide-react";
import { Crawler, Mob } from "@/lib/gameData";
import { ShapeType } from "@/components/ui/MapBox";

interface MapToolsMenuProps {
  onPing: (color: string) => void;
  onAddBox: (color: string, opacity: number) => void;
  isPingMode: boolean;
  isBoxMode: boolean;
  setIsPingMode: (value: boolean) => void;
  setIsBoxMode: (value: boolean) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  boxOpacity: number;
  setBoxOpacity: (opacity: number) => void;
  selectedShape?: ShapeType;
  setSelectedShape?: (shape: ShapeType) => void;
  // DM-only features
  isAdmin?: boolean;
  crawlers?: Crawler[];
  mobs?: Mob[];
  onAddCrawler?: (crawlerId: string) => void;
  onAddMob?: (mobId: string) => void;
  isAddCrawlerMode?: boolean;
  isAddMobMode?: boolean;
  setIsAddCrawlerMode?: (value: boolean) => void;
  setIsAddMobMode?: (value: boolean) => void;
  selectedCrawlerId?: string | null;
  selectedMobId?: string | null;
  setSelectedCrawlerId?: (id: string | null) => void;
  setSelectedMobId?: (id: string | null) => void;
  // DM Grid and Fog controls
  showGrid?: boolean;
  setShowGrid?: (value: boolean) => void;
  fogOfWarEnabled?: boolean;
  onToggleFogOfWar?: () => void;
  fogEraserActive?: boolean;
  setFogEraserActive?: (value: boolean) => void;
  fogBrushSize?: number;
  setFogBrushSize?: (size: number) => void;
  onClearFogOfWar?: () => void;
  // DM Episode/Map navigation
  episodeName?: string;
  currentMapIndex?: number;
  totalMaps?: number;
  mapScale?: number;
  onPreviousMap?: () => void;
  onNextMap?: () => void;
  onSelectMap?: () => void;
  onEndEpisode?: () => void;
  // Layout
  isNavVisible?: boolean;
}

const PING_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Pink", value: "#ec4899" },
];

const SHAPE_OPTIONS: { type: ShapeType; icon: React.ElementType; label: string }[] = [
  { type: "rectangle", icon: RectangleHorizontal, label: "Rectangle" },
  { type: "square", icon: Square, label: "Square" },
  { type: "circle", icon: Circle, label: "Circle" },
  { type: "triangle", icon: Triangle, label: "Triangle" },
];

export const MapToolsMenu: React.FC<MapToolsMenuProps> = ({
  onPing,
  onAddBox,
  isPingMode,
  isBoxMode,
  setIsPingMode,
  setIsBoxMode,
  selectedColor,
  setSelectedColor,
  boxOpacity,
  setBoxOpacity,
  selectedShape = "rectangle",
  setSelectedShape,
  isAdmin = false,
  crawlers = [],
  mobs = [],
  onAddCrawler,
  onAddMob,
  isAddCrawlerMode = false,
  isAddMobMode = false,
  setIsAddCrawlerMode,
  setIsAddMobMode,
  selectedCrawlerId,
  selectedMobId,
  setSelectedCrawlerId,
  setSelectedMobId,
  showGrid,
  setShowGrid,
  fogOfWarEnabled,
  onToggleFogOfWar,
  fogEraserActive,
  setFogEraserActive,
  fogBrushSize,
  setFogBrushSize,
  onClearFogOfWar,
  episodeName,
  currentMapIndex,
  totalMaps,
  mapScale,
  onPreviousMap,
  onNextMap,
  onSelectMap,
  onEndEpisode,
  isNavVisible = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);

  const clearAllModes = () => {
    setIsPingMode(false);
    setIsBoxMode(false);
    setIsAddCrawlerMode?.(false);
    setIsAddMobMode?.(false);
  };

  const handlePingModeToggle = () => {
    if (!isPingMode) {
      clearAllModes();
      // Auto-expand to show color options
      setIsExpanded(true);
    }
    setIsPingMode(!isPingMode);
  };

  const handleBoxModeToggle = () => {
    if (!isBoxMode) {
      clearAllModes();
      // Auto-expand to show color and opacity options
      setIsExpanded(true);
    }
    setIsBoxMode(!isBoxMode);
  };

  const handleAddCrawlerModeToggle = () => {
    if (!isAddCrawlerMode) {
      clearAllModes();
      // Auto-expand to show crawler selector
      setIsExpanded(true);
    }
    setIsAddCrawlerMode?.(!isAddCrawlerMode);
  };

  const handleAddMobModeToggle = () => {
    if (!isAddMobMode) {
      clearAllModes();
      // Auto-expand to show mob selector
      setIsExpanded(true);
    }
    setIsAddMobMode?.(!isAddMobMode);
  };

  return (
    <div
      className="fixed right-0 z-50 max-w-[100vw]"
      style={{
        top: isNavVisible ? '100px' : '0px',
        transition: 'top 0.2s ease',
      }}
    >
      <motion.div
        className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden m-2"
        initial={{ x: 10, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        {/* DM Episode/Map info row - only for admins */}
        {isAdmin && episodeName && (
          <div className="flex items-center justify-between gap-2 p-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-display text-accent text-sm text-glow-gold truncate max-w-[150px]" title={episodeName}>
                {episodeName}
              </span>
              <span className="text-xs text-muted-foreground">
                Map {(currentMapIndex ?? 0) + 1}/{totalMaps ?? 1} | {mapScale ?? 100}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(totalMaps ?? 1) > 1 && (
                <>
                  <DungeonButton variant="default" size="sm" onClick={onPreviousMap} title="Previous map">
                    <ChevronLeft className="w-4 h-4" />
                  </DungeonButton>
                  <DungeonButton variant="default" size="sm" onClick={onNextMap} title="Next map">
                    <ChevronRight className="w-4 h-4" />
                  </DungeonButton>
                </>
              )}
              <DungeonButton variant="default" size="sm" onClick={onSelectMap} title="Map selection">
                <Layers className="w-4 h-4" />
              </DungeonButton>
              <DungeonButton variant="danger" size="sm" onClick={onEndEpisode} title="End episode">
                <X className="w-4 h-4" />
              </DungeonButton>
            </div>
          </div>
        )}

        {/* Main buttons row */}
        <div className="flex items-center gap-2 p-2 flex-wrap">
          {/* Ping button - available to all users */}
          <DungeonButton
            variant={isPingMode ? "admin" : "default"}
            size="sm"
            onClick={handlePingModeToggle}
            title="Click map to ping (draw attention)"
          >
            <Target className="w-4 h-4 mr-1" />
            Ping
          </DungeonButton>

          {/* Shape button with dropdown - available to all users */}
          <div className="relative">
            <div className="flex">
              <DungeonButton
                variant={isBoxMode ? "admin" : "default"}
                size="sm"
                onClick={handleBoxModeToggle}
                title="Click map to add a shape"
                className="rounded-r-none border-r-0"
              >
                {(() => {
                  const ShapeIcon = SHAPE_OPTIONS.find(s => s.type === selectedShape)?.icon || Square;
                  return <ShapeIcon className="w-4 h-4 mr-1" />;
                })()}
                Shape
              </DungeonButton>
              <DungeonButton
                variant={isBoxMode ? "admin" : "default"}
                size="sm"
                onClick={() => setShowShapeDropdown(!showShapeDropdown)}
                title="Select shape type"
                className="rounded-l-none px-1"
              >
                <ChevronDown className="w-3 h-3" />
              </DungeonButton>
            </div>
            {/* Shape dropdown */}
            <AnimatePresence>
              {showShapeDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg z-50 min-w-[120px]"
                >
                  {SHAPE_OPTIONS.map((shape) => (
                    <button
                      key={shape.type}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        selectedShape === shape.type ? "bg-primary/20 text-primary" : ""
                      }`}
                      onClick={() => {
                        setSelectedShape?.(shape.type);
                        setShowShapeDropdown(false);
                        if (!isBoxMode) {
                          handleBoxModeToggle();
                        }
                      }}
                    >
                      <shape.icon className="w-4 h-4" />
                      {shape.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Add Crawler button - DM only */}
          {isAdmin && crawlers.length > 0 && (
            <DungeonButton
              variant={isAddCrawlerMode ? "admin" : "default"}
              size="sm"
              onClick={handleAddCrawlerModeToggle}
              title="Add crawler to map"
            >
              <User className="w-4 h-4 mr-1" />
              +Crawler
            </DungeonButton>
          )}

          {/* Add Mob button - DM only */}
          {isAdmin && mobs.length > 0 && (
            <DungeonButton
              variant={isAddMobMode ? "admin" : "default"}
              size="sm"
              onClick={handleAddMobModeToggle}
              title="Add mob to map"
            >
              <Skull className="w-4 h-4 mr-1" />
              +Mob
            </DungeonButton>
          )}

          {/* Grid toggle - DM only */}
          {isAdmin && setShowGrid && (
            <DungeonButton
              variant={showGrid ? "admin" : "default"}
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle grid"
            >
              <Grid3x3 className="w-4 h-4" />
            </DungeonButton>
          )}

          {/* Fog of War toggle - DM only */}
          {isAdmin && onToggleFogOfWar && (
            <DungeonButton
              variant={fogOfWarEnabled ? "admin" : "default"}
              size="sm"
              onClick={onToggleFogOfWar}
              title="Toggle Fog of War"
            >
              <CloudFog className="w-4 h-4" />
            </DungeonButton>
          )}

          {/* Fog Eraser - DM only, when fog is enabled */}
          {isAdmin && fogOfWarEnabled && setFogEraserActive && (
            <DungeonButton
              variant={fogEraserActive ? "admin" : "default"}
              size="sm"
              onClick={() => {
                const newValue = !fogEraserActive;
                setFogEraserActive(newValue);
                // Auto-expand to show brush size options when enabling eraser
                if (newValue) {
                  setIsExpanded(true);
                }
              }}
              title="Toggle Eraser Mode"
            >
              <Eraser className="w-4 h-4" />
            </DungeonButton>
          )}

          {/* Clear Fog - DM only, when fog is enabled */}
          {isAdmin && fogOfWarEnabled && onClearFogOfWar && (
            <DungeonButton
              variant="danger"
              size="sm"
              onClick={onClearFogOfWar}
              title="Reset fog (cover entire map)"
            >
              <Trash2 className="w-4 h-4" />
            </DungeonButton>
          )}

          {/* Color indicator */}
          <div
            className="w-6 h-6 rounded border-2 border-white shadow cursor-pointer"
            style={{ backgroundColor: selectedColor }}
            onClick={() => setIsExpanded(!isExpanded)}
            title="Click to change color"
          />

          {/* Expand toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Expanded options */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border overflow-hidden"
            >
              <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                {/* Color picker */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Color</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {PING_COLORS.map((color) => (
                      <button
                        key={color.value}
                        className={`w-8 h-8 rounded border-2 transition-all ${
                          selectedColor === color.value
                            ? "border-white scale-110 shadow-lg"
                            : "border-transparent hover:border-white/50"
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setSelectedColor(color.value)}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Opacity slider (for boxes) */}
                {isBoxMode && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Box Opacity</span>
                      <span className="text-xs text-muted-foreground">{Math.round(boxOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.1"
                      value={boxOpacity}
                      onChange={(e) => setBoxOpacity(parseFloat(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {/* Fog brush size slider (for DM when eraser is active) */}
                {isAdmin && fogOfWarEnabled && fogEraserActive && setFogBrushSize && fogBrushSize !== undefined && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Fog Brush Size</span>
                      <span className="text-xs text-muted-foreground">{fogBrushSize}</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      step="1"
                      value={fogBrushSize}
                      onChange={(e) => setFogBrushSize(Number(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {/* Crawler selector (only when in add crawler mode) */}
                {isAdmin && isAddCrawlerMode && crawlers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground">Select Crawler to Add</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {crawlers.map((crawler) => (
                        <button
                          key={crawler.id}
                          className={`p-2 text-xs rounded border transition-all flex items-center gap-2 ${
                            selectedCrawlerId === crawler.id
                              ? "border-blue-400 bg-blue-400/20"
                              : "border-border hover:border-blue-400/50"
                          }`}
                          onClick={() => setSelectedCrawlerId?.(crawler.id)}
                        >
                          {crawler.avatar ? (
                            <img src={crawler.avatar} alt={crawler.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-blue-400" />
                          )}
                          <span className="truncate">{crawler.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mob selector (only when in add mob mode) */}
                {isAdmin && isAddMobMode && mobs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Skull className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-muted-foreground">Select Mob to Add</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {mobs.map((mob) => (
                        <button
                          key={mob.id}
                          className={`p-2 text-xs rounded border transition-all flex items-center gap-2 ${
                            selectedMobId === mob.id
                              ? "border-destructive bg-destructive/20"
                              : "border-border hover:border-destructive/50"
                          }`}
                          onClick={() => setSelectedMobId?.(mob.id)}
                        >
                          {mob.image ? (
                            <img src={mob.image} alt={mob.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <Skull className="w-6 h-6 text-destructive" />
                          )}
                          <span className="truncate">{mob.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="text-xs text-muted-foreground">
                  {isPingMode && (
                    <p>Click anywhere on the map to ping that location. All users will see the ping.</p>
                  )}
                  {isBoxMode && (
                    <p>Click anywhere on the map to add a highlight box.</p>
                  )}
                  {isAddCrawlerMode && selectedCrawlerId && (
                    <p>Click anywhere on the map to place the selected crawler.</p>
                  )}
                  {isAddCrawlerMode && !selectedCrawlerId && (
                    <p>Select a crawler from the list above, then click on the map to place them.</p>
                  )}
                  {isAddMobMode && selectedMobId && (
                    <p>Click anywhere on the map to place the selected mob.</p>
                  )}
                  {isAddMobMode && !selectedMobId && (
                    <p>Select a mob from the list above, then click on the map to place it.</p>
                  )}
                  {!isPingMode && !isBoxMode && !isAddCrawlerMode && !isAddMobMode && (
                    <p>Select a tool mode, then click on the map.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default MapToolsMenu;
