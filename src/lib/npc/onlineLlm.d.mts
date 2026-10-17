import type { NpcLlmAdapter } from './engine.mjs';

/** Free API keys the DM pastes into the NPC settings. Kept in that browser (or the laptop's .env.npc), never in Firestore. */
export interface NpcOnlineKeys {
  groq?: string;
  gemini?: string;
}

export const NPC_ONLINE_PROVIDERS: { id: keyof NpcOnlineKeys; name: string; url: string; models: { quality: string; fast: string } }[];

export function createOnlineLlm(getKeys: () => NpcOnlineKeys, opts?: { testUrl?: string; laptopFallback?: boolean }): NpcLlmAdapter;
