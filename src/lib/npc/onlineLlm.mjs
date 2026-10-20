/**
 * Free online models for NPC lines: Groq first, then Gemini. Plain JavaScript so both the
 * browser (DM's Show Time) and the laptop script use it. Keys are never stored in Firestore.
 */
import { NpcLlmUnavailable } from './engine.mjs';

// Tried in this order. Model names change often: update them here when a provider retires one.
// `extra` fields are optional; if a provider rejects them the request is retried once without.
export const NPC_ONLINE_PROVIDERS = [
  {
    id: 'groq',
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: { quality: 'openai/gpt-oss-120b', fast: 'openai/gpt-oss-20b' },
    extra: { reasoning_effort: 'low', include_reasoning: false },
    sendTemperature: true,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: { quality: 'gemini-3.5-flash-lite', fast: 'gemini-3.5-flash-lite' },
    extra: { reasoning_effort: 'none' },
    sendTemperature: false, // deprecated on the 3.x Flash models
  },
];

const MINUTE = 60_000;

const clockTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * Groq first, then Gemini when Groq's free limit is used up (or its key fails).
 * Throws NpcLlmUnavailable when neither can answer, so the engine hands over to the laptop.
 *
 * @param {() => {groq?: string, gemini?: string}} getKeys
 * @param {{ testUrl?: string, laptopFallback?: boolean }} [opts] testUrl: practice-game stand-in model
 */
export function createOnlineLlm(getKeys, opts = {}) {
  const restUntil = {};
  const restKey = {}; // the key that was resting: a new key gets tried straight away
  const why = {};
  const noExtras = new Set();
  const covering = opts.laptopFallback ? 'using the laptop model' : "the laptop covers if it's running";

  const usable = () => {
    const keys = getKeys() || {};
    return NPC_ONLINE_PROVIDERS.filter((p) => keys[p.id]?.trim());
  };
  const ready = (p) => (restUntil[p.id] ?? 0) <= Date.now() || restKey[p.id] !== (getKeys() || {})[p.id]?.trim();

  const outOfOptions = () => {
    const withKeys = usable();
    if (!withKeys.length) {
      return new NpcLlmUnavailable('Add a free Groq or Gemini key in NPC settings', Date.now() + 5 * MINUTE);
    }
    const until = Math.min(...withKeys.map((p) => restUntil[p.id] ?? Date.now() + MINUTE));
    const reasons = withKeys.map((p) => why[p.id]).filter(Boolean).join('; ');
    return new NpcLlmUnavailable(`${reasons || 'Online models unavailable'}. Back at ${clockTime(until)}; ${covering}`, until);
  };

  const rest = (p, ms, reason) => {
    restUntil[p.id] = Date.now() + ms;
    restKey[p.id] = (getKeys() || {})[p.id]?.trim();
    why[p.id] = reason;
  };

  async function call(p, key, req) {
    const model = p.models[req.tier];
    const body = {
      model,
      messages: [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        { role: 'user', content: req.user },
      ],
      // Reasoning models spend tokens thinking before they answer, so leave room
      max_tokens: (req.maxTokens ?? 80) + 400,
    };
    if (p.sendTemperature && req.temperature !== undefined) body.temperature = req.temperature;
    const withExtras = !noExtras.has(p.id);
    if (withExtras) Object.assign(body, p.extra);

    let res;
    try {
      res = await fetch(opts.testUrl || p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
    } catch {
      rest(p, 30_000, `Couldn't reach ${p.name}`);
      return null;
    }

    if (res.ok) {
      const data = await res.json();
      delete why[p.id];
      return data?.choices?.[0]?.message?.content ?? '';
    }
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      rest(p, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 * MINUTE, `${p.name} free limit reached`);
    } else if (res.status === 400 && withExtras) {
      noExtras.add(p.id); // an optional setting wasn't accepted: try again without it
      return call(p, key, req);
    } else if (res.status === 401 || res.status === 403) {
      rest(p, 60 * MINUTE, `${p.name} key was rejected`);
    } else if (res.status === 404 || res.status === 400) {
      rest(p, 60 * MINUTE, `${p.name} model ${model} isn't available`);
    } else {
      rest(p, 30_000, `${p.name} error ${res.status}`);
    }
    console.warn(`[NpcBrain] ${p.name} ${res.status}: ${detail}`);
    return null;
  }

  return {
    async prepare(tier) {
      const list = usable();
      const first = list.find(ready);
      if (!first) throw outOfOptions();
      const skipped = list.slice(0, list.indexOf(first)).map((p) => why[p.id]).filter(Boolean);
      return {
        label: `${first.name} ${first.models[tier]}`,
        note: skipped.length ? `${skipped.join('; ')}: using ${first.name}` : '',
      };
    },
    async generate(req) {
      const keys = getKeys() || {};
      for (const p of usable()) {
        if (!ready(p)) continue;
        const text = await call(p, keys[p.id].trim(), req);
        if (text !== null) return { text, label: `${p.name} ${p.models[req.tier]}` };
      }
      throw outOfOptions();
    },
  };
}
