import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronUp, ChevronDown, RotateCcw, Sun, Moon, Swords, Zap, SkipForward, XCircle, Heart } from "lucide-react";
import { type Crawler, type Mob, type NoncombatTurnState, type GameClockState, type Episode, type CombatState } from "@/lib/gameData";

interface PingPanelProps {
  isAdmin?: boolean;
  noncombatTurnState?: NoncombatTurnState | null;
  onStartNoncombatTurn?: () => Promise<void>;
  crawlers?: Crawler[];
  mobs?: Mob[];
  gameClockState?: GameClockState | null;
  onPerformShortRest?: (crawlerIds: string[]) => Promise<void>;
  onPerformLongRest?: (crawlerIds: string[]) => Promise<void>;
  activeEpisode?: Episode | null;
  combatState?: CombatState | null;
  onStartCombat?: (crawlerIds: string[], mobIds: string[]) => Promise<void>;
  onRollMobInitiatives?: () => Promise<void>;
  onConfirmInitiative?: () => Promise<void>;
  onAdvanceCombatTurn?: () => Promise<void>;
  onEndCombat?: () => Promise<void>;
  onOverrideMobHealth?: (mobId: string, newHP: number) => Promise<void>;
  onRemoveCombatant?: (combatantId: string) => Promise<void>;
}

