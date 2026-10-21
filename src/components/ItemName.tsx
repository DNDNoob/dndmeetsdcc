import React from "react";
import { InventoryItem, baseItemName } from "@/lib/gameData";
import { isCursed } from "@/lib/upgrades";

/** An item's name, with "Upgraded" appended in the gold display font when a crawler has upgraded their copy,
 *  and a red "Cursed" mark when one of its upgrades was a cursed bargain. */
export const ItemName: React.FC<{ item: Pick<InventoryItem, 'name' | 'isUpgraded' | 'upgrades'> }> = ({ item }) => (
  <>
    {baseItemName(item)}
    {item.isUpgraded && <span className="ml-1 font-display italic font-bold text-accent text-glow-gold">Upgraded</span>}
    {isCursed(item.upgrades) && <span className="ml-1 font-display italic font-bold text-destructive text-glow-red">Cursed</span>}
  </>
);
