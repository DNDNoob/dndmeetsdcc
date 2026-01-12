import React from "react";
import { Mob } from "@/lib/gameData";

interface MobIconProps {
  mob: Mob;
  size?: number;
  isDragging?: boolean;
  onClick?: () => void;
}

export const MobIcon: React.FC<MobIconProps> = ({ mob, size = 40, isDragging = false, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`relative cursor-move transition-all ${isDragging ? "opacity-50 scale-110" : "hover:scale-110"}`}
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Circular container */}
      <div
        className="absolute inset-0 rounded-full border-2 border-primary shadow-lg overflow-hidden bg-muted"
        style={{
          backgroundImage: mob.image ? `url(${mob.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 20%", // Position towards head
          filter: isDragging ? "brightness(0.7)" : "brightness(1)",
        }}
      >
        {!mob.image && (
          <div className="w-full h-full flex items-center justify-center bg-destructive/20">
            <span className="text-xs font-bold text-center px-1 break-words">
              {mob.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Hit points indicator */}
      {mob.hitPoints && !mob.hideHitPoints && (
        <div className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {mob.hitPoints}
        </div>
      )}

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background border border-border rounded px-2 py-1 text-xs text-foreground opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {mob.name}
      </div>
    </div>
  );
};

export default MobIcon;
