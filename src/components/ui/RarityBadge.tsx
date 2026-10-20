import React from "react";
import { getItemRarityColor, type ItemRarity } from "@/lib/gameData";

// Small colored tag showing an item's rarity
export const RarityBadge: React.FC<{ rarity?: ItemRarity; className?: string }> = ({ rarity, className = "" }) => {
  if (!rarity) return null;
  const color = getItemRarityColor(rarity);
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-semibold ${className}`}
      style={{ color, backgroundColor: color + "26" }}
    >
      {rarity}
    </span>
  );
};
