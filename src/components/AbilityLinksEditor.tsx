import React, { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { DungeonButton } from "@/components/ui/DungeonButton";
import PixelIcon from "@/components/ui/PixelIcon";
import {
  ABILITY_USES,
  CHECK_DIFFICULTIES,
  type Ability,
  type AbilityLink,
  type AbilityTweaks,
  type AbilityUses,
  type CheckDifficultyId,
} from "@/lib/gameData";
import {
  applyAbilityTweaks,
  copyWithTweaks,
  describeAbilityEffect,
  describeAbilityRoll,
  describeAbilityUses,
  findAbility,
  hasTweaks,
  summarizeAbility,
} from "@/lib/abilities";

const inputClass = "bg-muted border border-border px-2 py-1 text-xs w-full";
const labelClass = "text-[10px] text-muted-foreground block mb-0.5";

const numOrUndefined = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
};

interface LinkRowProps {
  link: AbilityLink;
  base: Ability | undefined;
  iconSrc?: string;
  onChange: (link: AbilityLink) => void;
  onRemove: () => void;
  onMakeCopy?: () => void;
}

const LinkRow: React.FC<LinkRowProps> = ({ link, base, iconSrc, onChange, onRemove, onMakeCopy }) => {
  const [open, setOpen] = useState(false);
  if (!base) {
    return (
      <div className="flex items-center justify-between border border-destructive/50 px-2 py-1 text-xs">
        <span className="text-destructive">Missing ability (deleted from the library)</span>
        <button type="button" onClick={onRemove} aria-label="Remove link" className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
      </div>
    );
  }
  const tweaks = link.tweaks ?? {};
  const resolved = applyAbilityTweaks(base, link.tweaks);
  const changed = hasTweaks(link);
  const firstDice = base.effects.find(e => e.type === 'dice');
  const firstCondition = base.effects.find(e => e.type === 'condition');
  const setTweak = (updates: Partial<AbilityTweaks>) => {
    const next: AbilityTweaks = { ...tweaks, ...updates };
    for (const k of Object.keys(next) as (keyof AbilityTweaks)[]) if (next[k] === undefined) delete next[k];
    onChange({ ...link, tweaks: Object.keys(next).length ? next : undefined });
  };

  return (
    <div className="border border-border/60 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <PixelIcon src={iconSrc} alt={base.name} fallback={<Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />} />
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
          <span className="text-xs font-display text-primary">{base.name}</span>
          {changed && <span className="ml-1 text-[9px] border border-accent/60 text-accent px-1">changed</span>}
          <span className="block text-[10px] text-muted-foreground truncate">{summarizeAbility(resolved)}</span>
        </button>
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Hide tweaks' : 'Tweak'} className="text-muted-foreground hover:text-primary">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove link" className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          <p className="text-[10px] text-muted-foreground">
            Small changes for this link only. The library ability stays as it is. Blank = same as the original.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {firstDice?.type === 'dice' && firstDice.dice[0] && (
              <div>
                <label className={labelClass}>Dice (was {firstDice.dice[0].count}d{firstDice.dice[0].sides})</label>
                <input type="number" min={0} value={tweaks.diceCount ?? ''} placeholder={String(firstDice.dice[0].count)}
                  onChange={(e) => setTweak({ diceCount: numOrUndefined(e.target.value) })} className={inputClass} />
              </div>
            )}
            {base.roll && (
              <div>
                <label className={labelClass}>Difficulty</label>
                <select value={tweaks.difficulty ?? ''} onChange={(e) => setTweak({ difficulty: (e.target.value || undefined) as CheckDifficultyId | undefined })} className={inputClass}>
                  <option value="">Same as original</option>
                  {CHECK_DIFFICULTIES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>How often</label>
              <select value={tweaks.uses ?? ''} onChange={(e) => setTweak({ uses: (e.target.value || undefined) as AbilityUses | undefined })} className={inputClass}>
                <option value="">Same ({describeAbilityUses(base)})</option>
                {ABILITY_USES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            {resolved.uses !== 'atWill' && (
              <div>
                <label className={labelClass}>Times</label>
                <input type="number" min={1} value={tweaks.usesCount ?? ''} placeholder={String(base.usesCount ?? 1)}
                  onChange={(e) => setTweak({ usesCount: numOrUndefined(e.target.value) })} className={inputClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>Mana cost</label>
              <input type="number" min={0} value={tweaks.mana ?? ''} placeholder={String(base.cost?.mana ?? 0)}
                onChange={(e) => setTweak({ mana: numOrUndefined(e.target.value) })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>HP cost</label>
              <input type="number" min={0} value={tweaks.hp ?? ''} placeholder={String(base.cost?.hp ?? 0)}
                onChange={(e) => setTweak({ hp: numOrUndefined(e.target.value) })} className={inputClass} />
            </div>
            {firstCondition?.type === 'condition' && (
              <div>
                <label className={labelClass}>{firstCondition.condition} turns</label>
                <input type="number" min={1} value={tweaks.turns ?? ''} placeholder={String(firstCondition.turns)}
                  onChange={(e) => setTweak({ turns: numOrUndefined(e.target.value) })} className={inputClass} />
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Note (optional)</label>
            <input value={link.note ?? ''} placeholder="Only works in darkness" onChange={(e) => onChange({ ...link, note: e.target.value || undefined })} className={inputClass} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {changed && (
              <DungeonButton type="button" variant="ghost" size="sm" onClick={() => onChange({ ...link, tweaks: undefined })} className="text-xs flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </DungeonButton>
            )}
            {onMakeCopy && (
              <DungeonButton type="button" variant="ghost" size="sm" onClick={onMakeCopy} className="text-xs flex items-center gap-1"
                title="Need a bigger change? Copy it to the library (with these tweaks) and edit the copy on the Abilities page">
                <Copy className="w-3 h-3" /> Make my own copy
              </DungeonButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface AbilityLinksEditorProps {
  links: AbilityLink[] | undefined;
  onChange: (links: AbilityLink[]) => void;
  library: Ability[];
  iconImages?: Record<string, string>;
  /** Saves a new library ability (a copy); the link then points at it. */
  onCreateAbility?: (ability: Ability) => Promise<void>;
  /** "item" or "spell", for the hint text */
  kind: 'item' | 'spell';
}

/** Pick library abilities for an item or spell, with small per-link tweaks. */
const AbilityLinksEditor: React.FC<AbilityLinksEditorProps> = ({ links, onChange, library, iconImages = {}, onCreateAbility, kind }) => {
  const [pick, setPick] = useState('');
  const current = links ?? [];
  const options = [...library].sort((a, b) => a.name.localeCompare(b.name));
  const linkedIds = new Set(current.map(l => l.abilityId));
  // An empty list (not undefined) so a merge-update clears links that were removed
  const set = (next: AbilityLink[]) => onChange(next);

  const makeCopy = async (index: number) => {
    const link = current[index];
    const base = findAbility(library, link.abilityId);
    if (!base || !onCreateAbility) return;
    const copy = copyWithTweaks(base, link);
    await onCreateAbility(copy);
    set(current.map((l, i) => (i === index ? { abilityId: copy.id, ...(l.note ? { note: l.note } : {}) } : l)));
  };

  return (
    <div className="space-y-2 border border-border/60 p-2">
      <div className="flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-display text-primary">Abilities</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {kind === 'item'
          ? 'Crawlers get these while the item is equipped (or while carried, if it has no slot).'
          : 'Crawlers who know this spell get these.'} Make new ones on the Abilities page.
      </p>
      {current.map((link, i) => {
        const base = findAbility(library, link.abilityId);
        return (
          <LinkRow
            key={`${link.abilityId}-${i}`}
            link={link}
            base={base}
            iconSrc={base?.iconId ? iconImages[base.iconId] : undefined}
            onChange={(next) => set(current.map((l, j) => (j === i ? next : l)))}
            onRemove={() => set(current.filter((_, j) => j !== i))}
            onMakeCopy={onCreateAbility && base ? () => void makeCopy(i) : undefined}
          />
        );
      })}
      <div className="flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputClass} aria-label="Ability to link">
          <option value="">Link an ability...</option>
          {options.filter(a => !linkedIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <DungeonButton type="button" variant="ghost" size="sm" disabled={!pick} aria-label="Add ability link"
          onClick={() => { if (pick) { set([...current, { abilityId: pick }]); setPick(''); } }}>
          <Plus className="w-3 h-3" />
        </DungeonButton>
      </div>
    </div>
  );
};

export default AbilityLinksEditor;
