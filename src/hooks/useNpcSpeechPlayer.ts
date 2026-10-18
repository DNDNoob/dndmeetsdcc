import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/gameData';

const PREFS_KEY = 'dcc_npc_speech_audio';
// A clip that shows up later than this after its line isn't played (it would be out of step with the chat)
const PLAY_WITHIN_MS = 60_000;
// A tiny silent WAV, played on the first tap so phones allow audio afterwards
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YQAAAAA=';

interface SpeechPrefs { muted: boolean; volume: number }

const readPrefs = (): SpeechPrefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<SpeechPrefs>;
    return { muted: !!p.muted, volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.9 };
  } catch {
    return { muted: false, volume: 0.9 };
  }
};

interface NpcSpeechPlayerOptions {
  messages: ChatMessage[];                  // this episode's chat lines
  understands: (m: ChatMessage) => boolean; // does this viewer know the line's language?
  mapId?: string | null;                    // only lines said on the map this viewer is looking at
}

/**
 * Spoken voices, every device: plays each new NPC line's clip once, one at a time, at this
 * viewer's volume. Viewers who don't know the language hear the scrambled clip.
 */
export function useNpcSpeechPlayer({ messages, understands, mapId }: NpcSpeechPlayerOptions) {
  const [prefs, setPrefs] = useState<SpeechPrefs>(readPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queue = useRef<{ url: string; at: number }[]>([]);
  const playing = useRef(false);
  const handled = useRef<Set<string> | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const idByUrl = useRef(new Map<string, string>());

  const getAudio = () => {
    audioRef.current ??= new Audio();
    return audioRef.current;
  };

  // Phones only allow sound after a tap: use the first one to unlock the player
  useEffect(() => {
    const unlock = () => {
      const a = getAudio();
      if (playing.current) return;
      a.src = SILENCE;
      a.play().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playNext = useCallback(() => {
    if (playing.current) return;
    let next = queue.current.shift();
    while (next && next.at < Date.now() - PLAY_WITHIN_MS) next = queue.current.shift();
    if (!next) { setSpeakingId(null); return; }
    const a = getAudio();
    playing.current = true;
    setSpeakingId(idByUrl.current.get(next.url) ?? null);
    const done = () => {
      a.onended = null;
      a.onerror = null;
      playing.current = false;
      playNext();
    };
    a.onended = done;
    a.onerror = done;
    a.src = next.url;
    a.volume = prefsRef.current.volume;
    a.play().catch(done);
  }, []);

  useEffect(() => {
    // Lines already in the chat when this opened are history: never play them
    if (!handled.current) {
      handled.current = new Set(messages.filter(m => m.audioUrl).map(m => m.id));
      return;
    }
    const now = Date.now();
    for (const m of messages) {
      if (!m.audioUrl || handled.current.has(m.id)) continue;
      handled.current.add(m.id);
      if (prefsRef.current.muted || (m.createdAt ?? 0) < now - PLAY_WITHIN_MS) continue;
      if (mapId && m.mapId && m.mapId !== mapId) continue;
      const url = understands(m) ? m.audioUrl : m.audioScrambledUrl;
      if (!url) continue;
      idByUrl.current.set(url, m.id);
      queue.current.push({ url, at: m.createdAt ?? now });
    }
    playNext();
  }, [messages, understands, mapId, playNext]);

  const update = useCallback((next: Partial<SpeechPrefs>) => {
    setPrefs(prev => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(merged)); } catch { /* storage unavailable */ }
      if (audioRef.current) {
        audioRef.current.volume = merged.volume;
        if (merged.muted) { queue.current = []; audioRef.current.pause(); playing.current = false; setSpeakingId(null); }
      }
      return merged;
    });
  }, []);

  // Stop talking when leaving Show Time
  useEffect(() => () => { audioRef.current?.pause(); queue.current = []; }, []);

  return { speechMuted: prefs.muted, speechVolume: prefs.volume, setSpeechPrefs: update, speakingMessageId: speakingId };
}
