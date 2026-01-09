import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Dices, ChevronUp, ChevronDown, Plus, X } from "lucide-react";

const diceTypes = [
  { sides: 4, label: "D4" },
  { sides: 6, label: "D6" },
  { sides: 8, label: "D8" },
  { sides: 10, label: "D10" },
  { sides: 12, label: "D12" },
  { sides: 20, label: "D20" },
  { sides: 100, label: "D100" },
];

interface RollEntry {
  id: string;
  crawlerName: string;
  timestamp: number;
  results: { dice: string; result: number }[];
  total: number;
}

interface QueuedDice {
  id: string;
  sides: number;
  label: string;
}

const DiceRoller: React.FC<{ crawlerName?: string }> = ({ crawlerName = "Unknown" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rollHistory, setRollHistory] = useState<RollEntry[]>([]);
  const [currentRoll, setCurrentRoll] = useState<{ dice: string; result: number; timestamp: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [diceQueue, setDiceQueue] = useState<QueuedDice[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

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
      const randomResults = diceQueue.map((dice) => ({
        dice: dice.label,
        result: Math.floor(Math.random() * dice.sides) + 1,
        timestamp: Date.now(),
        crawlerName,
      }));

      if (randomResults.length > 0) {
        setCurrentRoll(randomResults[0]);
      }

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);

        const finalResults = diceQueue.map((dice) => {
          const result = Math.floor(Math.random() * dice.sides) + 1;
          return {
            dice: dice.label,
            result,
          };
        });

        if (finalResults.length > 0) {
          // show first result prominently
          setCurrentRoll({ dice: finalResults[0].dice, result: finalResults[0].result, timestamp: Date.now() });

          // Create grouped entry for this roll
          const entry = {
            id: Date.now().toString() + Math.random(),
            crawlerName,
            timestamp: Date.now(),
            results: finalResults,
            total: finalResults.reduce((s, r) => s + r.result, 0),
          };

          setRollHistory((prev) => [entry, ...prev].slice(0, 50));
        }

        setIsRolling(false);
        setDiceQueue([]);
      }
    }, 50);
  };

  const total = diceQueue.length > 0 ? diceQueue.reduce((sum, d) => sum + d.sides, 0) : 0;

  return (
    <div className="fixed bottom-14 right-4 z-50">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-background border-2 border-primary p-4 mb-2 w-72 shadow-lg shadow-primary/20 max-h-[calc(100vh-6rem)] overflow-y-auto flex flex-col"
          >
              <div className="flex-1 overflow-y-auto pr-2">
              <h3 className="font-display text-primary text-glow-cyan text-lg mb-4 flex items-center gap-2">
                <Dices className="w-5 h-5" /> DICE ROLLER
              </h3>

              {/* Roll history (top) */}
              {rollHistory.length > 0 && (
                <div className="border-b border-border pb-3 mb-3">
                  <span className="text-muted-foreground text-xs mb-2 block font-display">ROLL HISTORY:</span>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {rollHistory.map((entry) => (
                      <div key={entry.id} className="bg-muted/50 px-2 py-2 text-xs text-muted-foreground rounded">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-primary">{entry.crawlerName}</span>
                            <span className="text-xs text-muted-foreground">{entry.results.map(r => r.dice).join(', ')} — Total: <span className="font-bold text-primary">{entry.total}</span></span>
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
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current roll display */}
              <div className="bg-muted/50 border border-border p-4 mb-4 text-center min-h-[80px] flex flex-col items-center justify-center">
                {currentRoll ? (
                  <>
                    <span className="text-muted-foreground text-sm">{currentRoll.dice}</span>
                    <motion.span
                      key={currentRoll.timestamp}
                      initial={{ scale: 1.5 }}
                      animate={{ scale: 1 }}
                      className={`font-display text-4xl ${
                        currentRoll.result === 20 && currentRoll.dice === "D20"
                          ? "text-accent text-glow-gold"
                          : currentRoll.result === 1 && currentRoll.dice === "D20"
                          ? "text-destructive"
                          : "text-primary text-glow-cyan"
                      }`}
                    >
                      {currentRoll.result}
                    </motion.span>
                    {currentRoll.dice === "D20" && currentRoll.result === 20 && !isRolling && (
                      <span className="text-accent text-xs mt-1">CRITICAL HIT!</span>
                    )}
                    {currentRoll.dice === "D20" && currentRoll.result === 1 && !isRolling && (
                      <span className="text-destructive text-xs mt-1">CRITICAL FAIL!</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">Configure dice to roll!</span>
                )}
              </div>

              {/* Queued dice */}
              {diceQueue.length > 0 && (
                <div className="mb-3 border border-border bg-muted/20 p-2">
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
            </div>

            {/* Dice buttons */}
            <div className="mt-2">
              <div className="grid grid-cols-4 gap-2 mb-3">
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

              {/* Roll button */}
              <DungeonButton
                variant="admin"
                className="w-full"
                onClick={rollAllDice}
                disabled={diceQueue.length === 0 || isRolling}
              >
                <Dices className="w-4 h-4 mr-2" />
                Roll {diceQueue.length} Dice
              </DungeonButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle tab */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 font-display text-sm hover:bg-primary/90 transition-colors shadow-lg"
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
    </div>
  );
};

export default DiceRoller;
