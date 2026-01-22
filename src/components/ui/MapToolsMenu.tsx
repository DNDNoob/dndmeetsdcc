import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Target, Square, ChevronDown, ChevronUp, Palette, User, Skull, Plus } from "lucide-react";
import { Crawler, Mob } from "@/lib/gameData";

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
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const clearAllModes = () => {
    setIsPingMode(false);
    setIsBoxMode(false);
    setIsAddCrawlerMode?.(false);
    setIsAddMobMode?.(false);
  };

  const handlePingModeToggle = () => {
    if (!isPingMode) {
      clearAllModes();
    }
    setIsPingMode(!isPingMode);
  };

  const handleBoxModeToggle = () => {
    if (!isBoxMode) {
      clearAllModes();
    }
    setIsBoxMode(!isBoxMode);
  };

  const handleAddCrawlerModeToggle = () => {
    if (!isAddCrawlerMode) {
      clearAllModes();
    }
    setIsAddCrawlerMode?.(!isAddCrawlerMode);
  };

  const handleAddMobModeToggle = () => {
    if (!isAddMobMode) {
      clearAllModes();
    }
    setIsAddMobMode?.(!isAddMobMode);
  };

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        className="bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        {/* Main buttons row */}
        <div className="flex items-center gap-2 p-2">
          {/* Ping button */}
          <DungeonButton
            variant={isPingMode ? "admin" : "default"}
            size="sm"
            onClick={handlePingModeToggle}
            title="Click map to ping (draw attention)"
          >
            <Target className="w-4 h-4 mr-1" />
            Ping
          </DungeonButton>

          {/* Box button - DM only */}
          {isAdmin && (
            <DungeonButton
              variant={isBoxMode ? "admin" : "default"}
              size="sm"
              onClick={handleBoxModeToggle}
              title="Click map to add a highlight box"
            >
              <Square className="w-4 h-4 mr-1" />
              Box
            </DungeonButton>
          )}

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

                {/* Opacity slider (only for boxes) */}
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
                    <p>Click anywhere on the map to add a highlight box. Drag handles to move, resize, or rotate.</p>
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
