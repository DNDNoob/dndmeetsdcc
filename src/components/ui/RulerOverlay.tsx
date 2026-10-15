import React from "react";
import { getMapDistanceFeet } from "@/lib/gameData";

interface RulerOverlayProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  imageWidth: number;
  imageHeight: number;
  gridSize?: number;
}

const RulerOverlay: React.FC<RulerOverlayProps> = ({
  start,
  end,
  imageWidth,
  imageHeight,
  gridSize = 64,
}) => {
  const feet = Math.round(getMapDistanceFeet(start, end, imageWidth, imageHeight, gridSize));

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 60 }}
    >
      {/* Shadow line for contrast */}
      <line
        x1={`${start.x}%`}
        y1={`${start.y}%`}
        x2={`${end.x}%`}
        y2={`${end.y}%`}
        stroke="black"
        strokeWidth="4"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />
      {/* Main line */}
      <line
        x1={`${start.x}%`}
        y1={`${start.y}%`}
        x2={`${end.x}%`}
        y2={`${end.y}%`}
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="8 4"
      />
      {/* Distance label background */}
      <rect
        x={`${midX}%`}
        y={`${midY}%`}
        width="70"
        height="24"
        rx="4"
        fill="rgba(0,0,0,0.8)"
        stroke="white"
        strokeWidth="1"
        transform={`translate(-35, -28)`}
      />
      {/* Distance label text */}
      <text
        x={`${midX}%`}
        y={`${midY}%`}
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="bold"
        fontFamily="monospace"
        dy="-12"
      >
        {feet} ft
      </text>
    </svg>
  );
};

export default RulerOverlay;
