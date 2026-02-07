import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronUp, ChevronDown, RotateCcw, Sun, Moon } from "lucide-react";
import { type Crawler, type NoncombatTurnState, type GameClockState } from "@/lib/gameData";

interface PingPanelProps {
  isAdmin?: boolean;
  noncombatTurnState?: NoncombatTurnState | null;
  onStartNoncombatTurn?: () => Promise<void>;
  crawlers?: Crawler[];
  gameClockState?: GameClockState | null;
  onPerformShortRest?: (crawlerIds: string[]) => Promise<void>;
  onPerformLongRest?: (crawlerIds: string[]) => Promise<void>;
}

const PingPanel: React.FC<PingPanelProps> = ({
  isAdmin,
  noncombatTurnState,
  onStartNoncombatTurn,
  crawlers,
  gameClockState,
  onPerformShortRest,
  onPerformLongRest,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRestDropdown, setShowRestDropdown] = useState<'short' | 'long' | null>(null);
  const [selectedCrawlersForRest, setSelectedCrawlersForRest] = useState<Record<string, boolean>>({});

  const openRestDropdown = (type: 'short' | 'long') => {
    const playerCrawlers = (crawlers ?? []).filter(c => c.id !== 'dungeonai');
    const selected: Record<string, boolean> = {};
    playerCrawlers.forEach(c => { selected[c.id] = true; });
    setSelectedCrawlersForRest(selected);
    setShowRestDropdown(type);
  };

  const handleConfirmRest = async () => {
    const selectedIds = Object.entries(selectedCrawlersForRest)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
    if (selectedIds.length === 0) return;

    if (showRestDropdown === 'short' && onPerformShortRest) {
      await onPerformShortRest(selectedIds);
    } else if (showRestDropdown === 'long' && onPerformLongRest) {
      await onPerformLongRest(selectedIds);
    }
    setShowRestDropdown(null);
  };

  const playerCrawlers = (crawlers ?? []).filter(c => c.id !== 'dungeonai');
  const allPlayersSpent = noncombatTurnState != null && playerCrawlers.length > 0 && playerCrawlers.every(c => {
    const used = noncombatTurnState.rollsUsed[c.id] ?? 0;
    return used >= noncombatTurnState.maxRolls;
  });
  const turnNumber = noncombatTurnState?.turnNumber ?? 0;

  // Only show if there's something to display
  const hasContent = gameClockState || isAdmin;
  if (!hasContent) return null;

  return (
    <div className="fixed bottom-4 left-2 sm:left-4 z-[99] flex items-end gap-2">
      {/* Toggle tab */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 font-display text-sm hover:bg-accent/90 transition-colors shadow-lg"
      >
        <Clock className="w-4 h-4" />
        {gameClockState ? (
          <span className="text-xs">
            {new Date(gameClockState.gameTime).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
        ) : (
          'GAME'
        )}
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            className="bg-background border-2 border-accent p-4 w-[calc(100vw-1rem)] sm:w-72 shadow-lg shadow-accent/20 max-h-[60vh] overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-accent text-lg mb-3 flex items-center gap-2 shrink-0">
              <Clock className="w-5 h-5" /> GAME PANEL
            </h3>

            {/* Game Clock */}
            {gameClockState && (
              <div className="mb-3 text-center border border-border bg-muted/20 px-3 py-2">
                <span className="text-[10px] text-muted-foreground font-display block mb-0.5">GAME TIME</span>
                <span className="font-display text-primary text-sm">
                  {new Date(gameClockState.gameTime).toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
            )}

            {/* DM Noncombat Turn Button */}
            {isAdmin && onStartNoncombatTurn && (
              <div className="mb-3">
                <button
                  onClick={onStartNoncombatTurn}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-display text-sm border-2 rounded transition-all ${
                    allPlayersSpent
                      ? 'bg-accent/20 border-accent text-accent animate-pulse hover:bg-accent/30'
                      : 'bg-muted/30 border-border text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  {turnNumber === 0 ? 'START NONCOMBAT TURN' : 'NEW NONCOMBAT TURN'}
                </button>
                {noncombatTurnState && playerCrawlers.length > 0 && (
                  <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                    {playerCrawlers.map(c => {
                      const used = noncombatTurnState.rollsUsed[c.id] ?? 0;
                      const remaining = Math.max(0, noncombatTurnState.maxRolls - used);
                      return (
                        <div key={c.id} className="flex justify-between">
                          <span>{c.name}</span>
                          <span className={remaining === 0 ? 'text-destructive' : 'text-primary'}>
                            {used}/{noncombatTurnState.maxRolls} used
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* DM Rest Buttons */}
            {isAdmin && (onPerformShortRest || onPerformLongRest) && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {onPerformShortRest && (
                    <button
                      onClick={() => showRestDropdown === 'short' ? setShowRestDropdown(null) : openRestDropdown('short')}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 font-display text-xs border-2 rounded transition-all ${
                        showRestDropdown === 'short'
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-muted/30 border-border text-muted-foreground hover:border-primary hover:text-primary'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      SHORT REST
                    </button>
                  )}
                  {onPerformLongRest && (
                    <button
                      onClick={() => showRestDropdown === 'long' ? setShowRestDropdown(null) : openRestDropdown('long')}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 font-display text-xs border-2 rounded transition-all ${
                        showRestDropdown === 'long'
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-muted/30 border-border text-muted-foreground hover:border-accent hover:text-accent'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      LONG REST
                    </button>
                  )}
                </div>

                {showRestDropdown && (
                  <div className="border border-border bg-muted/30 p-3 rounded space-y-2">
                    <span className="text-xs text-muted-foreground font-display block">
                      {showRestDropdown === 'short' ? 'SHORT REST (+4 hrs, half HP/Mana)' : 'LONG REST (+8 hrs, full HP/Mana)'}
                    </span>
                    <div className="space-y-1">
                      {playerCrawlers.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCrawlersForRest[c.id] ?? false}
                            onChange={(e) => setSelectedCrawlersForRest(prev => ({
                              ...prev,
                              [c.id]: e.target.checked,
                            }))}
                            className="w-4 h-4"
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleConfirmRest}
                        className="flex-1 bg-primary text-primary-foreground font-display text-xs py-1.5 rounded hover:bg-primary/90 transition-colors"
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => setShowRestDropdown(null)}
                        className="flex-1 bg-muted text-muted-foreground font-display text-xs py-1.5 rounded hover:bg-muted/80 transition-colors"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PingPanel;