const PingPanel: React.FC<PingPanelProps> = ({
  isAdmin,
  noncombatTurnState,
  onStartNoncombatTurn,
  crawlers,
  mobs,
  gameClockState,
  onPerformShortRest,
  onPerformLongRest,
  activeEpisode,
  combatState,
  onStartCombat,
  onRollMobInitiatives,
  onConfirmInitiative,
  onAdvanceCombatTurn,
  onEndCombat,
  onOverrideMobHealth,
  onRemoveCombatant,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRestDropdown, setShowRestDropdown] = useState<'short' | 'long' | null>(null);
  const [selectedCrawlersForRest, setSelectedCrawlersForRest] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  // Combat UI state
  const [showCombatSetup, setShowCombatSetup] = useState(false);
  const [selectedCombatCrawlers, setSelectedCombatCrawlers] = useState<Record<string, boolean>>({});
  const [selectedCombatMobs, setSelectedCombatMobs] = useState<Record<string, boolean>>({});
  const [showMobHealthOverride, setShowMobHealthOverride] = useState<string | null>(null);
  const [mobHealthValue, setMobHealthValue] = useState('');

  // Click outside to minimize
  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setShowRestDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const openRestDropdown = (type: 'short' | 'long') => {
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

  // Filter to only crawlers loaded in the active episode
  const episodeCrawlerIds = activeEpisode?.crawlerPlacements
    ? [...new Set(activeEpisode.crawlerPlacements.map(p => p.crawlerId))]
    : null;
  const playerCrawlers = (crawlers ?? []).filter(c => {
    if (c.id === 'dungeonai') return false;
    if (episodeCrawlerIds) return episodeCrawlerIds.includes(c.id);
    return true;
  });

  // Get mobs on the current episode map
  const episodeMobIds = activeEpisode?.mobPlacements
    ? [...new Set(activeEpisode.mobPlacements.map(p => p.mobId))]
    : [];
  const episodeMobs = (mobs ?? []).filter(m => episodeMobIds.includes(m.id) && !m.hidden);

  const allPlayersSpent = noncombatTurnState != null && playerCrawlers.length > 0 && playerCrawlers.every(c => {
    const used = noncombatTurnState.rollsUsed[c.id] ?? 0;
    return used >= noncombatTurnState.maxRolls;
  });
  const turnNumber = noncombatTurnState?.turnNumber ?? 0;

  const isCombatActive = combatState?.active && combatState.phase !== 'ended';
  const isInitiativePhase = combatState?.active && combatState.phase === 'initiative';
  const isCombatPhase = combatState?.active && combatState.phase === 'combat';

  // Open combat setup with all mobs/crawlers pre-selected
  const openCombatSetup = () => {
    const crawlerSel: Record<string, boolean> = {};
    playerCrawlers.forEach(c => { crawlerSel[c.id] = true; });
    setSelectedCombatCrawlers(crawlerSel);

    const mobSel: Record<string, boolean> = {};
    episodeMobs.forEach(m => { mobSel[m.id] = true; });
    setSelectedCombatMobs(mobSel);

    setShowCombatSetup(true);
  };

  const handleStartCombat = async () => {
    const crawlerIds = Object.entries(selectedCombatCrawlers)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
    const mobIds = Object.entries(selectedCombatMobs)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
    if (crawlerIds.length === 0 && mobIds.length === 0) return;

    await onStartCombat?.(crawlerIds, mobIds);
    // Roll mob initiatives automatically
    await onRollMobInitiatives?.();
    setShowCombatSetup(false);
  };

  const handleConfirmInitiative = async () => {
    await onConfirmInitiative?.();
  };

  const handleMobHealthOverride = async (mobId: string) => {
    const hp = parseInt(mobHealthValue);
    if (isNaN(hp) || hp < 0) return;
    await onOverrideMobHealth?.(mobId, hp);
    setShowMobHealthOverride(null);
    setMobHealthValue('');
  };

  // Only show if there's something to display
  const hasContent = gameClockState || isAdmin || isCombatActive;
  if (!hasContent) return null;

  // Calculate days since episode start
  const daysSinceStart = (() => {
    if (!gameClockState || !activeEpisode?.startingGameTime) return null;
    const diffMs = gameClockState.gameTime - activeEpisode.startingGameTime;
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  })();

  return (
    <div ref={panelRef} className="fixed bottom-4 left-2 sm:left-4 z-[99] flex flex-col items-start">
      {/* Expanded panel - appears above the toggle button */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-background border-2 border-accent p-4 w-[calc(100vw-1rem)] sm:w-80 shadow-lg shadow-accent/20 mb-2 max-h-[70vh] overflow-y-auto"
          >
            <h3 className="font-display text-accent text-lg mb-3 flex items-center gap-2 shrink-0">
              <Clock className="w-5 h-5" /> GAME CLOCK
            </h3>

            {/* Game Clock */}
            {gameClockState && (
              <div className="mb-3 text-center border border-border bg-muted/20 px-3 py-2">
                <span className="font-display text-primary text-sm whitespace-nowrap">
                  {new Date(gameClockState.gameTime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
            )}

            {/* Days Since Episode Start */}
            {daysSinceStart !== null && (
              <div className="mb-3 text-center border border-border bg-muted/20 px-3 py-2">
                <span className="text-[10px] text-muted-foreground font-display block mb-0.5">DAYS SINCE START</span>
                <span className="font-display text-accent text-lg">{daysSinceStart}</span>
              </div>
            )}

            {/* Noncombat Turn Info - visible to all players */}
            {noncombatTurnState && playerCrawlers.length > 0 && !isCombatActive && (
              <div className="mb-3">
                <div className="text-center mb-2">
                  <span className="text-[10px] text-muted-foreground font-display">TURN {noncombatTurnState.turnNumber}</span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
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
              </div>
            )}

            {/* DM Noncombat Turn Button */}
            {isAdmin && onStartNoncombatTurn && !isCombatActive && (
              <div className="mb-3">
                <button
                  onClick={() => onStartNoncombatTurn()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-display text-sm border-2 rounded transition-all ${
                    allPlayersSpent
                      ? 'bg-accent/20 border-accent text-accent animate-pulse hover:bg-accent/30'
                      : 'bg-muted/30 border-border text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  {turnNumber === 0 ? 'START NONCOMBAT TURN' : 'NEW NONCOMBAT TURN'}
                </button>
              </div>
            )}

            {/* ═══════════ COMBAT CONTROLS ═══════════ */}

            {/* DM: Start Combat Button (when no combat is active) */}
            {isAdmin && !isCombatActive && onStartCombat && (
              <div className="mb-3">
                <button
                  onClick={() => showCombatSetup ? setShowCombatSetup(false) : openCombatSetup()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 font-display text-sm border-2 rounded transition-all bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                >
                  <Swords className="w-4 h-4" />
                  COMBAT TURN
                </button>
              </div>
            )}

            {/* DM: Combat Setup - Select combatants */}
            {isAdmin && showCombatSetup && !isCombatActive && (
              <div className="mb-3 border border-destructive/50 bg-destructive/5 p-3 rounded space-y-3">
                <span className="text-xs text-destructive font-display block">ROLL FOR INITIATIVE</span>
                <p className="text-[10px] text-muted-foreground">Select combatants for this encounter:</p>

                {/* Crawlers */}
                {playerCrawlers.length > 0 && (
                  <div>
                    <span className="text-[10px] text-primary font-display block mb-1">CRAWLERS</span>
                    <div className="space-y-1">
                      {playerCrawlers.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCombatCrawlers[c.id] ?? false}
                            onChange={(e) => setSelectedCombatCrawlers(prev => ({
                              ...prev,
                              [c.id]: e.target.checked,
                            }))}
                            className="w-4 h-4"
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobs */}
                {episodeMobs.length > 0 && (
                  <div>
                    <span className="text-[10px] text-destructive font-display block mb-1">MOBS</span>
                    <div className="space-y-1">
                      {episodeMobs.map(m => (
                        <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCombatMobs[m.id] ?? false}
                            onChange={(e) => setSelectedCombatMobs(prev => ({
                              ...prev,
                              [m.id]: e.target.checked,
                            }))}
                            className="w-4 h-4"
                          />
                          <span>{m.name}</span>
                          {m.hitPoints != null && (
                            <span className="text-muted-foreground">({m.hitPoints} HP)</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleStartCombat}
                    className="flex-1 bg-destructive text-destructive-foreground font-display text-xs py-1.5 rounded hover:bg-destructive/90 transition-colors"
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={() => setShowCombatSetup(false)}
                    className="flex-1 bg-muted text-muted-foreground font-display text-xs py-1.5 rounded hover:bg-muted/80 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* Initiative Phase - Waiting for players */}
            {isInitiativePhase && combatState && (
              <div className="mb-3 border border-destructive/50 bg-destructive/5 p-3 rounded space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent animate-pulse" />
                  <span className="text-xs text-accent font-display">ROLLING INITIATIVE</span>
                </div>
                <div className="space-y-1">
                  {combatState.combatants.map(c => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span className={c.type === 'crawler' ? 'text-primary' : 'text-destructive'}>{c.name}</span>
                      {c.hasRolledInitiative ? (
                        <span className="text-accent font-bold">{c.initiative}</span>
                      ) : (
                        <span className="text-muted-foreground animate-pulse">Waiting...</span>
                      )}
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    onClick={handleConfirmInitiative}
                    disabled={!combatState.combatants.every(c => c.hasRolledInitiative)}
                    className={`w-full font-display text-xs py-2 rounded transition-colors ${
                      combatState.combatants.every(c => c.hasRolledInitiative)
                        ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    START COMBAT
                  </button>
                )}
              </div>
            )}

            {/* Combat Phase - Turn management */}
            {isCombatPhase && combatState && (
              <div className="mb-3 border border-destructive/50 bg-destructive/5 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-destructive" />
                    <span className="text-xs text-destructive font-display">COMBAT ROUND {combatState.combatRound}</span>
                  </div>
                </div>

                {/* Turn order list */}
                <div className="space-y-1">
                  {combatState.combatants.map((c, i) => {
                    const isCurrent = i === combatState.currentTurnIndex;
                    const mob = c.type === 'mob' ? (mobs ?? []).find(m => m.id === c.id) : null;
                    return (
                      <div key={c.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                        isCurrent ? 'bg-accent/20 border border-accent/50' : ''
                      }`}>
                        <div className="flex items-center gap-2">
                          {isCurrent && <span className="text-accent">▶</span>}
                          <span className={c.type === 'crawler' ? 'text-primary' : 'text-destructive'}>
                            {c.name}
                          </span>
                          <span className="text-muted-foreground">({c.initiative})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Mob HP display with override */}
                          {c.type === 'mob' && mob && (
                            <>
                              {showMobHealthOverride === c.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={mobHealthValue}
                                    onChange={(e) => setMobHealthValue(e.target.value)}
                                    className="w-12 bg-muted border border-border px-1 py-0.5 text-xs rounded"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleMobHealthOverride(c.id);
                                      if (e.key === 'Escape') setShowMobHealthOverride(null);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleMobHealthOverride(c.id)}
                                    className="text-[10px] text-primary hover:underline"
                                  >OK</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (isAdmin) {
                                      setShowMobHealthOverride(c.id);
                                      setMobHealthValue(String(mob.hitPoints ?? 0));
                                    }
                                  }}
                                  className="text-destructive/80 hover:text-destructive text-[10px] flex items-center gap-0.5"
                                  title={isAdmin ? "Click to override HP" : undefined}
                                >
                                  <Heart className="w-3 h-3" />
                                  {mob.hitPoints ?? '?'}
                                </button>
                              )}
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => onRemoveCombatant?.(c.id)}
                              className="text-muted-foreground hover:text-destructive ml-1"
                              title="Remove from combat"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DM: Advance turn and end combat */}
                {isAdmin && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onAdvanceCombatTurn?.()}
                      className="flex-1 flex items-center justify-center gap-1 bg-accent text-accent-foreground font-display text-xs py-2 rounded hover:bg-accent/90 transition-colors"
                    >
                      <SkipForward className="w-3 h-3" />
                      NEXT TURN
                    </button>
                    <button
                      onClick={() => onEndCombat?.()}
                      className="flex-1 flex items-center justify-center gap-1 bg-muted text-muted-foreground font-display text-xs py-2 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
                    >
                      <XCircle className="w-3 h-3" />
                      END COMBAT
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DM Rest Buttons - only show outside combat */}
            {isAdmin && !isCombatActive && (onPerformShortRest || onPerformLongRest) && (
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

      {/* Toggle tab */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-4 py-2 font-display text-sm transition-colors shadow-lg ${
          isCombatActive
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-accent text-accent-foreground hover:bg-accent/90'
        }`}
      >
        {isCombatActive ? <Swords className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        {isCombatActive ? (
          <span className="text-xs">COMBAT R{combatState?.combatRound ?? 1}</span>
        ) : gameClockState ? (
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
    </div>
  );
};

export default PingPanel;
