import React from "react";

interface GridOverlayProps {
  isVisible: boolean;
  cellSize?: number;
  opacity?: number;
  onCellSizeChange?: (newSize: number) => void;
  showControls?: boolean;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({ 
  isVisible, 
  cellSize = 50, 
  opacity = 0.2, 
  onCellSizeChange,
  showControls = false 
}) => {
  if (!isVisible) return null;

  return (
    <>
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ opacity }}
      >
        <defs>
          <pattern id="grid" width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
              fill="none"
              stroke="rgba(128, 128, 128, 0.8)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      
      {/* Grid size controls */}
      {showControls && onCellSizeChange && (
        <div className="absolute bottom-4 right-4 bg-background/90 border border-border rounded-lg p-3 pointer-events-auto z-10">
          <label className="text-xs text-muted-foreground mb-2 block">Grid Size: {cellSize}px</label>
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            value={cellSize}
            onChange={(e) => onCellSizeChange(parseInt(e.target.value))}
            className="w-32"
          />
        </div>
      )}
    </>
  );
};

export default GridOverlay;
