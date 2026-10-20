import { useEffect, useRef, useState } from 'react';
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
import { GESTURE_LANGUAGE_IDS } from '@/lib/languageList.mjs';
import { droidClip } from '@/lib/npcSpeech/droid';
import type { NpcOnlineKeys } from '@/lib/npc/onlineLlm.mjs';
import { speechEngine } from '@/lib/npcSpeech/engine';
import { saveClip, sweepClips } from '@/lib/npcSpeech/clipStore';
import { reportVoiceProblem, speakLine } from '@/lib/npcSpeech/providers';
import { voiceTraits } from '@/lib/npcSpeech/voices';

// Lines are only read aloud while they're fresh; the clips are deleted soon after
const FRESH_MS = 60_000;
const CLIP_LIFETIME_MS = 15 * 60_000;
const SWEEP_EVERY_MS = 5 * 60_000;
// Spoken to the mind or in signs: nothing to hear
const SILENT_LANGUAGES = [TELEPATHIC_LANGUAGE_ID, 'ward-sign'];
// Machines: beeps and whistles made in this browser, for everyone
const DROID_LANGUAGES = ['base64'];

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
 * Groq, then ElevenLabs, as each runs out) or by Kokoro in this browser, saved in the database as a
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
    if (!isDm || !enabled || !roomId) return;
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
    // Say so if another tab already has the job, since that tab may be an old copy of the game
    const waiting = setTimeout(() => {
      if (!cancelled) reportVoiceProblem('Voices are being made in another tab of this browser. Close the other game tabs if lines stay silent');
    }, 3000);
    if (locks?.request) {
      locks.request(`dcc-npc-speech-${roomId}`, () => new Promise<void>((resolve) => {
        release = resolve;
        clearTimeout(waiting);
        reportVoiceProblem(null);
        begin();
      })).catch(() => {});
    } else {
      clearTimeout(waiting);
      begin();
    }
    return () => {
      clearTimeout(waiting);
      reportVoiceProblem(null);
      cancelled = true;
      setActive(false);
      release();
    };
  }, [isDm, enabled, roomId]);

  // Delete clips nobody will play any more
  useEffect(() => {
    if (!active || !roomId) return;
    const sweep = async () => {
      try {
        await sweepClips(roomId, Date.now() - CLIP_LIFETIME_MS);
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
    if (!active || !roomId) return;
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
      // Beast, Plant and Dead: players who don't know the language see what the speaker does, and hear nothing
      let scrambled = lang && !GESTURE_LANGUAGE_IDS.includes(lang) && crawlers.some(c => !crawlerUnderstands(c, lang)) ? speakableText(scrambleText(words, lang)) : '';
      // Real languages (Spanish) sound the same to everyone: one clip
      const sameForAll = scrambled === words;
      if (sameForAll) scrambled = '';
      // Nobody in the party knows it: everyone, the DM too, hears the scrambled words (one clip, not two)
      const nobodyKnows = !!scrambled && !crawlers.some(c => crawlerUnderstands(c, lang));

      const clip = async (text: string, suffix: string) => {
        const clip = await speakLine({ text, traits, pick }, keys);
        return saveClip(roomId, `${m.id}${suffix}`, clip.blob, at);
      };
      const attach = async (): Promise<Pick<ChatMessage, 'audioUrl' | 'audioScrambledUrl'>> => {
        if (lang && DROID_LANGUAGES.includes(lang)) {
          const ref = await saveClip(roomId, m.id, droidClip(words), at);
          return { audioUrl: ref, audioScrambledUrl: ref };
        }
        if (sameForAll) {
          const ref = await clip(words, '');
          return { audioUrl: ref, audioScrambledUrl: ref };
        }
        if (nobodyKnows && hasWords(scrambled)) {
          const ref = await clip(scrambled, '-scrambled');
          return { audioUrl: ref, audioScrambledUrl: ref };
        }
        const [audioUrl, audioScrambledUrl] = await Promise.all([
          clip(words, ''),
          hasWords(scrambled) ? clip(scrambled, '-scrambled') : undefined,
        ]);
        return { audioUrl, audioScrambledUrl };
      };
      void (async () => {
        try {
          await onAttachAudio(m.id, await attach());
          reportVoiceProblem(null);
        } catch (err) {
          console.warn('[NpcSpeech] Could not read a line aloud', err);
          reportVoiceProblem(`${m.authorName}'s last line wasn't sent to players (${(err as Error)?.message ?? err})`);
        }
      })();
    }
  }, [active, roomId, messages]);
}
