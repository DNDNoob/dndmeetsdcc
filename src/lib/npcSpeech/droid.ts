// Droid chatter for Base64 lines: beeps, whistles and warbles made right here (no voice service),
// a little like a certain astromech. The same line always makes the same sounds.

const RATE = 22050;

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Sound = 'beep' | 'whistle' | 'warble' | 'trill';

/** Mono samples (-1..1) at 22,050 Hz: about one sound per syllable, at most 4 seconds. */
export function droidChatter(text: string): { samples: Float32Array; rate: number } {
  const rand = seeded(hash(text));
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const syllables = Math.round((text.match(/[aeiouy]+/gi)?.length ?? text.length / 3) * 0.7);
  const count = Math.max(3, Math.min(18, syllables));
  const parts: Float32Array[] = [];
  let total = 0;
  for (let i = 0; i < count && total < RATE * 4; i++) {
    const r = rand();
    const kind: Sound = r < 0.4 ? 'beep' : r < 0.7 ? 'whistle' : r < 0.88 ? 'warble' : 'trill';
    const seconds = kind === 'beep' ? between(0.05, 0.12) : kind === 'trill' ? between(0.2, 0.35) : between(0.12, 0.3);
    const n = Math.floor(seconds * RATE);
    const out = new Float32Array(n);
    const f0 = between(900, 3200);
    // Whistles glide up or down; the last sound often rises, like a question
    const f1 = kind === 'whistle' ? (i === count - 1 && rand() < 0.6 ? f0 * between(1.4, 1.9) : between(800, 3400)) : f0 * between(0.9, 1.1);
    const wobble = kind === 'warble' ? between(18, 32) : kind === 'trill' ? between(35, 55) : 0;
    const depth = kind === 'warble' ? between(150, 400) : kind === 'trill' ? between(300, 700) : 0;
    let phase = 0;
    for (let s = 0; s < n; s++) {
      const t = s / n;
      const f = f0 + (f1 - f0) * t + depth * Math.sin(2 * Math.PI * wobble * (s / RATE));
      phase += (2 * Math.PI * f) / RATE;
      // A touch of the third harmonic gives it the electronic edge
      const tone = Math.sin(phase) + 0.25 * Math.sin(3 * phase);
      const env = Math.min(1, s / (0.004 * RATE), (n - s) / (0.008 * RATE));
      out[s] = 0.42 * tone * env;
    }
    parts.push(out);
    total += n;
    const gap = Math.floor(between(0.02, 0.09) * RATE);
    parts.push(new Float32Array(gap));
    total += gap;
  }
  const samples = new Float32Array(total);
  let at = 0;
  for (const p of parts) { samples.set(p, at); at += p.length; }
  return { samples, rate: RATE };
}

/** 16-bit mono WAV bytes for samples in -1..1. */
export function wavBytes(samples: Float32Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

/** A WAV clip of droid chatter for a line. */
export const droidClip = (text: string): Blob => {
  const { samples, rate } = droidChatter(text);
  return new Blob([wavBytes(samples, rate)], { type: 'audio/wav' });
};
