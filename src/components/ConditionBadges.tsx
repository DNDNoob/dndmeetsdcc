import React from "react";
import { X } from "lucide-react";
import type { ActiveCondition } from "@/lib/gameData";

// Spell effects on a combatant, with turns left. The DM can pass onRemove to clear one early.
export const ConditionBadges: React.FC<{
  conditions?: ActiveCondition[];
  onRemove?: (conditionId: string) => void;
  compact?: boolean;
  className?: string;
}> = ({ conditions, onRemove, compact = false, className = "" }) => {
  if (!conditions?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {conditions.map(cond => {
        const isGood = cond.perTurnType === 'healing';
        const tip = [
          `${cond.name}: ${cond.turnsLeft} turn${cond.turnsLeft === 1 ? '' : 's'} left`,
          `From ${cond.source}${cond.casterName ? ` (${cond.casterName})` : ''}`,
          cond.description,
        ].filter(Boolean).join('\n');
        return (
          <span
            key={cond.id}
            title={tip}
            className={`inline-flex items-center gap-0.5 rounded border font-semibold ${compact ? 'text-[8px] px-0.5 leading-tight' : 'text-[10px] px-1 py-0.5'} ${
              isGood ? 'border-green-500/50 bg-green-500/15 text-green-400' : 'border-purple-400/50 bg-purple-500/15 text-purple-300'
            }`}
          >
            {cond.name} {cond.turnsLeft}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(cond.id); }}
                className="hover:text-destructive"
                aria-label={`Remove ${cond.name}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
};
