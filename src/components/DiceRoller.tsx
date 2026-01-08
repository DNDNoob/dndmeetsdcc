import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { Dices, ChevronUp, ChevronDown } from "lucide-react";

const diceTypes = [
  { sides: 4, label: "D4" },
  { sides: 6, label: "D6" },
  { sides: 8, label: "D8" },
  { sides: 10, label: "D10" },
  { sides: 12, label: "D12" },
  { sides: 20, label: "D20" },
  { sides: 100, label: "D100" },
];

interface RollResult {
  dice: string;
  result: number;
  timestamp: number;
}

const DiceRoller: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rollHistory, setRollHistory] = useState<RollResult[]>([]);
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const rollDice = (sides: number, label: string) => {
    setIsRolling(true);
    
    // Animate through random numbers
    let iterations = 0;
    const maxIterations = 10;
    const interval = setInterval(() => {
      setCurrentRoll({
        dice: label,
        result: Math.floor(Math.random() * sides) + 1,
        timestamp: Date.now(),
      });
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        const finalResult = Math.floor(Math.random() * sides) + 1;
        const roll: RollResult = {
          dice: label,
          result: finalResult,
          timestamp: Date.now(),
        };
        setCurrentRoll(roll);
        setRollHistory((prev) => [roll, ...prev.slice(0, 9)]);
        setIsRolling(false);
      }
    }, 50);
  };

  return (
    <div className="fixed bottom-14 right-4 z-50">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-background border-2 border-primary p-4 mb-2 w-72 shadow-lg shadow-primary/20"
          >
            <h3 className="font-display text-primary text-glow-cyan text-lg mb-4 flex items-center gap-2">
              <Dices className="w-5 h-5" /> DICE ROLLER
            </h3>

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
                <span className="text-muted-foreground">Roll a dice!</span>
              )}
            </div>

            {/* Dice buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {diceTypes.map((dice) => (
                <button
                  key={dice.sides}
                  onClick={() => rollDice(dice.sides, dice.label)}
                  disabled={isRolling}
                  className={`border border-primary bg-primary/10 hover:bg-primary/30 text-primary py-2 px-1 text-sm font-display transition-colors ${
                    isRolling ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {dice.label}
                </button>
              ))}
            </div>

            {/* Roll history */}
            {rollHistory.length > 0 && (
              <div className="border-t border-border pt-3">
                <span className="text-muted-foreground text-xs mb-2 block">Recent rolls:</span>
                <div className="flex flex-wrap gap-1">
                  {rollHistory.slice(0, 8).map((roll, i) => (
                    <span
                      key={roll.timestamp + i}
                      className="text-xs bg-muted px-2 py-1 text-muted-foreground"
                    >
                      {roll.dice}: {roll.result}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default DiceRoller;
