import React, { useRef, useState, useCallback, useEffect } from 'react';

interface FogOfWarProps {
  isVisible: boolean;
  revealedAreas: { x: number; y: number; radius: number }[];
  isAdmin: boolean;
  brushSize: number;
  onReveal?: (x: number, y: number, radius: number) => void;
  onClearAll?: () => void;
  onDrawingEnd?: () => void; // Called when fog drawing ends for final sync
  isViewerAdmin?: boolean; // True if the viewer is admin (for semi-transparent fog)
}

export const FogOfWar: React.FC<FogOfWarProps> = ({
  isVisible,
  revealedAreas,
  isAdmin,
  brushSize,
  onReveal,
  onClearAll,
  onDrawingEnd,
  isViewerAdmin = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const getPercentagePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  // Interpolate points between last and current position to prevent skipping
  const interpolateAndReveal = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!onReveal) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate step size based on brush size (smaller steps for smoother lines)
    const stepSize = brushSize * 0.5;
    const steps = Math.max(1, Math.ceil(distance / stepSize));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      onReveal(x, y, brushSize);
    }
  }, [onReveal, brushSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isAdmin || !onReveal) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPercentagePosition(e);
    if (pos) {
      lastPosRef.current = pos;
      onReveal(pos.x, pos.y, brushSize);
    }
  }, [isAdmin, onReveal, brushSize, getPercentagePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getPercentagePosition(e);
    setCursorPos(pos);

    if (!isDrawing || !isAdmin || !onReveal || !pos) return;

    // Interpolate from last position to current position
    if (lastPosRef.current) {
      interpolateAndReveal(lastPosRef.current, pos);
    } else {
      onReveal(pos.x, pos.y, brushSize);
    }
    lastPosRef.current = pos;
  }, [isDrawing, isAdmin, onReveal, brushSize, getPercentagePosition, interpolateAndReveal]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      onDrawingEnd?.();
    }
    setIsDrawing(false);
    lastPosRef.current = null;
  }, [isDrawing, onDrawingEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      onDrawingEnd?.();
    }
    setIsDrawing(false);
    setCursorPos(null);
    lastPosRef.current = null;
  }, [isDrawing, onDrawingEnd]);

  // Global mouseup listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        onDrawingEnd?.();
      }
      setIsDrawing(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDrawing, onDrawingEnd]);

  if (!isVisible) return null;

  // Create SVG mask for revealed areas
  const maskId = `fog-mask-${Math.random().toString(36).substr(2, 9)}`;

  // Only capture pointer events when admin is actively erasing fog
  // Otherwise, allow clicks to pass through to items underneath
  const shouldCaptureEvents = isAdmin;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        zIndex: 20,
        pointerEvents: shouldCaptureEvents ? 'auto' : 'none',
      }}
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

      {/* Brush cursor preview for admin - use vmin for perfect circle */}
      {isAdmin && cursorPos && (
        <div
          className="absolute pointer-events-none border-2 border-white/50 rounded-full"
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
            // Use vmin to ensure the brush is always a perfect circle
            width: `${brushSize * 4}vmin`,
            height: `${brushSize * 4}vmin`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
          }}
        />
      )}
    </div>
  );
};
