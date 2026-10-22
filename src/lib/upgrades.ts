import {
  DAMAGE_TYPES, SPELL_DAMAGE_TYPES, getUpgradeKind,
  type InventoryItem, type ItemUpgrade, type KnownSpell, type Spell, type StatModifiers, type UpgradeDrawback,
  type UpgradeEffect, type UpgradeEffectType, type UpgradeKind, type WeaponDie,
} from "@/lib/gameData";

// Upgrades bake their number changes into the crawler's copy of an item, so every roll and stat total
// picks them up without knowing about upgrades. Spells stay linked to the library and get their
// upgrades applied when read (resolveKnownSpell). Effects the game can't run yet (on-hit chances,
// new actions, strange effects) are written onto the item as text for the DM to rule on.

export const UPGRADE_EFFECT_LABELS: Record<UpgradeEffectType, string> = {
  dice: 'Dice change',
  property: 'Weapon or spell property',
  stat: 'Stat bonus while equipped',
  onHit: 'On-hit effect',
  action: 'New action',
  defense: 'Defense',
  language: 'Language',
  strange: 'Strange',
};

export const UPGRADE_DRAWBACK_LABELS: Record<UpgradeDrawback['type'], string> = {
  statPenalty: 'Stat penalty while equipped',
  destroyOnUnequip: 'Destroyed if unequipped',
  locked: "Can't be unequipped",
  cost: 'HP or mana cost per use',
  strange: 'Strange (DM rules)',
};

/** Which effect types make sense for each kind of item. */
export const UPGRADE_EFFECTS_FOR: Record<UpgradeKind, UpgradeEffectType[]> = {
  weapon: ['dice', 'property', 'stat', 'onHit', 'action', 'language', 'strange'],
  armor: ['defense', 'stat', 'action', 'language', 'strange'],
  gear: ['stat', 'defense', 'action', 'language', 'strange'],
  spell: ['dice', 'property', 'onHit', 'action', 'strange'],
  none: [],
};

const DIE_STEPS = [4, 6, 8, 10, 12, 20];
const UNDO_FIELDS = ['name', 'weaponData', 'statModifiers', 'effects', 'grantsLanguage', 'armorData', 'isUpgraded'] as const;

