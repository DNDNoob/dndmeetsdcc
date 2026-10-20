import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Sparkles, Swords, Trash2, X } from "lucide-react";
import {
  DAMAGE_TYPES,
  SPELL_ACTION_TYPES,
  formatDamageDice,
  type DamageType,
  type Mob,
  type MobAttack,
  type Spell,
  type SpellActionType,
} from "@/lib/gameData";

interface MobCombatFieldsProps {
  value: Partial<Mob>;
  onChange: (next: Pick<Mob, "attacks" | "spellIds">) => void;
  /** The campaign spell library the DM picks mob spells from */
  spells: Spell[];
}

const DIE_SIDES = [4, 6, 8, 10, 12, 20];

const toInt = (raw: string, fallback = 0) => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
};

/** DM settings for what a mob can do in combat: natural attacks and spells. Equipped weapons are added on their own. */
export const MobCombatFields: React.FC<MobCombatFieldsProps> = ({ value, onChange, spells }) => {
  const attacks = value.attacks ?? [];
  const spellIds = value.spellIds ?? [];
  const [open, setOpen] = useState(attacks.length > 0 || spellIds.length > 0);

  const setAttacks = (next: MobAttack[]) => onChange({ attacks: next, spellIds });
  const setSpellIds = (next: string[]) => onChange({ attacks, spellIds: next });
  const updateAttack = (id: string, updates: Partial<MobAttack>) =>
    setAttacks(attacks.map(a => (a.id === id ? { ...a, ...updates } : a)));

  const addAttack = () => {
    setAttacks([
      ...attacks,
      { id: crypto.randomUUID(), name: "", actionType: "Action", hitBonus: 0, damageDice: [{ count: 1, sides: 6 }], damageBonus: 0, damageType: "Basic" },
    ]);
    setOpen(true);
  };

  const availableSpells = spells.filter(s => !spellIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  const inputClass = "w-full bg-muted border border-border px-2 py-1 text-xs";

  return (
    <div className="bg-muted/40 border border-border p-2 rounded">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Swords className="w-3 h-3" />
        Attacks &amp; Spells
        {(attacks.length > 0 || spellIds.length > 0) && (
          <span className="text-destructive font-normal">
            ({attacks.length} attack{attacks.length === 1 ? "" : "s"}, {spellIds.length} spell{spellIds.length === 1 ? "" : "s"})
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-[10px] text-muted-foreground">
            You roll these for the mob in combat from the panel in the top left of the Show Time map. Weapons it has equipped show up there too.
          </p>

          {attacks.map(a => {
            const die = a.damageDice[0] ?? { count: 1, sides: 6 };
            return (
              <div key={a.id} className="border border-destructive/30 bg-background/40 rounded p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Attack name (e.g. Claw)"
                    value={a.name}
                    onChange={(e) => updateAttack(a.id, { name: e.target.value })}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => setAttacks(attacks.filter(x => x.id !== a.id))} className="text-muted-foreground hover:text-destructive" title="Remove attack">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] text-muted-foreground">
                    Uses
                    <select value={a.actionType} onChange={(e) => updateAttack(a.id, { actionType: e.target.value as SpellActionType })} className={inputClass}>
                      {SPELL_ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    To-hit bonus
                    <input type="number" value={a.hitBonus ?? 0} onChange={(e) => updateAttack(a.id, { hitBonus: toInt(e.target.value) })} className={inputClass} />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Range (ft, blank = melee)
                    <input
                      type="number"
                      min={0}
                      value={a.range ?? ""}
                      onChange={(e) => updateAttack(a.id, { range: e.target.value === "" ? undefined : Math.max(0, toInt(e.target.value)) })}
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <label className="text-[10px] text-muted-foreground">
                    Dice
                    <input
                      type="number"
                      min={1}
                      value={die.count}
                      onChange={(e) => updateAttack(a.id, { damageDice: [{ count: Math.max(1, toInt(e.target.value, 1)), sides: die.sides }] })}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Die
                    <select
                      value={die.sides}
                      onChange={(e) => updateAttack(a.id, { damageDice: [{ count: die.count, sides: toInt(e.target.value, 6) }] })}
                      className={inputClass}
                    >
                      {DIE_SIDES.map(s => <option key={s} value={s}>d{s}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    + Damage
                    <input type="number" value={a.damageBonus ?? 0} onChange={(e) => updateAttack(a.id, { damageBonus: toInt(e.target.value) })} className={inputClass} />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Type
                    <select value={a.damageType ?? "Basic"} onChange={(e) => updateAttack(a.id, { damageType: e.target.value as DamageType })} className={inputClass}>
                      {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Notes (optional, e.g. target is knocked prone)"
                  value={a.notes ?? ""}
                  onChange={(e) => updateAttack(a.id, { notes: e.target.value || undefined })}
                  className={inputClass}
                />
                <p className="text-[10px] text-muted-foreground">
                  Rolls d20{a.hitBonus ? ` ${a.hitBonus > 0 ? "+" : "-"} ${Math.abs(a.hitBonus)}` : ""} to hit, then {formatDamageDice(a.damageDice, a.damageBonus)} damage.
                </p>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addAttack}
            className="w-full flex items-center justify-center gap-1 text-xs border border-dashed border-destructive/50 text-destructive py-1 rounded hover:bg-destructive/10"
          >
            <Plus className="w-3 h-3" /> Add attack
          </button>

          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Spells</label>
            {spellIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {spellIds.map(id => {
                  const spell = spells.find(s => s.id === id);
                  return (
                    <span key={id} className="flex items-center gap-1 text-xs bg-primary/10 border border-primary/40 text-primary px-2 py-0.5 rounded">
                      {spell?.name ?? "Deleted spell"}
                      <button type="button" onClick={() => setSpellIds(spellIds.filter(x => x !== id))} title="Remove spell">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {availableSpells.length > 0 ? (
              <select
                value=""
                onChange={(e) => { if (e.target.value) setSpellIds([...spellIds, e.target.value]); }}
                className={inputClass}
              >
                <option value="">Add a spell from the library…</option>
                {availableSpells.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.spellData.actionType})</option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-muted-foreground">{spells.length === 0 ? "No spells in the library yet. Make some in the Spells tab." : "It knows every spell in the library."}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobCombatFields;
