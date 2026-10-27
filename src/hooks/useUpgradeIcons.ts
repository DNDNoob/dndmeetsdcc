import { useEffect, useRef, useState } from 'react';
import type { PendingUpgradeIcon, UpgradeTarget } from '@/hooks/useGameState';
import type { IconSubject } from '@/lib/iconGen';
import { describeUpgradeLook } from '@/lib/iconGen';

const RETRY_MS = 15 * 60_000;

interface Options {
  roomId: string | null | undefined;
  isDm: boolean;
  isLoaded: boolean;
  pending: PendingUpgradeIcon[];
  regenerateIcon: (subject: IconSubject, extra?: string) => Promise<{ id: string; image: string } | null>;
  setUpgradeIcon: (crawlerId: string, target: UpgradeTarget, iconId: string) => Promise<void>;
}

/**
 * Redraws an item's or spell's pixel icon after it's upgraded, in the DM's browser (which is signed
 * in to the icon generator). The new icon goes on that crawler's copy only. When the free daily
 * icons are used up the old icon keeps a gold frame, and the redraw is tried again later.
 */
export function useUpgradeIcons({ roomId, isDm, isLoaded, pending, regenerateIcon, setUpgradeIcon }: Options) {
  const latest = useRef({ regenerateIcon, setUpgradeIcon });
  latest.current = { regenerateIcon, setUpgradeIcon };
  const inFlight = useRef(new Set<string>());
  const failedAt = useRef(new Map<string, number>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [hasLock, setHasLock] = useState(false);
  const [tick, setTick] = useState(0);

  // Only one tab per browser redraws, so an upgrade never makes two icons
  useEffect(() => {
    if (!isDm || !roomId) return;
    let release: () => void = () => {};
    let cancelled = false;
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks?.request) {
      locks.request(`dcc-upgrade-icons-${roomId}`, () => new Promise<void>((resolve) => {
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

  // A redraw that failed (icons used up, generator down) is tried again later
  useEffect(() => {
    if (!hasLock) return;
    const id = setInterval(() => setTick(t => t + 1), RETRY_MS);
    return () => clearInterval(id);
  }, [hasLock]);

  useEffect(() => {
    if (!hasLock || !isLoaded) return;
    for (const p of pending) {
      if (inFlight.current.has(p.key) || Date.now() - (failedAt.current.get(p.key) ?? 0) < RETRY_MS) continue;
      inFlight.current.add(p.key);
      queue.current = queue.current.then(async () => {
        try {
          const icon = await latest.current.regenerateIcon(p.subject, describeUpgradeLook(p.baseName, p.upgrades));
          if (icon) {
            await latest.current.setUpgradeIcon(p.crawlerId, p.target, icon.id);
            failedAt.current.delete(p.key);
          } else {
            failedAt.current.set(p.key, Date.now());
            console.warn('[UpgradeIcons] No icon for', p.key, '- will try again later');
          }
        } catch (e) {
          failedAt.current.set(p.key, Date.now());
          console.warn('[UpgradeIcons] Redraw failed:', e);
        } finally {
          // Wait for the write to come back before this item can be looked at again
          setTimeout(() => inFlight.current.delete(p.key), 5000);
        }
      });
    }
  }, [pending, hasLock, isLoaded, tick]);
}
