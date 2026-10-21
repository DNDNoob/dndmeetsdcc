import React, { useState } from "react";
import { Dices, Plus, Sparkles } from "lucide-react";
import {
  ABILITY_KEYS,
  CHECK_DIFFICULTIES,
  MAX_SKILL_RANK,
  SKILL_XP_PER_LEVEL,
  SKILL_XP_PER_SUCCESS,
  SKILL_XP_PER_TRADE,
  getCheckDC,
  getSkillRankForXP,
  getSkillXP,
  getSkillXPForRank,
  getSkillXPToSpend,
  type CheckDifficultyId,
  SKILLS,
  type AbilityKey,
  type Crawler,
  type SkillDef,
  type SkillKind,
  type StatModifiers,
} from "@/lib/gameData";

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Easy / Medium / Hard buttons with this floor's DCs. Shared by the Actions and Skills tabs. */
export const CheckDifficultyPicker: React.FC<{
  difficulty: CheckDifficultyId;
  onChange: (d: CheckDifficultyId) => void;
  dungeonFloor: number;
}> = ({ difficulty, onChange, dungeonFloor }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 border border-border rounded-lg px-4 py-2">
    <span className="text-sm text-muted-foreground font-display">CHECK DIFFICULTY</span>
    <div className="flex flex-wrap items-center gap-2">
      {CHECK_DIFFICULTIES.map(d => (
        <button
          key={d.id}
          onClick={() => onChange(d.id)}
          className={`text-xs px-2 py-1 rounded border ${difficulty === d.id ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
        >
          {d.name} {getCheckDC(d.id, dungeonFloor)}
        </button>
      ))}
      <span className="text-xs text-muted-foreground">Floor {dungeonFloor} · 1 always fails, 20 always succeeds</span>
    </div>
  </div>
);

const GROUPS: { kind: SkillKind; title: string; note: string }[] = [
  { kind: "roll", title: "ROLL SKILLS", note: `Each passed check earns ${SKILL_XP_PER_SUCCESS} skill XP.` },
  { kind: "knowledge", title: "KNOWLEDGE", note: "Grow only from skill XP you spend." },
  { kind: "trade", title: "TRADE", note: `Each buy or sell earns ${SKILL_XP_PER_TRADE} skill XP.` },
];

interface SkillsPanelProps {
  crawler: Crawler;
  equippedMods: StatModifiers;
  canSpend: boolean;          // the crawler's player or the DM
  canRoll: boolean;           // an action (combat) or a roll (noncombat) is available
  rollBlockedReason?: string; // shown on Roll buttons when canRoll is false
  onSpendSkillXP?: (crawlerId: string, skillId: SkillDef["id"], amount: number) => Promise<boolean>;
  onSpendAbilityPoint?: (crawlerId: string, ability: AbilityKey) => Promise<boolean>;
  dungeonFloor?: number;
  difficulty: CheckDifficultyId;
  onDifficultyChange: (d: CheckDifficultyId) => void;
  onRollSkill?: (skill: SkillDef, abilityTotal: number, rank: number, dc: number) => void;
}

/** Skill ranks from skill XP, spending level-up skill XP and ability points, and skill check rolls. */
export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  crawler, equippedMods, canSpend, canRoll, rollBlockedReason, dungeonFloor = 1, difficulty, onDifficultyChange,
  onSpendSkillXP, onSpendAbilityPoint, onRollSkill,
}) => {
  const [busy, setBusy] = useState(false);
  const dc = getCheckDC(difficulty, dungeonFloor);
  const pool = getSkillXPToSpend(crawler);
  const abilityPoints = crawler.abilityPoints ?? 0;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const renderSkill = (skill: SkillDef) => {
    const xp = getSkillXP(crawler, skill.id);
    const rank = getSkillRankForXP(xp);
    const atMax = rank >= MAX_SKILL_RANK;
    const start = getSkillXPForRank(rank);
    const next = getSkillXPForRank(rank + 1);
    const pct = atMax ? 100 : Math.max(0, Math.min(100, ((xp - start) / (next - start)) * 100));
    const toNext = Math.min(pool, next - xp);
    const abilityTotal = crawler[skill.ability] + (equippedMods[skill.ability] ?? 0);
    const bonus = Math.floor((abilityTotal - 10) / 2) + rank;
    const showSpend = canSpend && pool > 0 && !atMax;
    return (
      <div key={skill.id} className="bg-muted/50 border border-border rounded-lg p-3" data-testid={`skill-${skill.id}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="font-semibold text-foreground">{skill.name}</span>
            <span className="text-xs text-muted-foreground ml-2">{skill.ability.toUpperCase()}</span>
          </div>
          <span className="font-display text-accent">Rank {rank}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden my-2" role="progressbar" aria-label={`${skill.name} skill XP`} aria-valuenow={xp} aria-valuemin={start} aria-valuemax={next}>
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-primary mb-1">
          {atMax ? `${xp.toLocaleString()} XP · top rank` : `${xp.toLocaleString()} / ${next.toLocaleString()} XP to rank ${rank + 1}`}
        </p>
        <p className="text-xs text-muted-foreground">{skill.description}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onRollSkill?.(skill, abilityTotal, rank, dc)}
            disabled={!canRoll}
            title={canRoll ? `Roll d20 ${fmt(bonus)} vs DC ${dc}` : rollBlockedReason}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-border rounded text-sm hover:bg-primary/20 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Dices className="w-4 h-4" /> Roll {fmt(bonus)}
          </button>
          {showSpend && (
            <>
              <button
                onClick={() => run(() => onSpendSkillXP?.(crawler.id, skill.id, 10) ?? Promise.resolve())}
                disabled={busy}
                aria-label={`Spend 10 skill XP on ${skill.name}`}
                className="px-2 py-1.5 border border-accent/50 rounded text-xs text-accent hover:bg-accent/20 disabled:opacity-40"
              >
                +{Math.min(10, pool)}
              </button>
              <button
                onClick={() => run(() => onSpendSkillXP?.(crawler.id, skill.id, toNext) ?? Promise.resolve())}
                disabled={busy}
                aria-label={`Spend ${toNext} skill XP on ${skill.name}`}
                title={toNext >= next - xp ? `Spend ${toNext} XP to reach rank ${rank + 1}` : `Spend all ${toNext} XP`}
                className="flex items-center gap-1 px-2 py-1.5 border border-accent/50 rounded text-xs text-accent hover:bg-accent/20 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> {toNext >= next - xp ? `Rank ${rank + 1}` : `+${toNext}`}
              </button>
            </>
          )}
        </div>
      </div>
    );
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

      <div className={`rounded-lg px-4 py-2 border ${pool > 0 ? "border-accent/50 bg-accent/10" : "border-border bg-muted/30"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground font-display">SKILL XP TO SPEND</span>
          <span className={`text-sm font-display ${pool > 0 ? "text-accent" : "text-muted-foreground"}`}>{pool}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          You get {SKILL_XP_PER_LEVEL} each level. Split it across any skills; it adds to the XP they earned, so nothing resets.
        </p>
      </div>

      <CheckDifficultyPicker difficulty={difficulty} onChange={onDifficultyChange} dungeonFloor={dungeonFloor} />

      {GROUPS.map(group => (
        <div key={group.kind}>
          <div className="flex flex-wrap items-baseline gap-2 mb-2">
            <h3 className="font-display text-base text-accent">{group.title}</h3>
            <span className="text-xs text-muted-foreground">{group.note}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {SKILLS.filter(s => s.kind === group.kind).map(renderSkill)}
          </div>
        </div>
      ))}
    </div>
  );
};
