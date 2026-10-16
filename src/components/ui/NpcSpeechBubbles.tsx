import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatMessage, NpcAiStatus } from "@/lib/gameData";

interface ActiveBubble {
  id: string;
  text: string;
  x: number;
  y: number;
  expiresAt: number;
}

interface NpcSpeechBubblesProps {
  messages: ChatMessage[];
  thinking: NpcAiStatus["thinking"];
  mapId: string | null;
  /** Keeps bubbles the same on-screen size as tokens when the map is zoomed */
  counterScale: number;
}

// Longer lines stay up longer
const bubbleDuration = (text: string) => Math.min(10_000, Math.max(4_000, 3_000 + text.length * 60));

const bubbleStyle = (x: number, y: number, counterScale: number): React.CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
  // Sit above a 64px token, centered
  transform: `translate(-50%, -100%) scale(${counterScale}) translateY(-40px)`,
  transformOrigin: "bottom center",
});

/**
 * Speech bubbles over NPC tokens on the Show Time map. A bubble appears only for
 * NPC lines that arrive while this screen is open (not for history loaded on entry),
 * then fades after a few seconds. A "…" bubble shows while the NPC is thinking.
 */
export const NpcSpeechBubbles: React.FC<NpcSpeechBubblesProps> = ({ messages, thinking, mapId, counterScale }) => {
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);

  useEffect(() => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(messages.map(m => m.id));
      return;
    }
    const seen = seenIdsRef.current;
    const fresh: ActiveBubble[] = [];
    for (const m of messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.authorType !== "npc" || m.x === undefined || m.y === undefined) continue;
      if (mapId && m.mapId && m.mapId !== mapId) continue;
      fresh.push({ id: m.id, text: m.text, x: m.x, y: m.y, expiresAt: Date.now() + bubbleDuration(m.text) });
    }
    if (fresh.length > 0) {
      // One bubble per spot: a new line from the same token replaces the old one
      setBubbles(prev => [
        ...prev.filter(b => !fresh.some(f => Math.abs(f.x - b.x) < 0.5 && Math.abs(f.y - b.y) < 0.5)),
        ...fresh,
      ]);
    }
  }, [messages, mapId]);

  useEffect(() => {
    if (bubbles.length === 0) return;
    const next = Math.min(...bubbles.map(b => b.expiresAt));
    const t = setTimeout(() => {
      const now = Date.now();
      setBubbles(prev => prev.filter(b => b.expiresAt > now));
    }, Math.max(50, next - Date.now()));
    return () => clearTimeout(t);
  }, [bubbles]);

  const showThinking = !!thinking && thinking.x !== undefined && thinking.y !== undefined
    && (!mapId || !thinking.mapId || thinking.mapId === mapId)
    && !bubbles.some(b => Math.abs(b.x - (thinking.x ?? 0)) < 0.5 && Math.abs(b.y - (thinking.y ?? 0)) < 0.5);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 60 }}>
      <AnimatePresence>
        {bubbles.map(b => (
          <motion.div
            key={b.id}
            className="absolute"
            style={bubbleStyle(b.x, b.y, counterScale)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="relative max-w-[220px] w-max bg-background/95 border-2 border-accent px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-lg rounded" data-testid="npc-speech-bubble">
              {b.text}
              <span className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 w-3 h-3 rotate-45 bg-background border-r-2 border-b-2 border-accent" />
            </div>
          </motion.div>
        ))}
        {showThinking && thinking && (
          <motion.div
            key={`thinking-${thinking.mobId}-${thinking.since}`}
            className="absolute"
            style={bubbleStyle(thinking.x ?? 0, thinking.y ?? 0, counterScale)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative bg-background/90 border-2 border-accent/70 px-3 py-1 text-sm text-accent rounded shadow">
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>…</motion.span>
              <span className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 w-3 h-3 rotate-45 bg-background border-r-2 border-b-2 border-accent/70" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NpcSpeechBubbles;
