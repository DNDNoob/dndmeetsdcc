import type { Firestore } from 'firebase/firestore';
import type { NpcAiSettings, NpcAiStatus, NpcBrain } from '../gameData';

export type NpcTier = 'quality' | 'fast';

export interface NpcLlmAdapter {
  generate(req: { tier: NpcTier; system: string | null; user: string; maxTokens?: number; temperature?: number; json?: boolean }): Promise<{ text: string; label?: string }>;
  prepare?(tier: NpcTier): Promise<{ label?: string | null; note?: string; busy?: boolean }>;
  idle?(): unknown;
}

export interface NpcEngineConfig {
  nearDistance: number;
  npcCooldownMs: number;
  globalGapMs: number;
  idleSilenceMs: number;
  greetCooldownMs: number;
  unloadAfterMs: number;
  jobMaxAgeMs: number;
  transcriptLines: number;
  heartbeatMs: number;
  memoryQuietMs: number;
}

export const DEFAULT_NPC_CONFIG: NpcEngineConfig;

export function whoRuns(settings: Partial<NpcAiSettings> | null | undefined, status: Partial<NpcAiStatus> | null | undefined, now?: number): NpcBrain;

export class NpcLlmUnavailable extends Error {
  constructor(note: string, until?: number);
  note: string;
  until?: number;
}

export class NpcRoom {
  constructor(opts: {
    db: Firestore;
    roomId: string;
    name?: string;
    role: NpcBrain;
    llm: NpcLlmAdapter;
    config?: Partial<NpcEngineConfig>;
    log?: (...a: unknown[]) => void;
    warn?: (...a: unknown[]) => void;
    onLiveChange?: (live: boolean) => void;
  });
  live: boolean;
  dispose(): void;
  /** Online brain: clear a "come back later" wait (e.g. after new keys) and try again now. */
  retryOnline(): Promise<void>;
}
