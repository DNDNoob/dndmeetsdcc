import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Clock, Timer } from 'lucide-react';
import { motion } from 'framer-motion';

interface CombatTurnTimerProps {
  mode: 'countdown' | 'stopwatch';
  durationSeconds: number;
  turnStartedAt: number;
  paused: boolean;
  onTimerExpired?: () => void;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'square';
    gain.gain.value = 0.3;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const CombatTurnTimer: React.FC<CombatTurnTimerProps> = ({
  mode,
  durationSeconds,
  turnStartedAt,
  paused,
  onTimerExpired,
}) => {
  const [now, setNow] = useState(Date.now());
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    hasExpiredRef.current = false;
  }, [turnStartedAt]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [paused]);

  const elapsedSeconds = Math.max(0, Math.floor((now - turnStartedAt) / 1000));

  const getCountdownDisplay = useCallback(() => {
    const remaining = Math.max(0, durationSeconds - elapsedSeconds);
    return { display: formatTime(remaining), remaining };
  }, [durationSeconds, elapsedSeconds]);

  const getStopwatchDisplay = useCallback(() => {
    return { display: formatTime(elapsedSeconds), elapsed: elapsedSeconds };
  }, [elapsedSeconds]);

  // Handle countdown expiry
  useEffect(() => {
    if (mode !== 'countdown' || paused) return;
    const remaining = durationSeconds - elapsedSeconds;
    if (remaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      playBeep();
      onTimerExpired?.();
    }
  }, [mode, durationSeconds, elapsedSeconds, paused, onTimerExpired]);

  let displayText: string;
  let colorClass: string;
  let isExpired = false;
  let isPulsing = false;

  if (mode === 'countdown') {
    const { display, remaining } = getCountdownDisplay();
    displayText = display;
    if (remaining <= 0) {
      colorClass = 'text-destructive text-glow-red';
      isExpired = true;
      isPulsing = true;
    } else if (remaining <= 10) {
      colorClass = 'text-destructive';
      isPulsing = true;
    } else {
      colorClass = 'text-muted-foreground';
    }
  } else {
    const { display, elapsed } = getStopwatchDisplay();
    displayText = display;
    if (elapsed >= 120) {
      colorClass = 'text-destructive';
    } else if (elapsed >= 60) {
      colorClass = 'text-accent';
    } else {
      colorClass = 'text-muted-foreground';
    }
  }

  const IconComponent = mode === 'countdown' ? Timer : Clock;

  return (
    <motion.div
      className={`flex items-center gap-1 px-2 shrink-0 ${colorClass}`}
      animate={isPulsing ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
      transition={isPulsing ? { duration: 1, repeat: Infinity } : undefined}
    >
      <IconComponent className="w-3 h-3" />
      <span className={`text-sm font-display tabular-nums ${isExpired ? 'font-bold' : ''}`}>
        {paused ? '⏸' : displayText}
      </span>
    </motion.div>
  );
};

export default CombatTurnTimer;
