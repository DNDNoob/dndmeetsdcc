import { useState, useRef, useEffect } from "react";
import { Mob } from "@/lib/gameData";
import { ChevronUp, ChevronDown } from "lucide-react";

interface ResizableMobDisplayProps {
  mob: Mob;
  onClose: () => void;
  index?: number;
  isDiceExpanded?: boolean;
  isAdmin?: boolean;
}

export const ResizableMobDisplay: React.FC<ResizableMobDisplayProps> = ({
  mob,
  onClose,
  index = 0,
  isDiceExpanded = false,
  isAdmin = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dice button is ~100px wide at right-4 (16px). Panel is w-72 (288px) + gap.
  const diceButtonRight = 16 + 100 + 24; // right edge of dice button + spacing
  const dicePanelRight = 16 + 288 + 8 + 100 + 24; // panel + gap + button + spacing
  const baseRight = isDiceExpanded ? dicePanelRight : diceButtonRight;
  const cardWidth = 140;
  const cardSpacing = 8;

  // Minimized: stack to the left of the dice button
  const minimizedRight = baseRight + (index * (cardWidth + cardSpacing));

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        ...(isExpanded
          ? {
              // Centered on screen
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "400px",
              maxHeight: "70vh",
            }
          : {
              right: minimizedRight,
              bottom: 40,
              width: cardWidth,
            }),
        transition: "all 0.25s ease",
        zIndex: 40,
      }}
      title={!isExpanded ? mob.name : undefined}
      className="bg-muted border-2 border-primary rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div
        className="bg-primary/20 border-b border-primary p-2 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-xs font-semibold text-foreground truncate flex-1">
          {mob.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground hover:bg-primary/80 rounded"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-xs px-1.5 py-0.5 bg-destructive text-destructive-foreground hover:bg-destructive/80 rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Image */}
          {mob.image && (
            <img
              src={mob.image}
              alt={mob.name}
              className="w-full h-40 object-cover rounded mb-3"
            />
          )}

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Level:</span>{" "}
              <span className="font-semibold">{mob.level}</span>
            </div>
            {mob.hitPoints !== undefined && (
              <div>
                <span className="text-muted-foreground">HP:</span>{" "}
                <span className={`font-semibold ${mob.hideHitPoints ? "text-muted-foreground" : ""}`}>
                  {mob.hideHitPoints ? "???" : mob.hitPoints}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-semibold capitalize">{mob.type}</span>
            </div>

            {mob.description && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Description:</p>
                <p className="text-xs italic">{mob.description}</p>
              </div>
            )}

            {mob.weaknesses && !mob.hideWeaknesses && (
              <div>
                <p className="text-destructive text-xs font-semibold">Weaknesses:</p>
                <p className="text-xs">{mob.weaknesses}</p>
              </div>
            )}

            {mob.strengths && !mob.hideStrengths && (
              <div>
                <p className="text-primary text-xs font-semibold">Strengths:</p>
                <p className="text-xs">{mob.strengths}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
