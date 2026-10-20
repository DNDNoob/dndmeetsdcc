// Creature sounds: reworks a spoken clip in the browser so a goblin squeaks and a dragon rumbles.
// Works on any voice service's clip (WAV or MP3) and gives back a small mono WAV.

interface SoundRecipe {
  rate: number;                                   // playback rate: above 1 is higher and quicker, below 1 deeper and slower
  filters: { type: BiquadFilterType; freq: number; gain?: number; q?: number }[];
  echo?: { delay: number; feedback: number; mix: number };
  growl?: number;                                 // 0..1 soft distortion mixed in
  tremolo?: { rate: number; depth: number };      // wavering volume
}

const RECIPES: Record<string, SoundRecipe> = {
  goblin: { rate: 1.32, filters: [{ type: 'highpass', freq: 250 }, { type: 'peaking', freq: 1800, gain: 7, q: 1.2 }] },
  tiny: { rate: 1.6, filters: [{ type: 'highpass', freq: 300 }] },
  giant: { rate: 0.74, filters: [{ type: 'lowshelf', freq: 220, gain: 7 }], echo: { delay: 0.06, feedback: 0.15, mix: 0.25 } },
  dragon: {
    rate: 0.66,
    filters: [{ type: 'lowshelf', freq: 180, gain: 9 }, { type: 'lowpass', freq: 5200 }],
    echo: { delay: 0.11, feedback: 0.3, mix: 0.35 },
    growl: 0.45,
  },
  ghost: {
    rate: 0.94,
    filters: [{ type: 'highpass', freq: 220 }, { type: 'peaking', freq: 2600, gain: 4, q: 0.8 }],
    echo: { delay: 0.24, feedback: 0.45, mix: 0.5 },
    tremolo: { rate: 5.5, depth: 0.35 },
  },
};

const OUT_RATE = 22050;
const TAIL_SECONDS = 1.2; // room for the echo to die away

export const hasCreatureSound = (id?: string) => !!id && id in RECIPES;

/** The clip with the creature sound put on it, as a mono WAV. */
export async function applyCreatureSound(clip: Blob, id: string): Promise<Blob> {
  const recipe = RECIPES[id];
  if (!recipe) return clip;
  const decoder = new OfflineAudioContext(1, 1, OUT_RATE);
  const input = await decoder.decodeAudioData(await clip.arrayBuffer());
  const length = Math.ceil((input.duration / recipe.rate + (recipe.echo ? TAIL_SECONDS : 0.1)) * OUT_RATE);
  const ctx = new OfflineAudioContext(1, length, OUT_RATE);

  const source = ctx.createBufferSource();
  source.buffer = input;
  source.playbackRate.value = recipe.rate;

  // Filters in a chain
  let node: AudioNode = source;
  for (const f of recipe.filters) {
    const filter = ctx.createBiquadFilter();
    filter.type = f.type;
    filter.frequency.value = f.freq;
    if (f.gain !== undefined) filter.gain.value = f.gain;
    if (f.q !== undefined) filter.Q.value = f.q;
    node.connect(filter);
    node = filter;
  }

  const out = ctx.createGain();
  node.connect(out);

  if (recipe.growl) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 6);
    }
    shaper.curve = curve;
    const growlGain = ctx.createGain();
    growlGain.gain.value = recipe.growl;
    node.connect(shaper).connect(growlGain).connect(out);
  }

  if (recipe.echo) {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = recipe.echo.delay;
    const feedback = ctx.createGain();
    feedback.gain.value = recipe.echo.feedback;
    const wet = ctx.createGain();
    wet.gain.value = recipe.echo.mix;
    node.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(out);
  }

  let last: AudioNode = out;
  if (recipe.tremolo) {
    const trem = ctx.createGain();
    trem.gain.value = 1 - recipe.tremolo.depth / 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = recipe.tremolo.rate;
    const depth = ctx.createGain();
    depth.gain.value = recipe.tremolo.depth / 2;
    lfo.connect(depth).connect(trem.gain);
    lfo.start();
    out.connect(trem);
    last = trem;
  }
  last.connect(ctx.destination);
  source.start();

  const rendered = await ctx.startRendering();
  return toWav(rendered.getChannelData(0), OUT_RATE);
}

/** 16-bit mono WAV, turned up so the loudest moment sits just under full volume. */
function toWav(samples: Float32Array, rate: number): Blob {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const scale = peak > 0 ? 0.95 / peak : 1;
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * scale));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
