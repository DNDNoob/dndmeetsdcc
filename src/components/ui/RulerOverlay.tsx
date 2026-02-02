import React from "react";

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
  const dx = ((end.x - start.x) / 100) * imageWidth;
  const dy = ((end.y - start.y) / 100) * imageHeight;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  const feet = Math.round((pixelDist / gridSize) * 5);

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
      {/* Start dot */}
      <circle
        cx={`${start.x}%`}
        cy={`${start.y}%`}
        r="5"
        fill="white"
        stroke="black"
        strokeWidth="2"
      />
      {/* End dot */}
      <circle
        cx={`${end.x}%`}
        cy={`${end.y}%`}
        r="5"
        fill="white"
        stroke="black"
        strokeWidth="2"
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
