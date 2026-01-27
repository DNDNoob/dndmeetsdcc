import { useState, useRef, useEffect } from "react";
import { Mob } from "@/lib/gameData";
import { ChevronUp, ChevronDown, Minus, Plus } from "lucide-react";

interface ResizableMobDisplayProps {
  mob: Mob;
  initialScale?: number;
  onClose: () => void;
  index?: number; // For stacking multiple cards
}

export const ResizableMobDisplay: React.FC<ResizableMobDisplayProps> = ({
  mob,
  initialScale = 1,
  onClose,
  index = 0,
}) => {
  const [scale, setScale] = useState(initialScale);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasBeenDragged, setHasBeenDragged] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag from header area
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    setIsDragging(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setHasBeenDragged(true);
      // Use viewport for positioning
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Clamp to viewport
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const baseSize = 120;
  const currentSize = baseSize * scale;

  // Calculate default position - to the LEFT of the dice menu (which is at bottom-right)
  // Dice menu button is at bottom-14 (56px) right-4 (16px) and is about 100px wide
  // Position cards to the left of the dice area with enough clearance
  const diceMenuWidth = 120; // Width of dice toggle button
  const cardSpacing = 10;
  const defaultRight = diceMenuWidth + cardSpacing + (index * (currentSize + cardSpacing));

  // Position cards above the dice toggle button (which is at bottom-14 = 56px)
  const defaultBottom = 80;

  // When expanded, show on the left side of the screen
  const expandedLeft = 20;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        ...(hasBeenDragged && !isExpanded
          ? {
              left: position.x,
              top: position.y,
            }
          : isExpanded
          ? {
              left: expandedLeft,
              bottom: 20,
            }
          : {
              right: defaultRight,
              bottom: defaultBottom,
            }),
        width: isExpanded ? "350px" : currentSize,
        transition: isDragging ? "none" : "all 0.2s ease",
        zIndex: 40,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      className="bg-muted border-2 border-primary rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header with controls */}
      <div className="bg-primary/20 border-b border-primary p-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground truncate flex-1">
          {mob.name}
        </span>
        <div className="flex items-center gap-1">
          {!isExpanded && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(Math.max(0.5, scale - 0.2));
                }}
                className="p-1 hover:bg-muted rounded"
                title="Shrink"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(Math.min(2, scale + 0.2));
                }}
                className="p-1 hover:bg-muted rounded"
                title="Grow"
              >
                <Plus className="w-3 h-3" />
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-xs px-2 py-1 bg-primary text-primary-foreground hover:bg-primary/80 rounded"
          >
            {isExpanded ? "⬇" : "⬆"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-xs px-2 py-1 bg-destructive text-destructive-foreground hover:bg-destructive/80 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={isExpanded ? "p-4 max-h-[60vh] overflow-y-auto" : ""}>
        {/* Image */}
        {mob.image && (
          <img
            src={mob.image}
            alt={mob.name}
            style={isExpanded ? {} : { height: currentSize - 40 }}
            className={isExpanded ? "w-full h-32 object-cover rounded mb-3" : "w-full object-cover rounded"}
          />
        )}

        {isExpanded && (
          <>
            {/* Details */}
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

            {/* Size control in expanded mode */}
            <div className="mt-4 space-y-2">
              <label className="text-xs text-muted-foreground">Size ({Math.round(scale * 100)}%)</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
