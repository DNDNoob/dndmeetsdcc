import React, { useState } from "react";
import { Plus, Sparkles, Undo2, X } from "lucide-react";
import {
  DAMAGE_TYPES, SPELL_DAMAGE_TYPES, WEAPON_TYPES, getUpgradeKind, baseItemName,
  type Crawler, type InventoryItem, type ItemUpgrade, type Spell, type StatModifiers, type UpgradeDrawback,
  type UpgradeEffect, type UpgradeEffectType, type UpgradeKind, type WeaponDie,
} from "@/lib/gameData";
import {
  UPGRADE_DRAWBACK_LABELS, UPGRADE_EFFECT_LABELS, UPGRADE_EFFECTS_FOR, describeUpgradeDrawback, describeUpgradeEffect,
} from "@/lib/upgrades";
import type { UpgradeTarget } from "@/hooks/useGameState";
import { LanguageSelect } from "@/components/LanguagePicker";
import { UpgradeList } from "@/components/UpgradeList";
import { ItemName } from "@/components/ItemName";
import { DungeonButton } from "@/components/ui/DungeonButton";

interface UpgradeGiverProps {
  crawlers: Crawler[];
  spells: Spell[];
  getCrawlerInventory: (crawlerId: string) => InventoryItem[];
  onGive: (crawlerId: string, target: UpgradeTarget, upgrade: ItemUpgrade) => Promise<void> | void;
  onUndo: (crawlerId: string, target: UpgradeTarget) => Promise<void> | void;
}

const inputCls = "bg-muted border border-border px-2 py-1 text-xs w-full";
const STAT_KEYS: (keyof StatModifiers)[] = ['str', 'dex', 'con', 'int', 'cha', 'maxHP', 'maxMana', 'moveSpeed'];
const STAT_LABELS: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', cha: 'CHA', maxHP: 'Max HP', maxMana: 'Max mana', moveSpeed: 'Speed ft' };
const DIE_SIDES = [4, 6, 8, 10, 12, 20];
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
const list = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

const newEffect = (type: UpgradeEffectType): UpgradeEffect => {
  switch (type) {
    case 'dice': return { type, target: 'damage', step: 1 };
    case 'property': return { type };
    case 'stat': return { type, mods: { str: 1 } };
    case 'onHit': return { type, chance: 25, condition: 'Burning', turns: 2 };
    case 'action': return { type, name: '', uses: 'perCombat' };
    case 'defense': return { type, armorRating: 1 };
    case 'language': return { type, language: '' };
    case 'strange': return { type, text: '' };
  }
};
const newDrawback = (type: UpgradeDrawback['type']): UpgradeDrawback => {
  switch (type) {
    case 'statPenalty': return { type, mods: { dex: 1 } };
    case 'cost': return { type, hp: 2 };
    case 'strange': return { type, text: '' };
    default: return { type };
  }
};

