import React from "react";
import { Sparkles } from "lucide-react";
import type { ArmorData, ItemUpgrade } from "@/lib/gameData";
import { describeUpgradeDrawback } from "@/lib/upgrades";

/** The upgrades on a crawler's copy of an item or spell, plus any armor numbers they gave it.
 *  Number changes are already in the item's stats, so each upgrade shows its name, flavor and price. */
export const UpgradeList: React.FC<{ upgrades?: ItemUpgrade[]; armorData?: ArmorData; className?: string }> = ({ upgrades, armorData, className = '' }) => {
  const armor = armorData && [
    armorData.rating ? `Armor rating ${armorData.rating}` : '',
    armorData.reduction ? `reduces each hit by ${armorData.reduction}` : '',
    armorData.resist?.length ? `resists ${armorData.resist.join(', ')}` : '',
    armorData.vulnerable?.length ? `vulnerable to ${armorData.vulnerable.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  if (!upgrades?.length && !armor) return null;
  return (
    <div className={`space-y-1 text-xs ${className}`}>
      {armor && <p className="text-primary"><span className="text-muted-foreground">Armor: </span>{armor}</p>}
      {upgrades?.map(u => (
        <div key={u.id}>
          <p className="flex items-center gap-1 text-accent font-display">
            <Sparkles className="w-3 h-3 shrink-0" /> {u.name}
            {u.treeName && <span className="text-muted-foreground font-sans">({u.treeName})</span>}
          </p>
          {u.flavor && <p className="pl-4 italic text-muted-foreground">{u.flavor}</p>}
          {u.drawback && <p className="pl-4 text-destructive">Price: {describeUpgradeDrawback(u.drawback)}</p>}
        </div>
      ))}
    </div>
  );
};
