import React from "react";
import { InventoryItem, baseItemName } from "@/lib/gameData";

/** An item's name, with "Upgraded" appended in the gold display font when a crawler has upgraded their copy. */
export const ItemName: React.FC<{ item: Pick<InventoryItem, 'name' | 'isUpgraded'> }> = ({ item }) => (
  <>
    {baseItemName(item)}
    {item.isUpgraded && <span className="ml-1 font-display italic font-bold text-accent text-glow-gold">Upgraded</span>}
  </>
);
