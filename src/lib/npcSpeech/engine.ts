// The Kokoro voice engine in this browser: loaded on first use, then makes WAV clips of NPC lines
import { useSyncExternalStore } from 'react';
import type { SpeechWorkerReply, SpeechWorkerRequest } from './kokoro.worker';

export interface SpeechEngineState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress?: number; // 0..1 while the voice model downloads
  error?: string;
}

type Pending = { resolve: (wav: Blob) => void; reject: (err: Error) => void };

class SpeechEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Set<() => void>();
  state: SpeechEngineState = { status: 'idle' };

  private set(next: SpeechEngineState) {
    this.state = next;
    this.listeners.forEach(l => l());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getState = () => this.state;

  private send(msg: SpeechWorkerRequest) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<SpeechWorkerReply>) => this.onReply(e.data);
      this.worker.onerror = (e) => {
        console.warn('[NpcSpeech] Voice engine stopped', e.message);
        this.set({ status: 'error', error: e.message || 'Voice engine stopped' });
        this.pending.forEach(p => p.reject(new Error('Voice engine stopped')));
        this.pending.clear();
        this.worker = null;
      };
    }
    this.worker.postMessage(msg);
  }

  private onReply(msg: SpeechWorkerReply) {
    if (msg.type === 'progress') {
      if (this.state.status !== 'ready') this.set({ status: 'loading', progress: msg.progress });
    } else if (msg.type === 'ready') {
      if (this.state.status !== 'ready') this.set({ status: 'ready' });
    } else if (msg.type === 'audio') {
      this.pending.get(msg.id)?.resolve(new Blob([msg.wav], { type: 'audio/wav' }));
      this.pending.delete(msg.id);
    } else if (msg.type === 'error') {
      if (msg.id === undefined) {
        console.warn('[NpcSpeech] Could not load the voice model:', msg.error);
        this.set({ status: 'error', error: msg.error });
        return;
      }
      this.pending.get(msg.id)?.reject(new Error(msg.error));
      this.pending.delete(msg.id);
    }
  }

  /** Start downloading the voice model (about 330 MB the first time; the browser keeps it). */
  load() {
    if (this.state.status === 'loading' || this.state.status === 'ready') return;
    this.set({ status: 'loading', progress: 0 });
    this.send({ type: 'load' });
  }

  /** A WAV clip of the text in the given voice. */
  speak(text: string, voice: string, speed = 1): Promise<Blob> {
    this.load();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: 'speak', id, text, voice, speed });
    });
  }
}

export const speechEngine = new SpeechEngine();

/** The voice engine's download/ready state, for settings screens. */
export const useSpeechEngineState = () => useSyncExternalStore(speechEngine.subscribe, speechEngine.getState);
