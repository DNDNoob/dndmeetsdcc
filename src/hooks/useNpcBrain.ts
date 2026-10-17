import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { NpcRoom } from '@/lib/npc/engine.mjs';
import { createOnlineLlm, type NpcOnlineKeys } from '@/lib/npc/onlineLlm.mjs';

const KEYS_STORAGE = 'dcc_npc_keys';

const loadKeys = (): NpcOnlineKeys => {
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORAGE) || '{}') as NpcOnlineKeys;
  } catch {
    return {};
  }
};

/**
 * Runs the online NPC brain (Groq → Gemini) in the DM's browser while the DM has the campaign open.
 * The engine itself decides when to talk: only during a live Show Time game, only when NPC voices
 * are on and the brain is set to Online. The keys stay in this browser's localStorage.
 */
export function useNpcBrain(roomId: string | null | undefined, isDm: boolean) {
  const [keys, setKeysState] = useState<NpcOnlineKeys>(loadKeys);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const roomRef = useRef<NpcRoom | null>(null);

  const setKeys = useCallback((next: NpcOnlineKeys) => {
    setKeysState(next);
    keysRef.current = next;
    // New keys: don't keep waiting out "no key" or a bad-key error
    void roomRef.current?.retryOnline();
    try {
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: keys last until the page is closed
    }
  }, []);

  useEffect(() => {
    if (!isDm || !roomId || !db) return;
    let room: NpcRoom | null = null;
    let release: () => void = () => {};
    let cancelled = false;

    const startRoom = () => {
      if (cancelled) return;
      room = new NpcRoom({
        db,
        roomId,
        role: 'online',
        llm: createOnlineLlm(() => keysRef.current, { testUrl: import.meta.env.VITE_NPC_TEST_LLM_URL }),
        log: (...a) => console.log('[NpcBrain]', ...a),
        warn: (...a) => console.warn('[NpcBrain]', ...a),
      });
      roomRef.current = room;
    };

    // Only one tab per browser runs the brain, so NPCs never answer twice
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks?.request) {
      locks.request(`dcc-npc-brain-${roomId}`, () => new Promise<void>((resolve) => {
        release = resolve;
        startRoom();
      })).catch(() => {});
    } else {
      startRoom();
    }

    return () => {
      cancelled = true;
      room?.dispose();
      roomRef.current = null;
      release();
    };
  }, [roomId, isDm]);

  return { npcKeys: keys, setNpcKeys: setKeys };
}