/** Drops empty fields so a half-filled effect doesn't save zeros or blank names. Null when nothing is left. */
const cleanEffect = (e: UpgradeEffect): UpgradeEffect | null => {
  const die = (d?: WeaponDie) => (d && d.count > 0 ? d : undefined);
  const mods = (m: StatModifiers) => Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as StatModifiers;
  switch (e.type) {
    case 'dice': { const c = { ...e, step: e.step || undefined, addDie: die(e.addDie) }; return c.step || c.addDie ? c : null; }
    case 'property': { const c = { ...e, rangeFt: e.rangeFt || undefined, damageType: e.damageType || undefined, splash: e.splash || undefined, durationTurns: e.durationTurns || undefined }; return c.rangeFt || c.damageType || c.splash || c.durationTurns ? c : null; }
    case 'stat': { const m = mods(e.mods); return Object.keys(m).length ? { ...e, mods: m } : null; }
    case 'onHit': return e.chance > 0 && (e.condition?.trim() || die(e.extraDie)) ? { ...e, condition: e.condition?.trim() || undefined, turns: e.turns || undefined, extraDie: die(e.extraDie) } : null;
    case 'action': return e.name.trim() ? { ...e, name: e.name.trim(), damage: die(e.damage), text: e.text?.trim() || undefined } : null;
    case 'defense': { const c = { ...e, armorRating: e.armorRating || undefined, reduction: e.reduction || undefined, resist: e.resist?.length ? e.resist : undefined, vulnerable: e.vulnerable?.length ? e.vulnerable : undefined }; return c.armorRating || c.reduction || c.resist || c.vulnerable ? c : null; }
    case 'language': return e.language ? e : null;
    case 'strange': return e.text.trim() ? { ...e, text: e.text.trim() } : null;
  }
};
const cleanDrawback = (d?: UpgradeDrawback): UpgradeDrawback | undefined => {
  if (!d) return undefined;
  if (d.type === 'statPenalty') { const m = Object.fromEntries(Object.entries(d.mods).filter(([, v]) => v)) as StatModifiers; return Object.keys(m).length ? { ...d, mods: m } : undefined; }
  if (d.type === 'cost') return d.hp || d.mana ? { type: 'cost', hp: d.hp || undefined, mana: d.mana || undefined } : undefined;
  if (d.type === 'strange') return d.text.trim() ? { ...d, text: d.text.trim() } : undefined;
  return d;
};

const DieInput: React.FC<{ label: string; value?: WeaponDie; onChange: (d?: WeaponDie) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
    <div className="flex items-center gap-1">
      <input type="number" min={0} value={value?.count ?? 0} onChange={(e) => onChange({ count: Math.max(0, Number(e.target.value) || 0), sides: value?.sides ?? 6 })} className={`${inputCls} w-14`} />
      <span className="text-xs text-muted-foreground">d</span>
      <select value={value?.sides ?? 6} onChange={(e) => onChange({ count: value?.count ?? 0, sides: Number(e.target.value) })} className={`${inputCls} w-16`}>
        {DIE_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  </div>
);

const ModsInput: React.FC<{ value: StatModifiers; onChange: (m: StatModifiers) => void; penalty?: boolean }> = ({ value, onChange, penalty }) => (
  <div className="grid grid-cols-4 gap-1">
    {STAT_KEYS.map(k => (
      <label key={k} className="text-[10px] text-muted-foreground">
        {STAT_LABELS[k]}{penalty ? ' −' : ''}
        <input type="number" value={value[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: num(e.target.value) })} className={inputCls} />
      </label>
    ))}
  </div>
);

