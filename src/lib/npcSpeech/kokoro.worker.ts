// Runs Kokoro text-to-speech off the main thread, so the map stays smooth while a line is spoken
// The model and voices come from Hugging Face, the runtime from jsDelivr; the browser caches both
import { KokoroTTS } from 'kokoro-js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

export type SpeechWorkerRequest =
  | { type: 'load' }
  | { type: 'speak'; id: number; text: string; voice: string; speed: number };

export type SpeechWorkerReply =
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'error'; id?: number; error: string }
  | { type: 'audio'; id: number; wav: ArrayBuffer; seconds: number };

const post = (msg: SpeechWorkerReply, transfer: Transferable[] = []) => self.postMessage(msg, { transfer });

// Download progress across the model's files
const files = new Map<string, { loaded: number; total: number }>();
const onProgress = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
  if (p.status !== 'progress' || !p.file || !p.total) return;
  files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
  let loaded = 0;
  let total = 0;
  for (const f of files.values()) { loaded += f.loaded; total += f.total; }
  post({ type: 'progress', progress: total ? loaded / total : 0 });
};

let tts: Promise<KokoroTTS> | null = null;
const load = () => {
  tts ??= KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'wasm', progress_callback: onProgress });
  return tts;
};

/** 16-bit mono WAV. */
const encodeWav = (samples: Float32Array, rate: number): ArrayBuffer => {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
};

// One line at a time: the model can't run two at once
let chain: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<SpeechWorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'load') {
    load().then(() => post({ type: 'ready' }), (err) => { tts = null; post({ type: 'error', error: String(err?.message ?? err) }); });
    return;
  }
  if (msg.type === 'speak') {
    chain = chain.then(async () => {
      try {
        const model = await load();
        post({ type: 'ready' });
        const audio = await model.generate(msg.text, { voice: msg.voice as never, speed: msg.speed });
        const wav = encodeWav(audio.audio, audio.sampling_rate);
        post({ type: 'audio', id: msg.id, wav, seconds: audio.audio.length / audio.sampling_rate }, [wav]);
      } catch (err) {
        if (!(await tts?.catch(() => null))) tts = null;
        post({ type: 'error', id: msg.id, error: String((err as Error)?.message ?? err) });
      }
    });
  }
};
