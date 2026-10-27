import React from "react";
import { Shield } from "lucide-react";
import { DAMAGE_TYPES, WEAPON_TYPES, type ArmorData } from "@/lib/gameData";

const KINDS: string[] = [...DAMAGE_TYPES, ...WEAPON_TYPES];

/** Armor numbers for a worn item: rating (adds to the wearer's DC), flat reduction per hit, and what it resists or is weak to. */
export const ArmorEditor: React.FC<{
  value?: ArmorData;
  onChange: (value: ArmorData | undefined) => void;
}> = ({ value, onChange }) => {
  const set = (updates: Partial<ArmorData>) => {
    const next: ArmorData = { ...value, ...updates };
    const empty = !next.rating && !next.reduction && !next.resist?.length && !next.vulnerable?.length;
    onChange(empty ? undefined : next);
  };
  const toggle = (key: 'resist' | 'vulnerable', kind: string) => {
    const list = value?.[key] ?? [];
    set({ [key]: list.includes(kind) ? list.filter(k => k !== kind) : [...list, kind] });
  };
  const num = (v: string) => (v ? Math.max(0, parseInt(v) || 0) : undefined);

  return (
    <div className="border border-primary/30 bg-primary/5 p-3 rounded space-y-3">
      <p className="text-xs font-display text-primary flex items-center gap-1"><Shield className="w-3 h-3" /> Armor</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground space-y-1">
          <span>Armor rating (adds to DC)</span>
          <input type="number" min={0} value={value?.rating ?? ""} onChange={(e) => set({ rating: num(e.target.value) })}
            className="w-full bg-muted border border-border px-2 py-1 text-sm text-foreground" placeholder="0" />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span>Damage reduction per hit</span>
          <input type="number" min={0} value={value?.reduction ?? ""} onChange={(e) => set({ reduction: num(e.target.value) })}
            className="w-full bg-muted border border-border px-2 py-1 text-sm text-foreground" placeholder="0" />
        </label>
      </div>
      {(['resist', 'vulnerable'] as const).map(key => (
        <div key={key} className="space-y-1">
          <p className="text-xs text-muted-foreground">{key === 'resist' ? 'Resists (half damage)' : 'Vulnerable to (double damage)'}</p>
          <div className="flex flex-wrap gap-1">
            {KINDS.map(kind => {
              const on = value?.[key]?.includes(kind);
              return (
                <button key={kind} type="button" onClick={() => toggle(key, kind)}
                  className={`px-2 py-0.5 rounded text-[11px] border ${on
                    ? (key === 'resist' ? 'bg-primary/30 border-primary text-primary' : 'bg-destructive/30 border-destructive text-destructive')
                    : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {kind}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
