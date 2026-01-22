import React from "react";
import { Crawler } from "@/lib/gameData";
import { User } from "lucide-react";

interface CrawlerIconProps {
  crawler: Crawler;
  size?: number;
  isDragging?: boolean;
  onClick?: () => void;
}

export const CrawlerIcon: React.FC<CrawlerIconProps> = ({ crawler, size = 40, isDragging = false, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`relative cursor-move transition-all ${isDragging ? "opacity-50 scale-110" : "hover:scale-110"}`}
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Circular container with blue border for crawlers */}
      <div
        className="absolute inset-0 rounded-full border-2 border-blue-400 shadow-lg overflow-hidden bg-muted"
        style={{
          backgroundImage: crawler.avatar ? `url(${crawler.avatar})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 20%", // Position towards head
          filter: isDragging ? "brightness(0.7)" : "brightness(1)",
        }}
      >
        {!crawler.avatar && (
          <div className="w-full h-full flex items-center justify-center bg-blue-500/20">
            <User className="w-1/2 h-1/2 text-blue-400" />
          </div>
        )}
      </div>

      {/* Level indicator */}
      <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
        {crawler.level}
      </div>

      {/* HP bar */}
      <div className="absolute -bottom-3 left-0 right-0 h-1 bg-gray-700 rounded-full overflow-hidden mx-1">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${(crawler.hp / crawler.maxHP) * 100}%` }}
        />
      </div>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-background border border-border rounded px-2 py-1 text-xs text-foreground opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {crawler.name} (Lvl {crawler.level} {crawler.job})
      </div>
    </div>
  );
};

export default CrawlerIcon;
