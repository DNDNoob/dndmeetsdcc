import React, { useRef, useState, useCallback, useEffect } from 'react';

interface FogOfWarProps {
  isVisible: boolean;
  revealedAreas: { x: number; y: number; radius: number }[];
  isAdmin: boolean;
  brushSize: number;
  onReveal?: (x: number, y: number, radius: number) => void;
  onClearAll?: () => void;
  isViewerAdmin?: boolean; // True if the viewer is admin (for semi-transparent fog)
}

export const FogOfWar: React.FC<FogOfWarProps> = ({
  isVisible,
  revealedAreas,
  isAdmin,
  brushSize,
  onReveal,
  onClearAll,
  isViewerAdmin = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const getPercentagePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isAdmin || !onReveal) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPercentagePosition(e);
    if (pos) {
      onReveal(pos.x, pos.y, brushSize);
    }
  }, [isAdmin, onReveal, brushSize, getPercentagePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getPercentagePosition(e);
    setCursorPos(pos);

    if (!isDrawing || !isAdmin || !onReveal) return;
    if (pos) {
      onReveal(pos.x, pos.y, brushSize);
    }
  }, [isDrawing, isAdmin, onReveal, brushSize, getPercentagePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDrawing(false);
    setCursorPos(null);
  }, []);

  // Global mouseup listener
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDrawing(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  if (!isVisible) return null;

  // Create SVG mask for revealed areas
  const maskId = `fog-mask-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ zIndex: 20 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0"
        style={{ pointerEvents: isAdmin ? 'auto' : 'none' }}
      >
        <defs>
          <mask id={maskId}>
            {/* White = visible, Black = hidden */}
            <rect width="100%" height="100%" fill="white" />
            {revealedAreas.map((area, index) => (
              <circle
                key={index}
                cx={`${area.x}%`}
                cy={`${area.y}%`}
                r={`${area.radius}%`}
                fill="black"
              />
            ))}
          </mask>
          {/* Radial gradient for soft edges on revealed areas */}
          <radialGradient id="fog-gradient">
            <stop offset="0%" stopColor="rgba(30, 30, 40, 0)" />
            <stop offset="70%" stopColor="rgba(30, 30, 40, 0.5)" />
            <stop offset="100%" stopColor="rgba(30, 30, 40, 0.95)" />
          </radialGradient>
        </defs>

        {/* Main fog layer - opaque for users, semi-transparent for DM */}
        <rect
          width="100%"
          height="100%"
          fill={isViewerAdmin ? "rgba(20, 20, 30, 0.6)" : "rgba(10, 10, 15, 1)"}
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Brush cursor preview for admin */}
      {isAdmin && cursorPos && (
        <div
          className="absolute pointer-events-none border-2 border-white/50 rounded-full"
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
            width: `${brushSize * 2}%`,
            height: `${brushSize * 2}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
          }}
        />
      )}
    </div>
  );
};
