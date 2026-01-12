import { useState, useRef, useEffect } from "react";
import { Mob } from "@/lib/gameData";
import { ChevronUp, ChevronDown } from "lucide-react";

interface ResizableMobDisplayProps {
  mob: Mob;
  initialScale?: number;
  onClose: () => void;
  isAdmin?: boolean;
}

export const ResizableMobDisplay: React.FC<ResizableMobDisplayProps> = ({
  mob,
  initialScale = 1,
  onClose,
  isAdmin = false,
}) => {
  const [scale, setScale] = useState(initialScale);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
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
      if (containerRef.current) {
        const parentRect = containerRef.current.parentElement?.getBoundingClientRect();
        if (parentRect) {
          setPosition({
            x: Math.max(0, Math.min(e.clientX - parentRect.left - dragOffset.x, parentRect.width - 100)),
            y: Math.max(0, Math.min(e.clientY - parentRect.top - dragOffset.y, parentRect.height - 100)),
          });
        }
      }
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

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: isExpanded ? "20px" : position.y + 20,
        right: isExpanded ? "20px" : position.x + 20,
        width: isExpanded ? "350px" : currentSize,
        transition: isExpanded ? "all 0.3s ease" : "none",
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
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(Math.min(2, scale + 0.2));
                }}
                className="p-1 hover:bg-muted rounded"
                title="Expand"
              >
                <ChevronUp className="w-3 h-3" />
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
          {/* Only show close button for admin */}
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-xs px-2 py-1 bg-destructive text-destructive-foreground hover:bg-destructive/80 rounded"
            >
              ✕
            </button>
          )}
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
