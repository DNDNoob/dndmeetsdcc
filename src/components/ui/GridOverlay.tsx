import React from "react";

interface GridOverlayProps {
  isVisible: boolean;
  cellSize?: number;
  opacity?: number;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({ isVisible, cellSize = 50, opacity = 0.2 }) => {
  if (!isVisible) return null;

  return (
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
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
};

export default GridOverlay;
