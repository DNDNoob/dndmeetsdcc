import React, { useState } from "react";
import { UPGRADE_XP_SOURCE_LABELS, getUpgradeTier, type UpgradeXpBreakdown } from "@/lib/gameData";

/** Gold XP bar for an upgradeable item or spell. Tap it to see where the XP came from. */
export const UpgradeXpBar: React.FC<{ xp: UpgradeXpBreakdown; milestones: number[]; className?: string }> = ({ xp, milestones, className = "" }) => {
  const [open, setOpen] = useState(false);
  if (milestones.length === 0) return null;
  const { tier, maxTier, floor, next } = getUpgradeTier(xp.total, milestones);
  const percent = next === null ? 100 : ((xp.total - floor) / (next - floor)) * 100;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        onDoubleClick={(e) => e.stopPropagation()}
        className="w-full text-left"
        title="Upgrade XP: tap to see where it came from"
      >
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
          <span className="text-accent font-display">Tier {tier}{tier >= maxTier ? ' (max)' : ''}</span>
          <span>{next === null ? `${xp.total} XP` : `${xp.total} / ${next} XP`}</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
        </div>
      </button>
      {open && (
        <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
          {xp.parts.length === 0
            ? <p className="italic">No XP yet. Use it in a fight to start leveling it up.</p>
            : xp.parts.map(p => (
              <div key={p.source} className="flex justify-between gap-2">
                <span>{p.count} × {UPGRADE_XP_SOURCE_LABELS[p.source].replace(/^per /, '')}</span>
                <span className="text-accent">+{p.xp} XP</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
