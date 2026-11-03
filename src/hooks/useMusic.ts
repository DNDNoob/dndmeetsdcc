import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { db, doc, setDoc, onSnapshot } from '@/lib/firebase';
import type { MusicState } from '@/lib/gameData';
import { MUSIC_TRACKS, musicTrackUrl } from '@/lib/musicTracks';

const VOLUME_KEY = 'music_volume';
const MUTED_KEY = 'music_muted';
const FADE_MS = 1500;

function readSetting(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: setting lasts for this visit only */ }
}

// Where in the loop the track should be right now, so every player hears the same part
function loopOffset(state: MusicState, durationSec: number): number {
  const elapsed = Math.max(0, (Date.now() - state.startedAt) / 1000);
  return elapsed % durationSec;
}

/**
 * Campaign background music. The DM picks a track (rooms/{roomId}/music/current) and every
 * player's browser plays it on a loop, in step with the DM. Volume and mute are per player and
 * stay in this browser. Browsers block sound until the page is tapped, so `needsTap` asks for one.
 */
export function useMusic(roomId: string | null | undefined, user: User | null) {
  const uid = user?.uid;
  const [state, setState] = useState<MusicState | null>(null);
  const [volume, setVolumeState] = useState(() => {
    const saved = Number(readSetting(VOLUME_KEY));
    return readSetting(VOLUME_KEY) !== null && Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.5;
  });
  const [muted, setMutedState] = useState(() => readSetting(MUTED_KEY) === '1');
  const [needsTap, setNeedsTap] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIdRef = useRef<string | null>(null);
  // Fade level (0..1) of each playing element; its real volume is level × the player's volume
  const levels = useRef(new WeakMap<HTMLAudioElement, number>());
  const timers = useRef(new WeakMap<HTMLAudioElement, ReturnType<typeof setInterval>>());
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    setState(null);
    if (!roomId || !uid || !db) return;
    return onSnapshot(
      doc(db, 'rooms', roomId, 'music', 'current'),
      (snap) => setState(snap.exists() ? (snap.data() as MusicState) : null),
      (err) => console.error('[Music] listener error:', err),
    );
  }, [roomId, uid]);

  const fade = useCallback((audio: HTMLAudioElement, to: number, onDone?: () => void) => {
    const existing = timers.current.get(audio);
    if (existing) clearInterval(existing);
    const from = levels.current.get(audio) ?? 0;
    const steps = FADE_MS / 50;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const level = from + (to - from) * Math.min(1, step / steps);
      levels.current.set(audio, level);
      audio.volume = level * volumeRef.current;
      if (step >= steps) {
        clearInterval(timer);
        timers.current.delete(audio);
        onDone?.();
      }
    }, 50);
    timers.current.set(audio, timer);
  }, []);

  const start = useCallback((audio: HTMLAudioElement) => {
    audio.play().then(() => setNeedsTap(false)).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'NotAllowedError') setNeedsTap(true);
      else console.error('[Music] playback failed:', err);
    });
  }, []);

  const stopAudio = useCallback((audio: HTMLAudioElement) => {
    fade(audio, 0, () => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
  }, [fade]);

  // Follow the DM's choice: fade out the old track and fade in the new one at the shared position
  useEffect(() => {
    const track = state?.playing ? MUSIC_TRACKS.find(t => t.id === state.trackId) : undefined;
    const current = audioRef.current;
    if (!state || !track) {
      if (current) stopAudio(current);
      audioRef.current = null;
      trackIdRef.current = null;
      setNeedsTap(false);
      return;
    }
    if (current && trackIdRef.current === track.id) {
      // Same track restarted (or resynced): jump to the shared position
      current.currentTime = loopOffset(state, track.durationSec);
      return;
    }
    if (current) stopAudio(current);
    const audio = new Audio(musicTrackUrl(track.id));
    audio.loop = true;
    audio.preload = 'auto';
    audio.muted = muted;
    audio.volume = 0;
    levels.current.set(audio, 0);
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = loopOffset(state, track.durationSec);
    }, { once: true });
    audioRef.current = audio;
    trackIdRef.current = track.id;
    start(audio);
    fade(audio, 1);
    // muted is applied by its own effect; restarting the track on mute would lose the place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.trackId, state?.playing, state?.startedAt, fade, start, stopAudio]);

  // Stop the music when leaving the campaign
  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; trackIdRef.current = null; }
  }, [roomId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !timers.current.has(audio)) audio.volume = (levels.current.get(audio) ?? 1) * volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    writeSetting(VOLUME_KEY, String(v));
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    writeSetting(MUTED_KEY, m ? '1' : '0');
  }, []);

  /** Called from a tap, which is what lets the browser start the sound. */
  const turnOn = useCallback(() => {
    const audio = audioRef.current;
    const track = MUSIC_TRACKS.find(t => t.id === trackIdRef.current);
    if (!audio || !track || !state) return;
    if (audio.readyState >= 1) audio.currentTime = loopOffset(state, track.durationSec);
    start(audio);
  }, [state, start]);

  const playTrack = useCallback(async (trackId: string) => {
    if (!roomId || !db) return;
    const next: MusicState = { trackId, playing: true, startedAt: Date.now(), ...(uid ? { updatedBy: uid } : {}) };
    await setDoc(doc(db, 'rooms', roomId, 'music', 'current'), next);
  }, [roomId, uid]);

  const stopMusic = useCallback(async () => {
    if (!roomId || !db) return;
    await setDoc(doc(db, 'rooms', roomId, 'music', 'current'), { playing: false, ...(uid ? { updatedBy: uid } : {}) }, { merge: true });
  }, [roomId, uid]);

  const nowPlaying = state?.playing ? MUSIC_TRACKS.find(t => t.id === state.trackId) ?? null : null;

  return { nowPlaying, volume, setVolume, muted, setMuted, needsTap, turnOn, playTrack, stopMusic };
}

export type MusicControls = ReturnType<typeof useMusic>;
