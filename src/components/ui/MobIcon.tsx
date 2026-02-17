import React from "react";
import { Mob } from "@/lib/gameData";

interface MobIconProps {
  mob: Mob;
  size?: number;
  isDragging?: boolean;
  onClick?: () => void;
  /** Whether this mob is currently in combat (uses combatHP for current) */
  inCombat?: boolean;
  /** Current HP for this combatant instance (from CombatState) */
  combatHP?: number;
  /** Max HP for this mob (from mob.hitPoints or original value) */
  maxHP?: number;
}

export const MobIcon: React.FC<MobIconProps> = ({ mob, size = 40, isDragging = false, onClick, inCombat = false, combatHP, maxHP }) => {
  const displayMaxHP = maxHP ?? mob.hitPoints ?? 0;
  const displayCurrentHP = inCombat ? (combatHP ?? mob.hitPoints ?? 0) : displayMaxHP;
  const hpPercentage = displayMaxHP > 0 ? Math.min(100, Math.max(0, (displayCurrentHP / displayMaxHP) * 100)) : 0;
  // Only show health bar during active combat
  const showBar = inCombat && displayMaxHP > 0;

  return (
    <div
      onClick={onClick}
      className={`relative cursor-move transition-all ${isDragging ? "opacity-50 scale-110" : "hover:scale-110"}`}
      style={{
        width: size,
        height: showBar ? size + 14 : size,
      }}
    >
      {/* Circular container */}
      <div
        className="absolute inset-x-0 top-0 rounded-full border-2 border-primary shadow-lg overflow-hidden bg-muted"
        style={{
          width: size,
          height: size,
          backgroundImage: mob.image ? `url(${mob.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
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

      {/* Health bar - always shown when mob has HP */}
      {showBar && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{ width: Math.max(size, 48) }}
        >
          <div className="h-3.5 border border-muted-foreground/40 bg-destructive/60 overflow-hidden rounded-sm relative">
            <div
              className="h-full transition-all duration-300 bg-green-500"
              style={{ width: `${hpPercentage}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] leading-none">
              {displayCurrentHP}/{displayMaxHP}
            </span>
          </div>
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
