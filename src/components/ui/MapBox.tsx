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
  onManipulationEnd?: () => void; // Called when drag/resize/rotate ends for final sync
  mapScale: number;
  canInteract?: boolean; // Whether the box can be interacted with (visibility check)
}

export const MapBox: React.FC<MapBoxProps> = ({
  box,
  isAdmin,
  onUpdate,
  onDelete,
  onManipulationEnd,
  mapScale,
  canInteract = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rotateStartAngle = useRef<number | null>(null); // Initial mouse angle when rotation starts
  const rotateStartRotation = useRef<number>(0); // Shape's rotation when drag started

  const counterScale = 100 / mapScale;

  // Hide controls when clicking outside the shape
  useEffect(() => {
    if (!showControls) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowControls(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showControls]);

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

        // For squares and circles, use distance from center for uniform sizing
        if (box.shape === "square" || box.shape === "circle") {
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Convert pixel distance to vmin-based size (rough approximation)
          const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
          const newSize = (distance / vmin);
          onUpdate({
            ...box,
            width: Math.max(2, Math.min(100, newSize)),
            height: Math.max(2, Math.min(100, newSize)),
          });
        } else {
          const newWidth = (Math.abs(dx) * 2 / rect.width) * 100;
          const newHeight = (Math.abs(dy) * 2 / rect.height) * 100;
          onUpdate({
            ...box,
            width: Math.max(2, Math.min(200, newWidth)),
            height: Math.max(2, Math.min(200, newHeight)),
          });
        }
      } else if (isRotating) {
        const centerX = (box.x / 100) * rect.width + rect.left;
        const centerY = (box.y / 100) * rect.height + rect.top;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const degrees = (angle * 180 / Math.PI) + 90;
        // On first move, capture the starting angle offset
        if (rotateStartAngle.current === null) {
          rotateStartAngle.current = degrees;
          rotateStartRotation.current = box.rotation;
          return; // Don't rotate on the initial capture
        }
        const delta = degrees - rotateStartAngle.current;
        onUpdate({
          ...box,
          rotation: rotateStartRotation.current + delta,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
      rotateStartAngle.current = null;
      // Call onManipulationEnd to trigger final broadcast
      onManipulationEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, isRotating, box, onUpdate, onManipulationEnd]);

  // For squares and circles, use vmin-based sizing to maintain aspect ratio
  const isSquareOrCircle = box.shape === "square" || box.shape === "circle";

  // Check if any local manipulation is happening
  const isManipulating = isDragging || isResizing || isRotating;

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
        // Use vmin for square/circle to maintain aspect ratio, percentages for rectangle/triangle
        width: isSquareOrCircle ? `${box.width * 2}vmin` : `${box.width}%`,
        height: isSquareOrCircle ? `${box.width * 2}vmin` : `${box.height}%`,
        pointerEvents: canInteract ? "auto" : "none",
        opacity: canInteract ? 1 : 0.5,
        // Smooth transition for remote updates, instant for local manipulation
        transition: isManipulating ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out, transform 0.15s ease-out',
      }}
      onClick={(e) => { e.stopPropagation(); if (canInteract) setShowControls(true); }}
    >
      {/* The shape itself */}
      {(!box.shape || box.shape === "rectangle") && (
        <div
          ref={boxRef}
          className="w-full h-full rounded border-2 cursor-move"
          style={{
            backgroundColor: box.color,
            opacity: box.opacity,
            borderColor: 'rgba(0,0,0,0.7)',
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
            borderColor: 'rgba(0,0,0,0.7)',
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
            borderColor: 'rgba(0,0,0,0.7)',
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
              stroke="rgba(0,0,0,0.7)"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}

      {/* Control handles - visible to all users, stay until clicking outside */}
      {showControls && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Delete button - top right */}
          <button
            className="absolute bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors pointer-events-auto z-10"
            style={{
              top: 0, right: 0,
              width: `${24 * counterScale}px`, height: `${24 * counterScale}px`,
              transform: 'translate(50%, -50%)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(box.id);
            }}
          >
            <X style={{ width: `${12 * counterScale}px`, height: `${12 * counterScale}px` }} />
          </button>

          {/* Resize handle - bottom right */}
          <div
            className="absolute bg-accent text-white rounded-full flex items-center justify-center cursor-nwse-resize pointer-events-auto"
            style={{
              bottom: 0, right: 0,
              width: `${24 * counterScale}px`, height: `${24 * counterScale}px`,
              transform: 'translate(50%, 50%)',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
            }}
          >
            <Maximize2 style={{ width: `${12 * counterScale}px`, height: `${12 * counterScale}px` }} />
          </div>

          {/* Rotate handle - bottom left */}
          <div
            className="absolute bg-secondary text-white rounded-full flex items-center justify-center cursor-grab pointer-events-auto"
            style={{
              bottom: 0, left: 0,
              width: `${24 * counterScale}px`, height: `${24 * counterScale}px`,
              transform: 'translate(-50%, 50%)',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsRotating(true);
            }}
          >
            <RotateCw style={{ width: `${12 * counterScale}px`, height: `${12 * counterScale}px` }} />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MapBox;
