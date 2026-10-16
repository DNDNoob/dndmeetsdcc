import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { type CombatState } from "@/lib/gameData";

interface UndoTurnButtonProps {
  combatState?: CombatState | null;
  crawlerId?: string; // the crawler this button undoes the turn for
  onUndo?: () => Promise<boolean>;
  className?: string;
}

// Whether a crawler can undo right now: it's their combat turn and a checkpoint exists for it
export const canUndoCombatTurn = (combatState: CombatState | null | undefined, crawlerId: string | undefined): boolean => {
  if (!combatState?.active || combatState.phase !== 'combat' || !crawlerId) return false;
  const active = combatState.combatants[combatState.currentTurnIndex];
  return active?.type === 'crawler' && active.id === crawlerId && combatState.turnSnapshot?.combatantId === crawlerId;
};

// Puts the player's turn back to how it started. Needs a second tap to confirm.
const UndoTurnButton: React.FC<UndoTurnButtonProps> = ({ combatState, crawlerId, onUndo, className = '' }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Drop the pending confirmation after a few seconds, or when the turn changes
  const turnKey = `${combatState?.combatRound}-${combatState?.currentTurnIndex}`;
  useEffect(() => { setConfirming(false); }, [turnKey]);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (!onUndo || !canUndoCombatTurn(combatState, crawlerId)) return null;

  const handleClick = async () => {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await onUndo();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={`flex items-center justify-center gap-1 font-display text-xs py-2 px-3 rounded border transition-colors disabled:opacity-50 ${
        confirming
          ? 'bg-destructive/20 border-destructive text-destructive'
          : 'bg-muted/50 border-border text-muted-foreground hover:text-accent hover:border-accent/50'
      } ${className}`}
      title="Put your token, movement, actions, HP and mana back to how they were when this turn started"
    >
      <Undo2 className="w-3 h-3" />
      {busy ? 'UNDOING...' : confirming ? 'TAP AGAIN TO UNDO' : 'UNDO TURN'}
    </button>
  );
};

export default UndoTurnButton;
