import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Dices, ChevronUp, ChevronDown, Plus, X, Package } from "lucide-react";
import { getLootBoxTierColor } from "@/lib/gameData";
import { DiceRollEntry } from "@/hooks/useGameState";

const diceTypes = [
  { sides: 4, label: "D4" },
  { sides: 6, label: "D6" },
  { sides: 8, label: "D8" },
  { sides: 10, label: "D10" },
  { sides: 12, label: "D12" },
  { sides: 20, label: "D20" },
  { sides: 100, label: "D100" },
];

interface QueuedDice {
  id: string;
  sides: number;
  label: string;
}

interface DiceRollerProps {
  crawlerName?: string;
  crawlerId?: string;
  diceRolls: DiceRollEntry[];
  addDiceRoll: (entry: DiceRollEntry) => Promise<void>;
  onExpandedChange?: (expanded: boolean) => void;
}

const DiceRoller: React.FC<DiceRollerProps> = ({ crawlerName = "Unknown", crawlerId = "", diceRolls, addDiceRoll, onExpandedChange }) => {

  const [isExpanded, setIsExpandedRaw] = useState(false);
  const setIsExpanded = (v: boolean) => {
    setIsExpandedRaw(v);
    onExpandedChange?.(v);
  };
  const [showDiceOptions, setShowDiceOptions] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [diceQueue, setDiceQueue] = useState<QueuedDice[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const lastSeenRollId = useRef<string | null>(null);
  const addDiceRollRef = useRef(addDiceRoll);
  addDiceRollRef.current = addDiceRoll;

  // Watch for new rolls (including remote)
  useEffect(() => {
    if (diceRolls.length === 0) return;
    const newest = diceRolls[0];
    if (newest.id !== lastSeenRollId.current) {
      lastSeenRollId.current = newest.id;
    }
  }, [diceRolls]);

  const addDiceToQueue = (sides: number, label: string) => {
    const newDice: QueuedDice = {
      id: Date.now().toString() + Math.random(),
      sides,
      label,
    };
    setDiceQueue((prev) => [...prev, newDice]);
  };

  const removeDiceFromQueue = (id: string) => {
    setDiceQueue((prev) => prev.filter((d) => d.id !== id));
  };

  const rollAllDice = () => {
    if (diceQueue.length === 0) return;

    setIsRolling(true);
    let iterations = 0;
    const maxIterations = 10;

    const interval = setInterval(() => {
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);

        const finalResults = diceQueue.map((dice) => {
          const result = Math.floor(Math.random() * dice.sides) + 1;
          return { dice: dice.label, result };
        });

        if (finalResults.length > 0) {
          const entry: DiceRollEntry = {
            id: crypto.randomUUID(),
            crawlerName,
            crawlerId,
            timestamp: Date.now(),
            results: finalResults,
            total: finalResults.reduce((s, r) => s + r.result, 0),
          };

          lastSeenRollId.current = entry.id;
          addDiceRollRef.current(entry);
        }

        setIsRolling(false);
        setDiceQueue([]);
      }
    }, 50);
  };

  // Auto-scroll roll history to bottom when new rolls arrive or panel opens
  const rollHistoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rollHistoryRef.current) {
      rollHistoryRef.current.scrollTop = rollHistoryRef.current.scrollHeight;
    }
  }, [diceRolls.length, isExpanded]);

  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="fixed bottom-10 right-2 sm:right-4 z-[100] flex items-end gap-2">
      {/* Toggle tab - now to the left of the panel */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 font-display text-sm hover:bg-primary/90 transition-colors shadow-lg mb-0"
      >
        <Dices className="w-4 h-4" />
        DICE
        {diceQueue.length > 0 && (
          <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
            {diceQueue.length}
          </span>
        )}
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="bg-background border-2 border-primary p-4 w-[calc(100vw-1rem)] sm:w-72 shadow-lg shadow-primary/20 flex flex-col"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
            onWheel={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-primary text-glow-cyan text-lg mb-3 flex items-center gap-2 shrink-0">
              <Dices className="w-5 h-5" /> DICE ROLLER
            </h3>



            {/* Roll history - fills available space */}
            <div className="flex-1 min-h-0 flex flex-col mb-3">
              <span className="text-muted-foreground text-xs mb-2 block font-display shrink-0">ROLL HISTORY:</span>
              <div
                ref={rollHistoryRef}
                className="flex-1 min-h-0 space-y-2 overflow-y-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                <style>{`.dice-history::-webkit-scrollbar { display: none; }`}</style>
                {diceRolls.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No rolls yet</p>
                ) : (
                  [...diceRolls].reverse().map((entry) => (
                    <div key={entry.id} className="bg-muted/50 px-2 py-2 text-xs text-muted-foreground rounded">
                      {entry.lootBoxNotification ? (
                        // Loot box notification display
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 flex-shrink-0" style={{ color: getLootBoxTierColor(entry.lootBoxNotification.tier as 'Dirt' | 'Copper' | 'Silver' | 'Gold') }} />
                          <div>
                            <span className="font-display" style={{ color: getLootBoxTierColor(entry.lootBoxNotification.tier as 'Dirt' | 'Copper' | 'Silver' | 'Gold') }}>
                              {entry.lootBoxNotification.boxName}
                            </span>
                            <span className="text-muted-foreground"> sent to </span>
                            <span className="text-primary">{entry.lootBoxNotification.recipientNames.join(', ')}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 ml-auto">{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      ) : (
                        // Regular dice roll display
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display text-primary">{entry.crawlerName}</span>
                              <span className="text-[10px] text-muted-foreground/60">{formatTimestamp(entry.timestamp)}</span>
                              {entry.statRoll ? (
                                <span className="text-xs">
                                  {entry.statRoll.stat} Check: d20({entry.statRoll.rawRoll}) {entry.statRoll.modifier >= 0 ? '+' : ''}{entry.statRoll.modifier} = <span className="font-bold text-primary">{entry.total}</span>
                                </span>
                              ) : (
                                <span className="text-xs">{entry.results.map(r => r.dice).join(', ')} — Total: <span className="font-bold text-primary">{entry.total}</span></span>
                              )}
                            </div>
                            <button
                              onClick={() => setExpandedIds((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                              className="text-xs px-2 py-1"
                            >
                              {expandedIds[entry.id] ? '▾' : '▸'}
                            </button>
                          </div>
                          {expandedIds[entry.id] && (
                            <div className="mt-2 text-xs">
                              {entry.results.map((r, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <div>{r.dice}</div>
                                  <div className="font-bold text-primary">{r.result}</div>
                                </div>
                              ))}
                              {entry.statRoll && (
                                <div className="flex items-center justify-between border-t border-border/50 mt-1 pt-1">
                                  <div>{entry.statRoll.stat} modifier</div>
                                  <div className="font-bold text-accent">{entry.statRoll.modifier >= 0 ? '+' : ''}{entry.statRoll.modifier}</div>
                                </div>
                              )}
                            </div>
                          )}
                          {entry.results.length === 1 && entry.results[0].dice === "D20" && entry.results[0].result === 20 && (
                            <span className="text-accent text-xs font-display">CRITICAL HIT!</span>
                          )}
                          {entry.results.length === 1 && entry.results[0].dice === "D20" && entry.results[0].result === 1 && (
                            <span className="text-destructive text-xs font-display">CRITICAL FAIL!</span>
                          )}
                          {entry.statRoll && entry.statRoll.rawRoll === 20 && (
                            <span className="text-accent text-xs font-display">NAT 20!</span>
                          )}
                          {entry.statRoll && entry.statRoll.rawRoll === 1 && (
                            <span className="text-destructive text-xs font-display">NAT 1!</span>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Queued dice */}
            {diceQueue.length > 0 && (
              <div className="mb-3 border border-border bg-muted/20 p-2 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">QUEUED DICE:</span>
                  <button
                    onClick={() => setDiceQueue([])}
                    className="text-xs text-destructive hover:text-destructive/80"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {diceQueue.map((dice) => (
                    <span
                      key={dice.id}
                      className="text-xs bg-primary/20 text-primary px-2 py-1 flex items-center gap-1"
                    >
                      {dice.label}
                      <button
                        onClick={() => removeDiceFromQueue(dice.id)}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible dice options */}
            <div className="shrink-0">
              <button
                onClick={() => setShowDiceOptions(!showDiceOptions)}
                className="flex items-center justify-between w-full text-xs text-muted-foreground font-display mb-2 hover:text-primary transition-colors"
              >
                <span>DICE OPTIONS</span>
                {showDiceOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showDiceOptions && (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                    {diceTypes.map((dice) => (
                      <button
                        key={dice.sides}
                        onClick={() => addDiceToQueue(dice.sides, dice.label)}
                        disabled={isRolling}
                        className={`border border-primary bg-primary/10 hover:bg-primary/30 text-primary py-2 px-1 text-sm font-display transition-colors ${
                          isRolling ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <Plus className="w-3 h-3 mx-auto mb-1" />
                        {dice.label}
                      </button>
                    ))}
                  </div>

                  <DungeonButton
                    variant="admin"
                    className="w-full"
                    onClick={rollAllDice}
                    disabled={diceQueue.length === 0 || isRolling}
                  >
                    <Dices className="w-4 h-4 mr-2" />
                    Roll {diceQueue.length} Dice
                  </DungeonButton>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DiceRoller;
