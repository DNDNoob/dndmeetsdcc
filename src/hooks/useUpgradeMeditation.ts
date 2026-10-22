import { useEffect, useRef, useState } from 'react';
import { createOnlineLlm, type NpcOnlineKeys } from '@/lib/npc/onlineLlm.mjs';
import type { Crawler, CrawlerStatsById, UpgradePath, UpgradeTree } from '@/lib/gameData';
import {
  MEDITATION_STALE_MS, buildUpgradePrompt, meditationProfile, parseUpgradeTrees, presetUpgradeTrees, type DueUpgrade,
} from '@/lib/upgradeTrees';

interface Options {
  roomId: string | null | undefined;
  isDm: boolean;
  isLoaded: boolean;
  keys: NpcOnlineKeys;
  due: DueUpgrade[];
  crawlers: Crawler[];
  statsById: CrawlerStatsById;
  advanceUpgrade: (due: DueUpgrade) => Promise<UpgradePath | null>;
  offerUpgradeTrees: (due: DueUpgrade, trees: UpgradeTree[], log: NonNullable<UpgradePath['log']>) => Promise<void>;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * The Dungeon AI's meditations, run in the DM's browser like the NPC brain: when an item or spell
 * crosses a milestone, unlock its tree's next step or ask the online model (the NPC Groq/Gemini keys)
 * for new upgrade trees. A bad answer is retried once with the problem; after that, or with no keys,
 * preset trees are offered instead.
 */
export function useUpgradeMeditation({ roomId, isDm, isLoaded, keys, due, crawlers, statsById, advanceUpgrade, offerUpgradeTrees }: Options) {
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const latest = useRef({ crawlers, statsById, advanceUpgrade, offerUpgradeTrees });
  latest.current = { crawlers, statsById, advanceUpgrade, offerUpgradeTrees };
  const llmRef = useRef<ReturnType<typeof createOnlineLlm> | null>(null);
  const inFlight = useRef(new Set<string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [hasLock, setHasLock] = useState(false);
  const [tick, setTick] = useState(0);

  // Only one tab per browser meditates, so a milestone never starts two requests
  useEffect(() => {
    if (!isDm || !roomId) return;
    let release: () => void = () => {};
    let cancelled = false;
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks?.request) {
      locks.request(`dcc-upgrade-meditation-${roomId}`, () => new Promise<void>((resolve) => {
        release = resolve;
        if (!cancelled) setHasLock(true);
      })).catch(() => {});
    } else {
      setHasLock(true);
    }
    return () => {
      cancelled = true;
      setHasLock(false);
      release();
    };
  }, [roomId, isDm]);

  // Look again now and then, so a meditation abandoned by a closed tab gets picked up
  useEffect(() => {
    if (!hasLock) return;
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [hasLock]);

  useEffect(() => {
    if (!hasLock || !isLoaded) return;
    llmRef.current ??= createOnlineLlm(() => keysRef.current, { testUrl: import.meta.env.VITE_NPC_TEST_LLM_URL });

    const meditate = async (d: DueUpgrade) => {
      const { crawlers: party, statsById: stats } = latest.current;
      const tier = d.path.offeredAt ?? d.path.tiersUsed;
      const { system, user } = buildUpgradePrompt({ kind: d.kind, tier, item: d.item, upgrades: d.upgrades, profile: meditationProfile(d, party, stats) });
      const hasKey = !!(keysRef.current.groq?.trim() || keysRef.current.gemini?.trim());
      let lastError = hasKey ? '' : 'No Groq or Gemini key in NPC settings';
      let reply = '';
      let model: string | undefined;
      if (hasKey) {
        let prompt = user;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await llmRef.current!.generate({ tier: 'quality', system, user: prompt, maxTokens: 2500, temperature: 0.9, json: true });
            reply = res.text;
            model = res.label;
          } catch (e) {
            lastError = (e as { note?: string; message?: string }).note || (e as Error).message || 'The online model is unavailable';
            break; // no model to retry with
          }
          const parsed = parseUpgradeTrees(reply, d.kind, tier);
          if ('trees' in parsed) {
            await latest.current.offerUpgradeTrees(d, parsed.trees, { at: new Date().toISOString(), source: 'ai', model, prompt: clip(`${system}\n\n${prompt}`, 6000), reply: clip(reply, 4000) });
            return;
          }
          lastError = parsed.error;
          console.warn('[UpgradeAI] Reply rejected:', parsed.error);
          prompt = `${user}\n\nYour last answer was rejected: ${parsed.error}\nAnswer again with corrected JSON only.`;
        }
      }
      await latest.current.offerUpgradeTrees(d, presetUpgradeTrees(d.kind), {
        at: new Date().toISOString(), source: 'preset', model, prompt: clip(`${system}\n\n${user}`, 6000), reply: reply ? clip(reply, 4000) : undefined, error: lastError,
      });
    };

    for (const d of due) {
      if (inFlight.current.has(d.key)) continue;
      // Another browser may be working on this one: leave it unless it looks abandoned (0 = re-rolled)
      if (d.action === 'meditate' && d.path.meditatingSince && Date.now() - d.path.meditatingSince < MEDITATION_STALE_MS) continue;
      inFlight.current.add(d.key);
      // One request at a time, so a pile of milestones doesn't use up the free limit at once
      queue.current = queue.current.then(async () => {
        try {
          if (d.action === 'advance') {
            const path = await latest.current.advanceUpgrade(d);
            if (path) await meditate({ ...d, path, action: 'meditate' });
          } else {
            await meditate(d);
          }
        } catch (e) {
          console.warn('[UpgradeAI] Meditation failed:', e);
        } finally {
          // Wait for the write to come back before this item can be looked at again
          setTimeout(() => inFlight.current.delete(d.key), 5000);
        }
      });
    }
  }, [due, hasLock, isLoaded, tick]);
}
