// Cuts the burst of static some voice services leave after the last word, and fades the end out.

const FRAME_MS = 10;

/**
 * The samples up to the end of the speech. Speech ends at the last voiced frame (loud, with the low
 * zero-crossing rate of a voice) plus any consonant after it, like a final "s". Anything after a
 * pause with no voice in it (static, a click, a breath) is dropped. A clip with no voice is left as is.
 */
export function trimTrailingNoise(samples: Float32Array, rate: number): Float32Array {
  const frame = Math.max(1, Math.round((rate * FRAME_MS) / 1000));
  const frames = Math.floor(samples.length / frame);
  if (frames < 10) return samples;
  const rms = new Float32Array(frames);
  const zcr = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let crossings = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) {
      sum += samples[i] * samples[i];
      if (i > f * frame && (samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++;
    }
    rms[f] = Math.sqrt(sum / frame);
    zcr[f] = crossings / frame;
  }
  const peak = rms.reduce((m, x) => Math.max(m, x), 0);
  if (peak === 0) return samples;
  const voiced = (f: number) => rms[f] > 0.1 * peak && zcr[f] < 0.2;
  const quiet = (f: number) => rms[f] < 0.04 * peak;

  let last = -1;
  for (let f = frames - 1; f >= 0; f--) if (voiced(f)) { last = f; break; }
  if (last < 0) return samples;

  // Keep what follows the last voiced frame until a pause of 100 ms (a final "s" can come after a
  // short stop, as in "its"), and never more than 400 ms of it
  const maxTail = Math.round(400 / FRAME_MS);
  const pause = Math.round(100 / FRAME_MS);
  let end = last + 1;
  let quietRun = 0;
  while (end < frames && end - last <= maxTail) {
    quietRun = quiet(end) ? quietRun + 1 : 0;
    end++;
    if (quietRun >= pause) break;
  }
  const keep = Math.min(samples.length, (end - quietRun) * frame + Math.round(rate * 0.05));
  if (keep >= samples.length - frame) return fadeOut(samples.slice(), rate);
  return fadeOut(samples.slice(0, keep), rate);
}

/** A 25 ms fade at the very end, so the clip doesn't stop with a click. */
function fadeOut(samples: Float32Array, rate: number): Float32Array {
  const n = Math.min(samples.length, Math.round(rate * 0.025));
  for (let i = 0; i < n; i++) samples[samples.length - n + i] *= 1 - (i + 1) / n;
  return samples;
}
