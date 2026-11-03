import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Wind } from "lucide-react";
import type { IncomingAttack } from "@/lib/gameData";

interface DodgePromptProps {
  /** Attacks on this player's crawler still waiting for an answer (oldest first) */
  attacks: IncomingAttack[];
  /** The crawler still has its reaction this round */
  reactionReady: boolean;
  /** d20 + this when dodging */
  dodgeBonus: number;
  onAnswer: (attackId: string, choice: 'dodge' | 'take') => Promise<boolean>;
}

/**
 * Pops up for a player when a mob attack would hit their crawler: Dodge (spend the reaction,
 * meet or beat the attack roll and it misses) or take the hit. The DM's screen waits for the answer.
 */
export const DodgePrompt: React.FC<DodgePromptProps> = ({ attacks, reactionReady, dodgeBonus, onAnswer }) => {
  const [busy, setBusy] = useState(false);
  const attack = attacks[0];

  const answer = async (choice: 'dodge' | 'take') => {
    if (!attack || busy) return;
    setBusy(true);
    try {
      await onAnswer(attack.attackId, choice);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {attack && (
        <motion.div
          key={`${attack.attackId}:${attack.targetId}`}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm bg-background/95 backdrop-blur-sm border-2 border-destructive rounded-lg shadow-lg p-4"
          role="alertdialog"
          aria-label="Incoming attack"
        >
          <p className="font-display text-destructive text-glow-red text-lg text-center">INCOMING ATTACK!</p>
          <p className="text-sm text-center mt-1">
            <span className="font-semibold">{attack.attackerName}</span>'s {attack.actionName} rolls{' '}
            <span className="font-display text-destructive">{attack.hitTotal}</span> vs your DC {attack.dc}.
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {reactionReady
              ? `Dodge uses your reaction: d20 ${dodgeBonus >= 0 ? '+' : ''}${dodgeBonus}. Roll ${attack.hitTotal} or more and it misses.`
              : 'You already used your reaction this round.'}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => answer('dodge')}
              disabled={busy || !reactionReady}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent text-accent-foreground font-display disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
            >
              <Wind className="w-4 h-4" /> DODGE
            </button>
            <button
              onClick={() => answer('take')}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-border font-display hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Shield className="w-4 h-4" /> TAKE IT
            </button>
          </div>
          {attacks.length > 1 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">{attacks.length - 1} more attack{attacks.length > 2 ? 's' : ''} waiting</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
