import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the browser Web Speech API (not in TypeScript's DOM lib)
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Hold-to-talk speech recognition using the browser's built-in engine.
 * Call start() on press and stop() on release; onFinal receives the whole
 * transcript once the browser finishes. Unsupported browsers (Firefox) get supported=false.
 */
export const useSpeechToText = (onFinal: (text: string) => void) => {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTextRef.current = '';
    setInterim('');
    setError(null);

    recognition.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalTextRef.current += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim((finalTextRef.current + interimText).trim());
    };
    recognition.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setError(e.error === 'not-allowed' ? 'Microphone access was blocked' : `Speech error: ${e.error}`);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      const text = finalTextRef.current.trim();
      setInterim('');
      if (text) onFinalRef.current(text);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      setError('Could not start the microphone');
      console.error('[Speech] start failed', err);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
};
