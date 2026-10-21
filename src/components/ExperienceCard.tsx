import React, { useState } from "react";
import { Star } from "lucide-react";
import { DungeonButton } from "@/components/ui/DungeonButton";
import {
  getCrawlerXP,
  getXPForLevel,
  getSkillXPToSpend,
  XP_SCALE_OPTIONS,
  type Crawler,
} from "@/lib/gameData";

interface ExperienceCardProps {
  crawler: Crawler;
  crawlers: Crawler[];
  isAdmin: boolean;
  xpScale: number;
  onAwardXP?: (crawlerIds: string[], amount: number, reason: string) => Promise<void>;
  onSetXPScale?: (scale: number) => Promise<void>;
  dungeonFloor?: number;
  onSetDungeonFloor?: (floor: number) => Promise<void>;
  onSpendPoints?: () => void;
}

/** XP bar, unspent points, recent XP and the DM's Award XP controls for one crawler. */
export const ExperienceCard: React.FC<ExperienceCardProps> = ({
  crawler, crawlers, isAdmin, xpScale, onAwardXP, onSetXPScale, dungeonFloor = 1, onSetDungeonFloor, onSpendPoints,
}) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [recipients, setRecipients] = useState<string[]>([crawler.id]);
  const [busy, setBusy] = useState(false);

  const level = Math.max(1, crawler.level || 1);
  const xp = getCrawlerXP(crawler);
  const start = getXPForLevel(level);
  const next = getXPForLevel(level + 1);
  // A level set by hand above the XP shows an empty bar until the XP catches up
  const pct = Math.max(0, Math.min(100, ((xp - start) / (next - start)) * 100));
  const skillXPToSpend = getSkillXPToSpend(crawler);
  const abilityPoints = crawler.abilityPoints ?? 0;
  const unspent = [
    skillXPToSpend > 0 ? `${skillXPToSpend} skill XP` : "",
    abilityPoints > 0 ? `${abilityPoints} ability point${abilityPoints === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" + ");
  const log = crawler.xpLog ?? [];
  const realCrawlers = crawlers.filter(c => c.id !== "dungeonai");

  const toggleRecipient = (id: string) =>
    setRecipients(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const handleAward = async () => {
    const n = parseInt(amount, 10);
    if (!onAwardXP || !(n > 0) || recipients.length === 0 || busy) return;
    setBusy(true);
    try {
      await onAwardXP(recipients, n, reason);
      setAmount("");
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-display text-accent text-xl flex items-center gap-2 text-glow-gold">
          <Star className="w-6 h-6 shrink-0" /> LEVEL {level}
        </h3>
        {unspent && (
          <button
            onClick={onSpendPoints}
            className="text-xs font-display bg-accent/20 text-accent border border-accent/50 rounded-full px-3 py-1 hover:bg-accent/30"
          >
            {unspent} to spend
          </button>
        )}
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden border border-border/50" role="progressbar" aria-label="Experience" aria-valuenow={xp} aria-valuemin={start} aria-valuemax={next}>
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {xp.toLocaleString()} / {next.toLocaleString()} XP to Level {level + 1}
      </p>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="bg-muted/30 border border-border/50 rounded p-3">
          <h4 className="font-display text-sm text-primary mb-2">RECENT XP</h4>
          {log.length === 0 ? (
            <p className="text-muted-foreground text-xs">No XP yet. Fights, kills, quests and mastery level-ups all earn it.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {log.map((e, i) => (
                <li key={`${e.at}-${i}`} className="text-xs flex gap-2">
                  <span className="text-accent font-bold shrink-0">+{e.amount}</span>
                  <span className="text-foreground break-words">{e.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin && (
          <div className="bg-muted/30 border border-border/50 rounded p-3 space-y-2">
            <h4 className="font-display text-sm text-primary">AWARD XP</h4>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="XP"
                aria-label="XP amount"
                className="w-20 bg-muted border border-border px-2 py-1 text-sm rounded"
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAward(); }}
                placeholder="Reason (e.g. Clever plan)"
                aria-label="XP reason"
                className="flex-1 min-w-0 bg-muted border border-border px-2 py-1 text-sm rounded"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {realCrawlers.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleRecipient(c.id)}
                  className={`text-xs px-2 py-0.5 rounded border ${recipients.includes(c.id) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DungeonButton size="sm" onClick={handleAward} disabled={busy || !(parseInt(amount, 10) > 0) || recipients.length === 0}>
                <Star className="w-4 h-4 mr-1" /> Award XP
              </DungeonButton>
              <label className="text-xs text-muted-foreground flex items-center gap-1" title="Multiplies all automatic XP in this campaign">
                Auto XP
                <select
                  value={xpScale}
                  onChange={(e) => onSetXPScale?.(parseFloat(e.target.value))}
                  aria-label="Automatic XP scale"
                  className="bg-muted border border-border rounded px-1 py-0.5 text-foreground"
                >
                  {XP_SCALE_OPTIONS.map(o => <option key={o} value={o}>{Math.round(o * 100)}%</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground flex items-center gap-1" title="The floor the party is on. Skill check DCs go up 2 per floor.">
                Floor
                <input
                  type="number"
                  min={1}
                  value={dungeonFloor}
                  onChange={(e) => onSetDungeonFloor?.(parseInt(e.target.value, 10) || 1)}
                  aria-label="Dungeon floor"
                  className="w-14 bg-muted border border-border rounded px-1 py-0.5 text-foreground"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
