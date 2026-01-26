import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, RotateCw, Maximize2 } from "lucide-react";

export type ShapeType = "rectangle" | "square" | "circle" | "triangle";

export interface MapBoxData {
  id: string;
  x: number; // Percentage of map width (0-100)
  y: number; // Percentage of map height (0-100)
  width: number; // Percentage of map width
  height: number; // Percentage of map height
  rotation: number; // Degrees
  color: string;
  opacity: number; // 0-1
  createdBy: string; // User who created it
  shape?: ShapeType; // Shape type (defaults to rectangle for backwards compatibility)
}

interface MapBoxProps {
  box: MapBoxData;
  isAdmin: boolean;
  onUpdate: (box: MapBoxData) => void;
  onDelete: (id: string) => void;
  mapScale: number;
  canInteract?: boolean; // Whether the box can be interacted with (visibility check)
}

export const MapBox: React.FC<MapBoxProps> = ({
  box,
  isAdmin,
  onUpdate,
  onDelete,
  mapScale,
  canInteract = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const counterScale = 100 / mapScale;

  useEffect(() => {
    if (!isDragging && !isResizing && !isRotating) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      // Get the map container (parent of this component)
      const mapContainer = containerRef.current.closest('[data-map-container]');
      if (!mapContainer) return;

      const rect = mapContainer.getBoundingClientRect();

      if (isDragging) {
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onUpdate({
          ...box,
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
        });
      } else if (isResizing) {
        const centerX = (box.x / 100) * rect.width + rect.left;
        const centerY = (box.y / 100) * rect.height + rect.top;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const newWidth = (Math.abs(dx) * 2 / rect.width) * 100;
        const newHeight = (Math.abs(dy) * 2 / rect.height) * 100;

        // For squares and circles, enforce equal dimensions
        if (box.shape === "square" || box.shape === "circle") {
          const size = Math.max(newWidth, newHeight);
          onUpdate({
            ...box,
            width: Math.max(2, Math.min(50, size)),
            height: Math.max(2, Math.min(50, size)),
          });
        } else {
          onUpdate({
            ...box,
            width: Math.max(2, Math.min(50, newWidth)),
            height: Math.max(2, Math.min(50, newHeight)),
          });
        }
      } else if (isRotating) {
        const centerX = (box.x / 100) * rect.width + rect.left;
        const centerY = (box.y / 100) * rect.height + rect.top;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const degrees = (angle * 180 / Math.PI) + 90;
        onUpdate({
          ...box,
          rotation: degrees,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, isRotating, box, onUpdate]);

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        pointerEvents: canInteract ? "auto" : "none",
        opacity: canInteract ? 1 : 0.5,
      }}
      onMouseEnter={() => canInteract && setShowControls(true)}
      onMouseLeave={() => !isDragging && !isResizing && !isRotating && setShowControls(false)}
    >
      {/* The shape itself */}
      {(!box.shape || box.shape === "rectangle") && (
        <div
          ref={boxRef}
          className="w-full h-full rounded border-2 cursor-move"
          style={{
            backgroundColor: box.color,
            opacity: box.opacity,
            borderColor: box.color,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      )}
      {box.shape === "square" && (
        <div
          ref={boxRef}
          className="w-full h-full border-2 cursor-move"
          style={{
            backgroundColor: box.color,
            opacity: box.opacity,
            borderColor: box.color,
            aspectRatio: "1 / 1",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      )}
      {box.shape === "circle" && (
        <div
          ref={boxRef}
          className="w-full h-full rounded-full border-2 cursor-move"
          style={{
            backgroundColor: box.color,
            opacity: box.opacity,
            borderColor: box.color,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      )}
      {box.shape === "triangle" && (
        <div
          ref={boxRef}
          className="w-full h-full cursor-move relative"
          style={{
            opacity: box.opacity,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <polygon
              points="50,5 95,95 5,95"
              fill={box.color}
              stroke={box.color}
              strokeWidth="2"
            />
          </svg>
        </div>
      )}

      {/* Control handles - visible to all users */}
      {showControls && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `scale(${counterScale})` }}
        >
          {/* Delete button */}
          <button
            className="absolute -top-3 -right-3 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors pointer-events-auto z-10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(box.id);
            }}
          >
            <X className="w-3 h-3" />
          </button>

          {/* Resize handle */}
          <div
            className="absolute -bottom-3 -right-3 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center cursor-nwse-resize pointer-events-auto"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
            }}
          >
            <Maximize2 className="w-3 h-3" />
          </div>

          {/* Rotate handle */}
          <div
            className="absolute -bottom-3 -left-3 w-6 h-6 bg-secondary text-white rounded-full flex items-center justify-center cursor-grab pointer-events-auto"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsRotating(true);
            }}
          >
            <RotateCw className="w-3 h-3" />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MapBox;
