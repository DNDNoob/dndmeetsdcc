import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { DEFAULT_UPGRADE_XP, UPGRADE_XP_SOURCE_LABELS, resolveUpgradeXp, type UpgradeKind, type UpgradeXpSettings, type UpgradeXpSource } from "@/lib/gameData";

/** Upgrade XP section of the item and spell editors, filled in with the defaults for that kind of item. */
export const UpgradeXpEditor: React.FC<{
  kind: UpgradeKind;
  value: UpgradeXpSettings | undefined;
  onChange: (value: UpgradeXpSettings | undefined) => void;
}> = ({ kind, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const resolved = resolveUpgradeXp(kind, value);
  const [milestoneText, setMilestoneText] = useState(resolved.milestones.join(', '));
  const milestoneKey = resolved.milestones.join(',');
  useEffect(() => { setMilestoneText(milestoneKey.split(',').join(', ')); }, [milestoneKey]);

  const sources = kind === 'none' ? [] : (Object.keys(DEFAULT_UPGRADE_XP[kind]) as UpgradeXpSource[]);
  const update = (changes: Partial<UpgradeXpSettings>) => onChange({ ...value, ...changes });
  const commitMilestones = () => {
    const milestones = milestoneText.split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
    if (milestones.length > 0) update({ milestones: [...new Set(milestones)].sort((a, b) => a - b) });
    else setMilestoneText(resolved.milestones.join(', '));
  };

  return (
    <div className="border border-accent/30 bg-accent/5 p-2 space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 text-xs text-accent font-display">
        <TrendingUp className="w-4 h-4" />
        UPGRADE XP
        <span className="text-[10px] text-muted-foreground font-sans normal-case">{resolved.enabled ? `levels up at ${resolved.milestones.join(' / ')} XP` : 'off'}</span>
        {open ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>
      {open && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={resolved.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="w-4 h-4" />
            <span className="text-muted-foreground">Can upgrade</span>
          </label>
          {resolved.enabled && (
            <>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-0.5">Milestones (total XP for each tier)</label>
                <input
                  type="text"
                  value={milestoneText}
                  onChange={(e) => setMilestoneText(e.target.value)}
                  onBlur={commitMilestones}
                  className="bg-muted border border-border px-2 py-1 text-xs w-full"
                />
              </div>
              {sources.length > 0 && (
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">XP earned</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {sources.map(src => (
                      <label key={src} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <input
                          type="number"
                          min={0}
                          value={resolved[src] ?? 0}
                          onChange={(e) => update({ [src]: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-14 bg-muted border border-border px-1 py-0.5 text-xs text-center"
                        />
                        {UPGRADE_XP_SOURCE_LABELS[src]}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {value && (
                <button type="button" onClick={() => onChange(undefined)} className="text-[10px] text-primary hover:underline">
                  Reset to recommended values
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
