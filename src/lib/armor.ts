import type { ArmorData, Crawler, InventoryItem } from "@/lib/gameData";

// Armor: every worn piece's armor rating stacks into the crawler's DC (the attack roll needed to hit;
// 0 with no armor, so any roll hits). Damage reduction comes off each hit, resistances halve and
// vulnerabilities double damage of a damage type (Fire) or weapon type (Bows).

/** Worn pieces (head, chest, legs, feet) and non-weapon hand items like shields can carry armor. */
export const canWearArmor = (item: Pick<InventoryItem, 'equipSlot' | 'weaponData'>) =>
  !item.weaponData && !!item.equipSlot && ['head', 'chest', 'legs', 'feet', 'leftHand', 'rightHand'].includes(item.equipSlot);

export interface ArmorPiece { id: string; name: string; data: ArmorData }

export interface CrawlerArmor {
  dc: number;
  reduction: number;
  resist: string[];
  vulnerable: string[];
  pieces: ArmorPiece[];
}

/** The armor a crawler has on: each equipped item with armor numbers, counted once. */
export function getCrawlerArmor(crawler: Pick<Crawler, 'equippedItems'>, inventory: InventoryItem[]): CrawlerArmor {
  const ids = new Set(Object.values(crawler.equippedItems ?? {}).filter(Boolean));
  const pieces: ArmorPiece[] = inventory
    .filter(i => ids.has(i.id) && i.armorData)
    .map(i => ({ id: i.id, name: i.name.replace(/\s+upgraded$/i, ''), data: i.armorData! }));
  const all = (key: 'resist' | 'vulnerable') => [...new Set(pieces.flatMap(p => p.data[key] ?? []))];
  return {
    dc: pieces.reduce((sum, p) => sum + (p.data.rating ?? 0), 0),
    reduction: pieces.reduce((sum, p) => sum + (p.data.reduction ?? 0), 0),
    resist: all('resist'),
    vulnerable: all('vulnerable'),
    pieces,
  };
}

export interface ArmoredHit {
  damage: number;                 // what's left after armor
  absorbed: { id: string; name: string; amount: number }[]; // what each piece took off
  resisted: boolean;
  vulnerable: boolean;
}

/**
 * One hit against a crawler's armor. Resistance (half, rounded down) or vulnerability (double) comes
 * first; resisting and being vulnerable to the same hit cancel out. Then reduction comes off. A hit that
 * did damage always does at least 1.
 */
export function applyArmorToHit(damage: number, armor: CrawlerArmor, hit: { damageType?: string; weaponType?: string }): ArmoredHit {
  const result: ArmoredHit = { damage, absorbed: [], resisted: false, vulnerable: false };
  if (damage <= 0 || armor.pieces.length === 0) return result;
  const kinds = [hit.damageType, hit.weaponType].filter((k): k is string => !!k);
  const matches = (list?: string[]) => kinds.some(k => list?.includes(k));
  const resisted = matches(armor.resist);
  const vulnerable = matches(armor.vulnerable);
  const credit = new Map<string, number>();
  const give = (id: string, amount: number) => { if (amount > 0) credit.set(id, (credit.get(id) ?? 0) + amount); };

  let left = damage;
  if (resisted && !vulnerable) {
    const halved = Math.max(1, Math.floor(left / 2)); // still at least 1
    // The halved damage is split between the pieces that resist it
    const resisters = armor.pieces.filter(p => matches(p.data.resist));
    const share = Math.floor((left - halved) / resisters.length);
    resisters.forEach((p, i) => give(p.id, share + (i === 0 ? (left - halved) - share * resisters.length : 0)));
    left = halved;
    result.resisted = true;
  } else if (vulnerable && !resisted) {
    left *= 2;
    result.vulnerable = true;
  }
  for (const p of armor.pieces) {
    const take = Math.min(p.data.reduction ?? 0, Math.max(0, left - 1));
    give(p.id, take);
    left -= take;
  }
  result.damage = left;
  result.absorbed = armor.pieces.filter(p => credit.has(p.id)).map(p => ({ id: p.id, name: p.name, amount: credit.get(p.id)! }));
  return result;
}
