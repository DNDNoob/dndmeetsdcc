import React from "react";

interface GridOverlayProps {
  isVisible: boolean;
  cellSize?: number;
  opacity?: number;
  width?: number;
  height?: number;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({ 
  isVisible, 
  cellSize = 50, 
  opacity = 0.2,
  width,
  height 
}) => {
  if (!isVisible) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width || "100%"}
      height={height || "100%"}
      style={{ opacity, mixBlendMode: 'multiply' }}
    >
      <defs>
        <pattern id="grid" width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
          <path
            d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
            fill="none"
            stroke="#4a4a4a"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
};

export default GridOverlay;