/** The fields for one effect, by type. */
const EffectFields: React.FC<{ effect: UpgradeEffect; kind: UpgradeKind; onChange: (e: UpgradeEffect) => void }> = ({ effect: e, kind, onChange }) => {
  switch (e.type) {
    case 'dice': return (
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Which dice</label>
          <select value={e.target} onChange={(ev) => onChange({ ...e, target: ev.target.value as 'damage' | 'hit' })} className={inputCls}>
            <option value="damage">Damage</option>
            <option value="hit">Hit die</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-0.5">Die sizes up</label>
          <input type="number" min={-5} max={5} value={e.step ?? 0} onChange={(ev) => onChange({ ...e, step: Number(ev.target.value) || 0 })} className={inputCls} />
        </div>
        <DieInput label="Add dice" value={e.addDie} onChange={(addDie) => onChange({ ...e, addDie })} />
      </div>
    );
    case 'property': return (
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">Extra range (ft)
          <input type="number" min={0} value={e.rangeFt ?? ''} onChange={(ev) => onChange({ ...e, rangeFt: num(ev.target.value) })} className={inputCls} />
        </label>
        <label className="text-[10px] text-muted-foreground">Damage type
          <select value={e.damageType ?? ''} onChange={(ev) => onChange({ ...e, damageType: ev.target.value || undefined })} className={inputCls}>
            <option value="">No change</option>
            {(kind === 'spell' ? SPELL_DAMAGE_TYPES : DAMAGE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <input type="checkbox" checked={!!e.splash} onChange={(ev) => onChange({ ...e, splash: ev.target.checked || undefined })} /> Splash damage
        </label>
        {kind === 'spell' && (
          <label className="text-[10px] text-muted-foreground">Extra combat turns
            <input type="number" min={0} value={e.durationTurns ?? ''} onChange={(ev) => onChange({ ...e, durationTurns: num(ev.target.value) })} className={inputCls} />
          </label>
        )}
      </div>
    );
    case 'stat': return <ModsInput value={e.mods} onChange={(mods) => onChange({ ...e, mods })} />;
    case 'onHit': return (
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">Chance %
          <input type="number" min={1} max={100} value={e.chance} onChange={(ev) => onChange({ ...e, chance: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })} className={inputCls} />
        </label>
        <label className="text-[10px] text-muted-foreground">Condition
          <input value={e.condition ?? ''} onChange={(ev) => onChange({ ...e, condition: ev.target.value })} className={inputCls} placeholder="Burning" />
        </label>
        <label className="text-[10px] text-muted-foreground">For turns
          <input type="number" min={0} value={e.turns ?? ''} onChange={(ev) => onChange({ ...e, turns: num(ev.target.value) })} className={inputCls} />
        </label>
        <DieInput label="Extra damage" value={e.extraDie} onChange={(extraDie) => onChange({ ...e, extraDie })} />
      </div>
    );
    case 'action': return (
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">Action name
          <input value={e.name} onChange={(ev) => onChange({ ...e, name: ev.target.value })} className={inputCls} placeholder="Shatter Swing" />
        </label>
        <label className="text-[10px] text-muted-foreground">How often
          <select value={e.uses} onChange={(ev) => onChange({ ...e, uses: ev.target.value as typeof e.uses })} className={inputCls}>
            <option value="perCombat">Once per combat</option>
            <option value="perDay">Once per day</option>
            <option value="atWill">At will</option>
          </select>
        </label>
        <DieInput label="Damage" value={e.damage} onChange={(damage) => onChange({ ...e, damage })} />
        <label className="text-[10px] text-muted-foreground">What it does
          <input value={e.text ?? ''} onChange={(ev) => onChange({ ...e, text: ev.target.value })} className={inputCls} placeholder="Hits everyone within 5 ft" />
        </label>
      </div>
    );
    case 'defense': return (
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">Armor rating +
          <input type="number" min={0} value={e.armorRating ?? ''} onChange={(ev) => onChange({ ...e, armorRating: num(ev.target.value) })} className={inputCls} />
        </label>
        <label className="text-[10px] text-muted-foreground">Reduce each hit by
          <input type="number" min={0} value={e.reduction ?? ''} onChange={(ev) => onChange({ ...e, reduction: num(ev.target.value) })} className={inputCls} />
        </label>
        <label className="text-[10px] text-muted-foreground">Resists (comma separated)
          <input value={(e.resist ?? []).join(', ')} onChange={(ev) => onChange({ ...e, resist: list(ev.target.value) })} className={inputCls} placeholder="Bows, Crossbows" />
        </label>
        <label className="text-[10px] text-muted-foreground">Vulnerable to
          <input value={(e.vulnerable ?? []).join(', ')} onChange={(ev) => onChange({ ...e, vulnerable: list(ev.target.value) })} className={inputCls} placeholder="Fire" />
        </label>
        <p className="col-span-2 text-[10px] text-muted-foreground">Types: {[...DAMAGE_TYPES, ...WEAPON_TYPES].join(', ')}. Armor numbers start counting in combat once armor rules ship.</p>
      </div>
    );
    case 'language': return (
      <LanguageSelect value={e.language || undefined} onChange={(id) => onChange({ ...e, language: id ?? '' })} noneLabel="Pick a language" optionLabel={(name) => `Speak ${name} while equipped`} ariaLabel="Language" className={inputCls} />
    );
    case 'strange': return (
      <input value={e.text} onChange={(ev) => onChange({ ...e, text: ev.target.value })} className={inputCls} placeholder="Whispers the name of the nearest hidden mob once per day" />
    );
  }
};

/** DM Console: give a crawler's item or known spell an upgrade by hand, or take back the latest one. */
export const UpgradeGiver: React.FC<UpgradeGiverProps> = ({ crawlers, spells, getCrawlerInventory, onGive, onUndo }) => {
  const [crawlerId, setCrawlerId] = useState(crawlers[0]?.id ?? '');
  const [targetKey, setTargetKey] = useState('');
  const [name, setName] = useState('');
  const [flavor, setFlavor] = useState('');
  const [effects, setEffects] = useState<UpgradeEffect[]>([]);
  const [drawback, setDrawback] = useState<UpgradeDrawback | undefined>();
  const [saving, setSaving] = useState(false);

  const crawler = crawlers.find(c => c.id === crawlerId);
  // Read fresh every render: giving an upgrade changes the inventory, not the crawler
  const items = crawler ? getCrawlerInventory(crawler.id).filter(i => getUpgradeKind(i) !== 'none') : [];
  const knownSpells = crawler?.knownSpells ?? [];
  const [targetKind, targetId] = targetKey.split(':') as ['item' | 'spell' | '', string];
  const item = targetKind === 'item' ? items.find(i => i.id === targetId) : undefined;
  const knownSpell = targetKind === 'spell' ? knownSpells.find(k => k.spellId === targetId) : undefined;
  const target: UpgradeTarget | null = item ? { kind: 'item', id: item.id } : knownSpell ? { kind: 'spell', id: knownSpell.spellId } : null;
  const kind: UpgradeKind = item ? getUpgradeKind(item) : knownSpell ? 'spell' : 'none';
  const existing = item?.upgrades ?? knownSpell?.upgrades ?? [];
  const cleaned = effects.map(cleanEffect).filter((e): e is UpgradeEffect => !!e);
  const cleanedDrawback = cleanDrawback(drawback);
  const canGive = !!target && !!name.trim() && (cleaned.length > 0 || !!cleanedDrawback) && !saving;

  const reset = () => { setName(''); setFlavor(''); setEffects([]); setDrawback(undefined); };
  const give = async () => {
    if (!canGive || !target) return;
    setSaving(true);
    try {
      await onGive(crawlerId, target, {
        id: crypto.randomUUID(),
        name: name.trim(),
        flavor: flavor.trim() || undefined,
        effects: cleaned,
        drawback: cleanedDrawback,
        source: 'dm',
        appliedAt: new Date().toISOString(),
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-muted/30 border border-border p-4 space-y-4">
      <div>
        <h3 className="font-display text-accent text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" /> Give an Upgrade</h3>
        <p className="text-xs text-muted-foreground">Upgrade one crawler's copy of an item or spell by hand. Number changes apply right away. On-hit chances, new actions and strange effects are written on the item for you to rule on.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">Crawler
          <select value={crawlerId} onChange={(e) => { setCrawlerId(e.target.value); setTargetKey(''); }} className={inputCls}>
            {crawlers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground">Item or spell
          <select value={targetKey} onChange={(e) => { setTargetKey(e.target.value); setEffects([]); setDrawback(undefined); }} className={inputCls}>
            <option value="">Pick one…</option>
            {items.length > 0 && (
              <optgroup label="Items">
                {items.map(i => <option key={i.id} value={`item:${i.id}`}>{baseItemName(i)}{i.upgrades?.length ? ` (${i.upgrades.length} upgrade${i.upgrades.length === 1 ? '' : 's'})` : ''}</option>)}
              </optgroup>
            )}
            {knownSpells.length > 0 && (
              <optgroup label="Spells">
                {knownSpells.map(k => <option key={k.spellId} value={`spell:${k.spellId}`}>{k.spellName}</option>)}
              </optgroup>
            )}
          </select>
        </label>
      </div>
      {crawler && items.length === 0 && knownSpells.length === 0 && (
        <p className="text-xs text-muted-foreground">{crawler.name} has no equippable items or spells to upgrade.</p>
      )}

      {target && (
        <>
          {existing.length > 0 && (
            <div className="border border-border/60 p-2 space-y-2">
              <p className="text-xs">
                {item ? <ItemName item={item} /> : knownSpell!.spellName} already has {existing.length} upgrade{existing.length === 1 ? '' : 's'}:
              </p>
              <UpgradeList upgrades={existing} />
              <button onClick={() => crawler && onUndo(crawler.id, target)} className="text-[10px] text-destructive hover:underline flex items-center gap-1">
                <Undo2 className="w-3 h-3" /> Take back the latest upgrade
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-[10px] text-muted-foreground">Upgrade name *
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Heavy Edge" />
            </label>
            <label className="text-[10px] text-muted-foreground">Flavor text
              <input value={flavor} onChange={(e) => setFlavor(e.target.value)} className={inputCls} placeholder="e.g. It hums near the wounded." />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-primary font-display">EFFECTS</p>
            {effects.map((e, idx) => (
              <div key={idx} className="border border-border/60 p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-accent">{UPGRADE_EFFECT_LABELS[e.type]}</span>
                  <button onClick={() => setEffects(prev => prev.filter((_, i) => i !== idx))} aria-label="Remove effect"><X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
                <EffectFields effect={e} kind={kind} onChange={(next) => setEffects(prev => prev.map((p, i) => i === idx ? next : p))} />
                {cleanEffect(e) && <p className="text-[10px] text-muted-foreground">{describeUpgradeEffect(cleanEffect(e)!)}</p>}
              </div>
            ))}
            <select value="" onChange={(e) => e.target.value && setEffects(prev => [...prev, newEffect(e.target.value as UpgradeEffectType)])} className={inputCls} aria-label="Add effect">
              <option value="">+ Add an effect…</option>
              {UPGRADE_EFFECTS_FOR[kind].map(t => <option key={t} value={t}>{UPGRADE_EFFECT_LABELS[t]}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-destructive font-display">CURSED BARGAIN (OPTIONAL)</p>
            <select value={drawback?.type ?? ''} onChange={(e) => setDrawback(e.target.value ? newDrawback(e.target.value as UpgradeDrawback['type']) : undefined)} className={inputCls} aria-label="Drawback">
              <option value="">No drawback</option>
              {(Object.keys(UPGRADE_DRAWBACK_LABELS) as UpgradeDrawback['type'][]).map(t => <option key={t} value={t}>{UPGRADE_DRAWBACK_LABELS[t]}</option>)}
            </select>
            {drawback?.type === 'statPenalty' && <ModsInput penalty value={drawback.mods} onChange={(mods) => setDrawback({ type: 'statPenalty', mods })} />}
            {drawback?.type === 'cost' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-muted-foreground">HP per use
                  <input type="number" min={0} value={drawback.hp ?? ''} onChange={(e) => setDrawback({ ...drawback, hp: num(e.target.value) })} className={inputCls} />
                </label>
                <label className="text-[10px] text-muted-foreground">Mana per use
                  <input type="number" min={0} value={drawback.mana ?? ''} onChange={(e) => setDrawback({ ...drawback, mana: num(e.target.value) })} className={inputCls} />
                </label>
              </div>
            )}
            {drawback?.type === 'strange' && (
              <input value={drawback.text} onChange={(e) => setDrawback({ type: 'strange', text: e.target.value })} className={inputCls} placeholder="Speaks only in insults" />
            )}
            {cleanedDrawback && <p className="text-[10px] text-destructive">{describeUpgradeDrawback(cleanedDrawback)}</p>}
          </div>

          <DungeonButton variant="admin" onClick={give} disabled={!canGive} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> {saving ? 'Giving…' : `Give ${name.trim() || 'upgrade'}`}
          </DungeonButton>
        </>
      )}
    </div>
  );
};
