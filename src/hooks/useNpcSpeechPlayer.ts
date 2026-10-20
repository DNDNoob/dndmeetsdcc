import { useCallback, useEffect, useRef, useState } from 'react';
import { baseMobId, type ChatMessage } from '@/lib/gameData';
import { clipSource } from '@/lib/npcSpeech/clipStore';

const PREFS_KEY = 'dcc_npc_speech_audio';
// A clip that shows up later than this after its line appeared isn't played (it would be out of step with the chat)
const PLAY_WITHIN_MS = 2 * 60_000;
// A tiny silent WAV, played on the first tap so phones allow audio afterwards
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YQAAAAA=';

interface SpeechPrefs {
  muted: boolean;
  volume: number;
  mutedSpeakers: string[]; // mob ids (every copy of a creature) this viewer doesn't want to hear
}

const readPrefs = (): SpeechPrefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<SpeechPrefs>;
    return {
      muted: !!p.muted,
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.9,
      mutedSpeakers: Array.isArray(p.mutedSpeakers) ? p.mutedSpeakers.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch {
    return { muted: false, volume: 0.9, mutedSpeakers: [] };
  }
};

interface NpcSpeechPlayerOptions {
  roomId: string | null | undefined;        // where the clips are saved
  messages: ChatMessage[];                  // this episode's chat lines
  understands: (m: ChatMessage) => boolean; // does this viewer know the line's language?
  mapId?: string | null;                    // only lines said on the map this viewer is looking at
}

/**
 * Spoken voices, every device: plays each new NPC line's clip once, one at a time, at this
 * viewer's volume. Viewers who don't know the language hear the scrambled clip.
 */
export function useNpcSpeechPlayer({ roomId, messages, understands, mapId }: NpcSpeechPlayerOptions) {
  const [prefs, setPrefs] = useState<SpeechPrefs>(readPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Each clip starts loading as soon as it's queued, so it's ready when its turn comes
  const queue = useRef<{ id: string; speaker: string; src: Promise<string>; at: number }[]>([]);
  const playing = useRef(false);
  const playingSpeaker = useRef<string | null>(null);
  const playToken = useRef(0); // bumped when a clip is cut off, so its late start is ignored
  const handled = useRef<Set<string> | null>(null);
  // When this device first saw each line: its clip arrives a little later
  const seenAt = useRef(new Map<string, number>());
  const blocked = useRef(false);
  const unlocked = useRef(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const getAudio = () => {
    audioRef.current ??= new Audio();
    return audioRef.current;
  };

  const playNext = useCallback(() => {
    if (playing.current || blocked.current) return;
    const skip = (item: { speaker: string; at: number }) =>
      item.at < Date.now() - PLAY_WITHIN_MS || prefsRef.current.mutedSpeakers.includes(item.speaker);
    let next = queue.current.shift();
    while (next && skip(next)) next = queue.current.shift();
    if (!next) { setSpeakingId(null); return; }
    const a = getAudio();
    playing.current = true;
    setSpeakingId(next.id);
    const item = next;
    playingSpeaker.current = item.speaker;
    const token = ++playToken.current;
    const done = () => {
      a.onended = null;
      a.onerror = null;
      playing.current = false;
      playNext();
    };
    a.onended = done;
    a.onerror = done;
    item.src.then((src) => {
      if (token !== playToken.current) return;
      a.src = src;
      a.volume = prefsRef.current.volume;
      return a.play();
    }).catch((err: unknown) => {
      if (token !== playToken.current) return;
      if ((err as { name?: string })?.name !== 'NotAllowedError') { done(); return; }
      // The browser wants a tap before sound: keep the clip and play it on the next tap
      a.onended = null;
      a.onerror = null;
      playing.current = false;
      blocked.current = true;
      queue.current.unshift(item);
      setSpeakingId(null);
    });
  }, []);

  // Browsers only allow sound after a tap: use taps to unlock the player and play anything held back
  useEffect(() => {
    const unlock = () => {
      if (blocked.current) { blocked.current = false; playNext(); return; }
      if (playing.current || unlocked.current) return;
      const a = getAudio();
      a.src = SILENCE;
      a.play().then(() => { unlocked.current = true; }).catch(() => {});
    };
    // Phones count a tap when the finger lifts (click, touchend), computers on press
    const events = ['pointerdown', 'click', 'touchend', 'keydown'];
    for (const e of events) window.addEventListener(e, unlock);
    return () => { for (const e of events) window.removeEventListener(e, unlock); };
  }, [playNext]);

  useEffect(() => {
    // Lines already in the chat when this opened are history: never play them
    if (!handled.current) {
      handled.current = new Set(messages.map(m => m.id));
      return;
    }
    const now = Date.now();
    for (const m of messages) {
      if (handled.current.has(m.id)) continue;
      // Not an NPC, or an old line showing up as the chat loads: nothing to play
      if (m.authorType !== 'npc' || (!seenAt.current.has(m.id) && (m.createdAt ?? 0) < now - PLAY_WITHIN_MS)) {
        handled.current.add(m.id);
        continue;
      }
      if (!seenAt.current.has(m.id)) seenAt.current.set(m.id, now);
      if (!m.audioUrl) continue;
      handled.current.add(m.id);
      const seen = seenAt.current.get(m.id) ?? now;
      seenAt.current.delete(m.id);
      if (prefsRef.current.muted || seen < now - PLAY_WITHIN_MS) continue;
      const speaker = baseMobId(m.authorId);
      if (prefsRef.current.mutedSpeakers.includes(speaker)) continue;
      if (mapId && m.mapId && m.mapId !== mapId) continue;
      const url = understands(m) ? m.audioUrl : m.audioScrambledUrl;
      if (!url) continue;
      const src = clipSource(roomId, url);
      src.catch(() => {}); // a missing clip is skipped when its turn comes
      queue.current.push({ id: m.id, speaker, src, at: now });
    }
    playNext();
  }, [messages, understands, mapId, playNext, roomId]);

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

  /** Mute or unmute one character (all copies of a creature) for this viewer only. */
  const toggleSpeakerMuted = useCallback((speakerId: string) => {
    const id = baseMobId(speakerId);
    const muting = !prefsRef.current.mutedSpeakers.includes(id);
    update({ mutedSpeakers: muting ? [...prefsRef.current.mutedSpeakers, id] : prefsRef.current.mutedSpeakers.filter(x => x !== id) });
    // Cut them off if they're talking right now
    if (muting && playing.current && audioRef.current && playingSpeaker.current === id) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      playing.current = false;
      playToken.current++;
      prefsRef.current = { ...prefsRef.current, mutedSpeakers: [...prefsRef.current.mutedSpeakers, id] };
      playNext();
    }
  }, [update, playNext]);

  // Stop talking when leaving Show Time
  useEffect(() => () => { audioRef.current?.pause(); queue.current = []; }, []);

  return {
    speechMuted: prefs.muted, speechVolume: prefs.volume, setSpeechPrefs: update, speakingMessageId: speakingId,
    mutedSpeakers: prefs.mutedSpeakers, toggleSpeakerMuted,
  };
}
