import React from "react";
import { Crawler } from "@/lib/gameData";
import { User } from "lucide-react";

interface CrawlerIconProps {
  crawler: Crawler;
  size?: number;
  isDragging?: boolean;
  onClick?: () => void;
  /** Effective current HP (base + equipment modifier) */
  effectiveHP?: number;
  /** Effective max HP (base + equipment modifier) */
  effectiveMaxHP?: number;
  /** Base max HP without modifiers (to show orange modifier portion) */
  baseMaxHP?: number;
  /** Whether to show the health bar (default true) */
  showHealthBar?: boolean;
}

export const CrawlerIcon: React.FC<CrawlerIconProps> = ({
  crawler,
  size = 40,
  isDragging = false,
  onClick,
  effectiveHP,
  effectiveMaxHP,
  baseMaxHP,
  showHealthBar = true,
}) => {
  const currentHP = effectiveHP ?? crawler.hp ?? 0;
  const maxHP = effectiveMaxHP ?? crawler.maxHP ?? 1;
  const hasModifier = baseMaxHP !== undefined && baseMaxHP !== maxHP;
  const isNegativeModifier = hasModifier && maxHP < baseMaxHP;

  const hpPercentage = maxHP > 0 ? Math.min(100, Math.max(0, (currentHP / maxHP) * 100)) : 0;
  // Base portion: the part of the bar that represents base max HP (without modifier)
  const basePercentage = hasModifier && !isNegativeModifier
    ? Math.min(100, Math.max(0, (Math.min(currentHP, baseMaxHP) / maxHP) * 100))
    : hpPercentage;
  const modifierPercentage = hasModifier && !isNegativeModifier ? Math.max(0, hpPercentage - basePercentage) : 0;

  return (
    <div
      onClick={onClick}
      className={`relative cursor-move transition-all ${isDragging ? "opacity-50 scale-110" : "hover:scale-110"}`}
      style={{
        width: size,
        height: showHealthBar ? size + 14 : size,
      }}
    >
      {/* Circular container with blue border for crawlers */}
      <div
        className="absolute inset-x-0 top-0 rounded-full border-2 border-blue-400 shadow-lg overflow-hidden bg-muted"
        style={{
          width: size,
          height: size,
          backgroundImage: crawler.avatar ? `url(${crawler.avatar})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
          filter: isDragging ? "brightness(0.7)" : "brightness(1)",
        }}
      >
        {!crawler.avatar && (
          <div className="w-full h-full flex items-center justify-center bg-blue-500/20">
            <User className="w-1/2 h-1/2 text-blue-400" />
          </div>
        )}
      </div>

      {/* Health bar */}
      {showHealthBar && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{ width: Math.max(size, 48) }}
        >
          <div className="h-3.5 border border-muted-foreground/40 bg-destructive/60 overflow-hidden rounded-sm relative flex">
            {/* Base HP portion (green, or purple if negative modifier) */}
            <div
              className={`h-full transition-all duration-300 ${isNegativeModifier ? 'bg-purple-500' : 'bg-green-500'}`}
              style={{ width: `${basePercentage}%` }}
            />
            {/* Equipment modifier portion (orange) */}
            {modifierPercentage > 0 && (
              <div
                className="h-full transition-all duration-300 bg-orange-500"
                style={{ width: `${modifierPercentage}%` }}
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] leading-none">
              {currentHP}/{maxHP}
            </span>
          </div>
        </div>
      )}

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background border border-border rounded px-2 py-1 text-xs text-foreground opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {crawler.name} (Lvl {crawler.level} {crawler.job})
      </div>
    </div>
  );
};

export default CrawlerIcon;
