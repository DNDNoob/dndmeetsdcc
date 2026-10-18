import { useEffect, useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  baseMobId,
  withNpcPersonality,
  type ChatMessage,
  type Crawler,
  type Mob,
  type NpcGeneratedPersonality,
  type NpcSpeechVoice,
} from '@/lib/gameData';
import { TELEPATHIC_LANGUAGE_ID, crawlerUnderstands, scrambleText } from '@/lib/languages';
import { BEAST_LANGUAGE_ID } from '@/lib/languageList.mjs';
import type { NpcOnlineKeys } from '@/lib/npc/onlineLlm.mjs';
import { speechEngine } from '@/lib/npcSpeech/engine';
import { speakLine } from '@/lib/npcSpeech/providers';
import { voiceTraits } from '@/lib/npcSpeech/voices';

// Lines are only read aloud while they're fresh; the clips are deleted soon after
const FRESH_MS = 60_000;
const CLIP_LIFETIME_MS = 15 * 60_000;
const SWEEP_EVERY_MS = 5 * 60_000;
// Spoken to the mind or in signs: nothing to hear
const SILENT_LANGUAGES = [TELEPATHIC_LANGUAGE_ID, 'ward-sign'];

/** What gets read aloud: no *actions*, emoji or stray symbols. */
export const speakableText = (text: string): string =>
  text
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasWords = (text: string) => /\p{L}/u.test(text);

interface NpcSpeechMakerOptions {
  roomId: string | null | undefined;
  isDm: boolean;
  enabled: boolean;                      // the DM's "Spoken voices" setting
  messages: ChatMessage[];
  mobs: Mob[];
  crawlers: Crawler[];
  personalities: Record<string, NpcGeneratedPersonality>;
  voicePicks?: Record<string, NpcSpeechVoice>;
  keys: NpcOnlineKeys;                   // the DM's Gemini, Groq and ElevenLabs keys (this browser only)
  onAttachAudio: (messageId: string, audio: Pick<ChatMessage, 'audioUrl' | 'audioScrambledUrl'>) => Promise<void> | void;
}

/**
 * Spoken voices, DM side: each new NPC line is read aloud by an online voice service (Gemini, then
 * Groq, then ElevenLabs, as each runs out) or by Kokoro in this browser, saved to Storage as a
 * short clip and linked on the chat line, so every player's device can play it.
 * Players who don't know the line's language get a clip of the scrambled words instead.
 */
export function useNpcSpeechMaker(opts: NpcSpeechMakerOptions) {
  const { roomId, isDm, enabled, messages } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [active, setActive] = useState(false);
  const activeSince = useRef(0);
  const started = useRef(new Set<string>());

  // Only one tab per browser makes clips
  useEffect(() => {
    if (!isDm || !enabled || !roomId || !storage) return;
    // Kokoro is the backup: download it up front only when there's no online voice key
    const keys = optsRef.current.keys;
    if (!keys.gemini?.trim() && !keys.groq?.trim() && !keys.elevenlabs?.trim()) speechEngine.load();
    let release: () => void = () => {};
    let cancelled = false;
    const begin = () => {
      if (cancelled) return;
      activeSince.current = Date.now();
      setActive(true);
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks?.request) {
      locks.request(`dcc-npc-speech-${roomId}`, () => new Promise<void>((resolve) => { release = resolve; begin(); })).catch(() => {});
    } else {
      begin();
    }
    return () => {
      cancelled = true;
      setActive(false);
      release();
    };
  }, [isDm, enabled, roomId]);

  // Delete clips nobody will play any more
  useEffect(() => {
    if (!active || !roomId || !storage) return;
    const store = storage;
    const sweep = async () => {
      try {
        const { items } = await listAll(storageRef(store, `npcAudio/${roomId}`));
        const cutoff = Date.now() - CLIP_LIFETIME_MS;
        await Promise.all(items
          .filter(item => Number(item.name.split('-')[0]) < cutoff)
          .map(item => deleteObject(item).catch(() => {})));
      } catch (err) {
        console.warn('[NpcSpeech] Could not clear old clips', err);
      }
    };
    void sweep();
    const t = setInterval(sweep, SWEEP_EVERY_MS);
    return () => clearInterval(t);
  }, [active, roomId]);

  // Read new NPC lines aloud
  useEffect(() => {
    if (!active || !roomId || !storage) return;
    const store = storage;
    const now = Date.now();
    for (const m of messages) {
      if (m.authorType !== 'npc' || m.translationOf || m.audioUrl || started.current.has(m.id)) continue;
      const at = m.createdAt ?? 0;
      if (at < now - FRESH_MS || at < activeSince.current - 15_000) continue;
      if (m.language && SILENT_LANGUAGES.includes(m.language)) continue;
      const words = speakableText(m.text);
      if (!hasWords(words)) continue;
      started.current.add(m.id);

      const { mobs, crawlers, personalities, voicePicks, keys, onAttachAudio } = optsRef.current;
      const mob = mobs.find(x => x.id === baseMobId(m.authorId));
      const speaker = mob ? withNpcPersonality({ ...mob, id: m.authorId, name: m.authorName }, personalities) : undefined;
      const pick = voicePicks?.[baseMobId(m.authorId)];
      const traits = voiceTraits(m.authorId, speaker, pick);
      const lang = m.language;
      // Beasts: players who don't know Beast see what the creature does, and hear nothing
      const scrambled = lang && lang !== BEAST_LANGUAGE_ID && crawlers.some(c => !crawlerUnderstands(c, lang)) ? speakableText(scrambleText(words, lang)) : '';

      const clip = async (text: string, suffix: string) => {
        const clip = await speakLine({ text, traits, pick }, keys);
        const fileRef = storageRef(store, `npcAudio/${roomId}/${at}-${m.id}${suffix}.${clip.ext}`);
        await uploadBytes(fileRef, clip.blob, { contentType: clip.blob.type });
        return getDownloadURL(fileRef);
      };
      void (async () => {
        try {
          const [audioUrl, audioScrambledUrl] = await Promise.all([
            clip(words, ''),
            hasWords(scrambled) ? clip(scrambled, '-scrambled') : undefined,
          ]);
          await onAttachAudio(m.id, { audioUrl, audioScrambledUrl });
        } catch (err) {
          console.warn('[NpcSpeech] Could not read a line aloud', err);
        }
      })();
    }
  }, [active, roomId, messages]);
}
