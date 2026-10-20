import React, { useState } from "react";
import { Dices, Plus, Sparkles } from "lucide-react";
import {
  ABILITY_KEYS,
  MAX_SKILL_RANK,
  SKILLS,
  getSkillRank,
  getUsesUntilNextRank,
  type AbilityKey,
  type Crawler,
  type SkillDef,
  type StatModifiers,
} from "@/lib/gameData";

interface SkillsPanelProps {
  crawler: Crawler;
  equippedMods: StatModifiers;
  canSpend: boolean;          // the crawler's player or the DM
  canRoll: boolean;           // an action (combat) or a roll (noncombat) is available
  rollBlockedReason?: string; // shown on Roll buttons when canRoll is false
  onSpendSkillPoint?: (crawlerId: string, skillId: SkillDef["id"]) => Promise<boolean>;
  onSpendAbilityPoint?: (crawlerId: string, ability: AbilityKey) => Promise<boolean>;
  onRollSkill?: (skill: SkillDef, abilityTotal: number, rank: number) => void;
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Skill ranks, spending skill and ability points from level-ups, and skill check rolls. */
export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  crawler, equippedMods, canSpend, canRoll, rollBlockedReason, onSpendSkillPoint, onSpendAbilityPoint, onRollSkill,
}) => {
  const [busy, setBusy] = useState(false);
  const skillPoints = crawler.skillPoints ?? 0;
  const abilityPoints = crawler.abilityPoints ?? 0;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl text-primary flex items-center gap-2">
        <Sparkles className="w-6 h-6" /> SKILLS
      </h2>

      {abilityPoints > 0 && (
        <div className="border border-accent/50 bg-accent/10 rounded-lg p-3">
          <p className="text-sm font-display text-accent mb-2">
            {abilityPoints} ability point{abilityPoints === 1 ? "" : "s"} to spend
          </p>
          <p className="text-xs text-muted-foreground mb-2">Each point is +1 to that ability's rolls (+2 to the score).</p>
          <div className="flex flex-wrap gap-2">
            {ABILITY_KEYS.map(key => (
              <button
                key={key}
                disabled={!canSpend || busy}
                onClick={() => run(() => onSpendAbilityPoint?.(crawler.id, key) ?? Promise.resolve())}
                className="flex items-center gap-1 px-3 py-1.5 border border-accent/50 rounded text-sm hover:bg-accent/20 disabled:opacity-50"
                aria-label={`Add a point to ${key.toUpperCase()}`}
              >
                <Plus className="w-3 h-3" /> {key.toUpperCase()} <span className="text-muted-foreground">{crawler[key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-2">
        <span className="text-sm text-muted-foreground font-display">SKILL POINTS</span>
        <span className={`text-sm font-display ${skillPoints > 0 ? "text-accent" : "text-muted-foreground"}`}>
          {skillPoints > 0 ? `${skillPoints} to spend` : "None. You get one each level."}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {SKILLS.map(skill => {
          const rank = getSkillRank(crawler, skill.id);
          const abilityTotal = crawler[skill.ability] + (equippedMods[skill.ability] ?? 0);
          const bonus = Math.floor((abilityTotal - 10) / 2) + rank;
          const untilNext = skill.useBased ? getUsesUntilNextRank(crawler.barterTrades ?? 0) : null;
          const canAdd = canSpend && !skill.useBased && skillPoints > 0 && rank < MAX_SKILL_RANK;
          return (
            <div key={skill.id} className="bg-muted/50 border border-border rounded-lg p-3" data-testid={`skill-${skill.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold text-foreground">{skill.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{skill.ability.toUpperCase()}</span>
                </div>
                <span className="font-display text-accent">Rank {rank}</span>
              </div>
              <div className="flex gap-0.5 my-2" aria-hidden>
                {Array.from({ length: MAX_SKILL_RANK }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < rank ? "bg-accent" : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{skill.description}</p>
              {skill.useBased && (
                <p className="text-xs text-primary mt-1">
                  {untilNext === null ? "Max rank." : `${untilNext} more trade${untilNext === 1 ? "" : "s"} to rank ${rank + 1}.`}
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onRollSkill?.(skill, abilityTotal, rank)}
                  disabled={!canRoll}
                  title={canRoll ? `Roll d20 ${fmt(bonus)}` : rollBlockedReason}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-border rounded text-sm hover:bg-primary/20 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Dices className="w-4 h-4" /> Roll {fmt(bonus)}
                </button>
                {!skill.useBased && canSpend && (
                  <button
                    onClick={() => run(() => onSpendSkillPoint?.(crawler.id, skill.id) ?? Promise.resolve())}
                    disabled={!canAdd || busy}
                    aria-label={`Add a rank to ${skill.name}`}
                    className="px-2 py-1.5 border border-accent/50 rounded text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