const dieText = (d: WeaponDie) => `${d.count}d${d.sides}`;
const stepDie = (die: WeaponDie, step: number): WeaponDie => {
  const at = DIE_STEPS.indexOf(die.sides);
  if (at === -1) return die;
  return { ...die, sides: DIE_STEPS[Math.max(0, Math.min(DIE_STEPS.length - 1, at + step))] };
};
const addDieTo = (dice: WeaponDie[], die: WeaponDie): WeaponDie[] => {
  const same = dice.findIndex(d => d.sides === die.sides);
  if (same === -1) return [...dice, { ...die }];
  return dice.map((d, i) => i === same ? { ...d, count: d.count + die.count } : d);
};
// penalty: every value counts against the item, whatever sign it was typed with
const addMods = (base: StatModifiers | undefined, add: StatModifiers, penalty = false): StatModifiers | undefined => {
  const out: StatModifiers = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(add)) {
    const key = k as keyof StatModifiers;
    const next = (out[key] ?? 0) + (penalty ? -Math.abs(v ?? 0) : (v ?? 0));
    if (next) out[key] = next; else delete out[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
};
const modsText = (mods: StatModifiers, penalty = false) => Object.entries(mods)
  .filter(([, v]) => v)
  .map(([k, v]) => {
    const n = penalty ? -Math.abs(v as number) : (v as number);
    return `${n > 0 ? '+' : ''}${n} ${k === 'moveSpeed' ? 'ft speed' : k.toUpperCase()}`;
  })
  .join(', ');
const appendLine = (text: string | undefined, line: string) => text?.trim() ? `${text.trim()}\n${line}` : line;
const usesText = { perCombat: 'once per combat', perDay: 'once per day', atWill: 'at will' } as const;

/** One effect in plain words, e.g. "Damage die up 1 size, +1d6 damage". */
export const describeUpgradeEffect = (e: UpgradeEffect): string => {
  const text = describeEffectText(e);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const describeEffectText = (e: UpgradeEffect): string => {
  switch (e.type) {
    case 'dice': {
      const what = e.target === 'hit' ? 'hit die' : 'damage die';
      const parts = [
        e.step ? `${what} ${e.step > 0 ? 'up' : 'down'} ${Math.abs(e.step)} size${Math.abs(e.step) === 1 ? '' : 's'}` : '',
        e.addDie ? `+${dieText(e.addDie)} ${e.target === 'hit' ? 'to hit' : 'damage'}` : '',
      ].filter(Boolean);
      return parts.join(', ') || 'No change';
    }
    case 'property': return [
      e.rangeFt ? `+${e.rangeFt} ft range` : '',
      e.damageType ? `deals ${e.damageType} damage` : '',
      e.splash ? 'splash damage' : '',
      e.durationTurns ? `lasts ${e.durationTurns} more turn${e.durationTurns === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(', ') || 'No change';
    case 'stat': return `${modsText(e.mods)} while equipped`;
    case 'onHit': return `On hit: ${e.chance}% chance${e.condition ? ` to make the target ${e.condition}${e.turns ? ` for ${e.turns} turn${e.turns === 1 ? '' : 's'}` : ''}` : ''}${e.extraDie ? `${e.condition ? ' and' : ''} for +${dieText(e.extraDie)} damage` : ''}`;
    case 'action': return `${e.name} (${usesText[e.uses]})${e.damage ? `: ${dieText(e.damage)} damage` : ''}${e.text ? `. ${e.text}` : ''}`;
    case 'defense': return [
      e.armorRating ? `+${e.armorRating} armor rating` : '',
      e.reduction ? `reduces each hit by ${e.reduction}` : '',
      e.resist?.length ? `resists ${e.resist.join(', ')}` : '',
      e.vulnerable?.length ? `vulnerable to ${e.vulnerable.join(', ')}` : '',
    ].filter(Boolean).join(', ') || 'No change';
    case 'language': return `Speak ${e.language.charAt(0).toUpperCase()}${e.language.slice(1)} while equipped`;
    case 'strange': return e.text;
  }
};

export const describeUpgradeDrawback = (d: UpgradeDrawback): string => {
  switch (d.type) {
    case 'statPenalty': return `${modsText(d.mods, true)} while equipped`;
    case 'destroyOnUnequip': return 'Turns to dust if unequipped';
    case 'locked': return "Can't be unequipped (the DM can lift it)";
    case 'cost': return `Costs ${[d.hp ? `${d.hp} HP` : '', d.mana ? `${d.mana} mana` : ''].filter(Boolean).join(' and ') || 'nothing'} per use`;
    case 'strange': return d.text;
  }
};

export const isCursed = (upgrades?: ItemUpgrade[]) => (upgrades ?? []).some(u => u.drawback);
export const hasDrawback = (upgrades: ItemUpgrade[] | undefined, type: UpgradeDrawback['type']) =>
  (upgrades ?? []).some(u => u.drawback?.type === type);
/** Extra HP and mana a weapon attack or spell cast costs because of cursed bargains. */
export const upgradeUseCost = (upgrades?: ItemUpgrade[]) => (upgrades ?? []).reduce(
  (sum, u) => u.drawback?.type === 'cost' ? { hp: sum.hp + (u.drawback.hp ?? 0), mana: sum.mana + (u.drawback.mana ?? 0) } : sum,
  { hp: 0, mana: 0 },
);

/** Gives an upgrade to a crawler's copy of an item, changing its numbers. Returns the new item. */
export const applyUpgradeToItem = (item: InventoryItem, upgrade: ItemUpgrade): InventoryItem => {
  const before: Record<string, unknown> = {};
  for (const f of UNDO_FIELDS) if (item[f] !== undefined) before[f] = JSON.parse(JSON.stringify(item[f]));
  const next: InventoryItem = { ...item, weaponData: item.weaponData ? { ...item.weaponData, damageDice: [...item.weaponData.damageDice] } : undefined };
  const wd = next.weaponData;
  for (const e of upgrade.effects) {
    switch (e.type) {
      case 'dice':
        if (!wd) { next.effects = appendLine(next.effects, describeUpgradeEffect(e)); break; }
        if (e.target === 'damage') {
          if (e.step && wd.damageDice.length > 0) wd.damageDice[0] = stepDie(wd.damageDice[0], e.step);
          if (e.addDie) wd.damageDice = addDieTo(wd.damageDice, e.addDie);
        } else {
          if (e.step && wd.hitDie) wd.hitDie = stepDie(wd.hitDie, e.step);
          if (e.addDie) wd.hitDie = wd.hitDie && wd.hitDie.sides === e.addDie.sides ? { ...wd.hitDie, count: wd.hitDie.count + e.addDie.count } : wd.hitDie ?? { ...e.addDie };
        }
        break;
      case 'property':
        if (!wd) { next.effects = appendLine(next.effects, describeUpgradeEffect(e)); break; }
        if (e.rangeFt) {
          if (wd.isRanged) { wd.normalRange = (wd.normalRange ?? 0) + e.rangeFt; wd.maxRange = (wd.maxRange ?? wd.normalRange) + e.rangeFt; }
          else wd.specialEffect = appendLine(wd.specialEffect, `Reach +${e.rangeFt} ft`);
        }
        if (e.damageType && (DAMAGE_TYPES as readonly string[]).includes(e.damageType)) wd.damageType = e.damageType as typeof wd.damageType;
        if (e.splash) wd.splashDamage = true;
        break;
      case 'stat':
        next.statModifiers = addMods(next.statModifiers, e.mods);
        break;
      case 'onHit':
        if (wd) wd.specialEffect = appendLine(wd.specialEffect, describeUpgradeEffect(e));
        else next.effects = appendLine(next.effects, describeUpgradeEffect(e));
        break;
      case 'defense':
        next.armorData = {
          ...next.armorData,
          rating: (next.armorData?.rating ?? 0) + (e.armorRating ?? 0) || undefined,
          reduction: (next.armorData?.reduction ?? 0) + (e.reduction ?? 0) || undefined,
          resist: e.resist?.length ? [...new Set([...(next.armorData?.resist ?? []), ...e.resist])] : next.armorData?.resist,
          vulnerable: e.vulnerable?.length ? [...new Set([...(next.armorData?.vulnerable ?? []), ...e.vulnerable])] : next.armorData?.vulnerable,
        };
        break;
      case 'language':
        next.grantsLanguage = e.language;
        break;
      case 'action':
      case 'strange':
        next.effects = appendLine(next.effects, describeUpgradeEffect(e));
        break;
    }
  }
  if (upgrade.drawback?.type === 'statPenalty') next.statModifiers = addMods(next.statModifiers, upgrade.drawback.mods, true);
  if (!next.weaponData) delete next.weaponData;
  if (upgrade.newName?.trim()) next.name = upgrade.newName.trim();
  return { ...next, isUpgraded: true, upgrades: [...(item.upgrades ?? []), { ...upgrade, before }] };
};

/** Takes back the item's most recent upgrade, restoring the numbers it changed. */
export const undoLastItemUpgrade = (item: InventoryItem): InventoryItem => {
  const last = item.upgrades?.[item.upgrades.length - 1];
  if (!last) return item;
  const next: InventoryItem = { ...item, upgrades: item.upgrades!.slice(0, -1) };
  for (const f of UNDO_FIELDS) {
    if (last.before && f in last.before) (next as unknown as Record<string, unknown>)[f] = last.before[f];
    else delete (next as unknown as Record<string, unknown>)[f];
  }
  if (next.upgrades!.length === 0) delete next.upgrades;
  return next;
};

/** A spell with this crawler's upgrades applied (the library spell itself never changes). */
export const applyUpgradesToSpell = (spell: Spell, upgrades?: ItemUpgrade[]): Spell => {
  if (!upgrades?.length) return spell;
  const sd = { ...spell.spellData, damageDice: spell.spellData.damageDice ? [...spell.spellData.damageDice] : undefined };
  const note = (line: string) => { sd.specialEffect = appendLine(sd.specialEffect, line); };
  for (const u of upgrades) {
    for (const e of u.effects) {
      switch (e.type) {
        case 'dice':
          if (e.target === 'damage') {
            if (e.step && sd.damageDice?.length) sd.damageDice[0] = stepDie(sd.damageDice[0], e.step);
            if (e.addDie) sd.damageDice = addDieTo(sd.damageDice ?? [], e.addDie);
          } else {
            if (e.step && sd.hitDie) sd.hitDie = stepDie(sd.hitDie, e.step);
            if (e.addDie) sd.hitDie = sd.hitDie && sd.hitDie.sides === e.addDie.sides ? { ...sd.hitDie, count: sd.hitDie.count + e.addDie.count } : sd.hitDie ?? { ...e.addDie };
          }
          break;
        case 'property':
          if (e.rangeFt && typeof sd.range === 'number') sd.range += e.rangeFt;
          if (e.damageType && (SPELL_DAMAGE_TYPES as readonly string[]).includes(e.damageType)) sd.damageType = e.damageType as typeof sd.damageType;
          if (e.splash) sd.splashDamage = true;
          if (e.durationTurns) sd.duration = { ...sd.duration, combatTurns: (sd.duration?.combatTurns ?? 0) + e.durationTurns };
          break;
        case 'language':
          sd.grantsLanguage = e.language;
          break;
        default:
          note(describeUpgradeEffect(e));
      }
    }
    if (u.drawback?.type === 'cost' && u.drawback.mana) sd.manaCost += u.drawback.mana;
  }
  const renamed = [...upgrades].reverse().find(u => u.newName?.trim())?.newName?.trim();
  return { ...spell, ...(renamed ? { name: renamed } : {}), spellData: sd };
};

/** The spell a crawler actually casts: library (or one-off) spell plus their upgrades. */
export const resolveKnownSpell = (ks: KnownSpell, library: Spell[]): Spell | undefined => {
  const base = library.find(s => s.id === ks.spellId) ?? ks.customSpell;
  return base && applyUpgradesToSpell(base, ks.upgrades);
};

/** Achievements for a crawler's first upgrade of each kind, and their first cursed bargain. */
export const FIRST_UPGRADE_ACHIEVEMENTS: Partial<Record<UpgradeKind, { name: string; description: string }>> = {
  weapon: { name: 'Sharpened', description: 'Upgraded a weapon for the first time' },
  armor: { name: 'Hardened', description: 'Upgraded a piece of armor for the first time' },
  spell: { name: 'Spellwright', description: 'Upgraded a spell for the first time' },
};
export const CURSED_BARGAIN_ACHIEVEMENT = { name: 'Deal With the Devil', description: 'Took a cursed bargain' };

export const upgradeKindOf = (target: InventoryItem | 'spell'): UpgradeKind => target === 'spell' ? 'spell' : getUpgradeKind(target);
