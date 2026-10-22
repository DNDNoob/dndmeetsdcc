import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UpgradePath, UpgradeStep } from "@/lib/gameData";
import { describeUpgradeDrawback, describeUpgradeEffect } from "@/lib/upgrades";
import { MEDITATING_TEXT, nextTreeStep } from "@/lib/upgradeTrees";

const StepDetails: React.FC<{ step: UpgradeStep; label?: string }> = ({ step, label }) => (
  <div className="space-y-0.5">
    <p className="text-accent font-display text-xs">{label && <span className="text-muted-foreground font-sans">{label} </span>}{step.name}</p>
    {step.flavor && <p className="italic text-muted-foreground text-[11px]">{step.flavor}</p>}
    <ul className="text-[11px] text-foreground list-disc pl-4">
      {step.effects.map((e, i) => <li key={i}>{describeUpgradeEffect(e)}</li>)}
    </ul>
    {step.drawback && <p className="text-destructive text-[11px]">Price: {describeUpgradeDrawback(step.drawback)}</p>}
    {step.newName && <p className="text-[11px] text-primary">Renames it to {step.newName}</p>}
  </div>
);

/** Where an item or spell stands on its upgrade tree: the Dungeon AI meditating, trees to pick from, or a step to claim.
 *  Only the crawler's player (or the DM) can pick or claim. */
export const UpgradePathPrompt: React.FC<{
  path?: UpgradePath;
  itemName: string;
  canAct: boolean;
  onChoose: (treeIndex: number) => void | Promise<void>;
  onClaim: () => void | Promise<void>;
  className?: string;
}> = ({ path, itemName, canAct, onChoose, onClaim, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!path?.status) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (path.status === 'meditating') {
    return <p className={`text-[11px] italic text-accent animate-pulse ${className}`} title={MEDITATING_TEXT}>{MEDITATING_TEXT}</p>;
  }

  if (path.status === 'ready') {
    const step = nextTreeStep(path);
    if (!step) return null;
    const title = [step.flavor, ...step.effects.map(describeUpgradeEffect), step.drawback ? `Price: ${describeUpgradeDrawback(step.drawback)}` : ''].filter(Boolean).join('\n');
    return canAct ? (
      <button
        onClick={(e) => { stop(e); void onClaim(); }}
        onDoubleClick={stop}
        title={title}
        className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[11px] font-display bg-accent/20 text-accent hover:bg-accent/40 animate-pulse ${className}`}
      >
        <Sparkles className="w-3 h-3" /> Claim {step.name}
      </button>
    ) : <p className={`text-[11px] text-accent ${className}`} title={title}>{step.name} is ready to claim</p>;
  }

  const trees = path.trees ?? [];
  // The window is portaled, but React still bubbles its clicks to the card underneath
  return (
    <div onClick={stop} onDoubleClick={stop}>
      {canAct ? (
        <button
          onClick={() => setOpen(true)}
          className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[11px] font-display bg-accent/20 text-accent hover:bg-accent/40 animate-pulse ${className}`}
        >
          <Sparkles className="w-3 h-3" /> Choose your path
        </button>
      ) : <p className={`text-[11px] text-accent ${className}`}>Choosing an upgrade path</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-accent">Choose your path: {itemName}</DialogTitle>
            <DialogDescription>
              Pick one tree. You get its first step now; each later milestone unlocks the next step.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {trees.map((tree, i) => (
              <div key={i} className="border border-accent/40 rounded-lg p-3 flex flex-col gap-2 bg-muted/30">
                <div>
                  <p className="font-display text-primary">{tree.name}</p>
                  {tree.pitch && <p className="text-xs italic text-muted-foreground">{tree.pitch}</p>}
                </div>
                {tree.steps.map((step, j) => <StepDetails key={j} step={step} label={`${j + 1}.`} />)}
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try { await onChoose(i); setOpen(false); } finally { setBusy(false); }
                  }}
                  className="mt-auto py-1.5 rounded text-xs font-display bg-accent/20 text-accent hover:bg-accent/40 disabled:opacity-50"
                >
                  Take this path
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
