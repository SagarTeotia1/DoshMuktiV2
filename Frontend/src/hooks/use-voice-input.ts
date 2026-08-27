'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API isn't in TS's default DOM lib, and only a subset of browsers implement
// it (unprefixed as SpeechRecognition in newer Chrome/Edge, webkitSpeechRecognition
// elsewhere) — this is the minimal shape this hook actually uses.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// A silence/stall watchdog independent of the browser's own end/error events — some
// Chrome builds have been observed to never fire either when the underlying audio
// stream stalls, which would otherwise wedge "listening" state open forever with no
// way for the user to recover except reloading the page.
const STALL_TIMEOUT_MS = 8000;

export interface UseVoiceInputOptions {
  lang?: string;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceInput({ lang = 'hi-IN', onResult, onError }: UseVoiceInputOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    clearStallTimer();
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    }
    recognitionRef.current = null;
    setListening(false);
  }, [clearStallTimer]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (listening) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    // Abort any previous instance defensively — guards against a stray stall-timer
    // firing after a fresh session has already started.
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true; // some Chrome builds never fire a final result at all — accumulate as we go instead of waiting for one
    recognition.maxAlternatives = 1;
    finalTranscriptRef.current = '';
    let latestInterim = '';
    let gotAnyResult = false;

    recognition.onresult = (ev) => {
      gotAnyResult = true;
      clearStallTimer();
      stallTimerRef.current = setTimeout(() => recognition.stop(), STALL_TIMEOUT_MS);

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        if (!result) continue;
        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${result[0].transcript}`.trim();
        } else {
          latestInterim = result[0].transcript;
        }
      }
    };

    recognition.onend = () => {
      // Use whatever final text we got; if the API never finalized anything but did
      // produce interim text, that's still a real transcript worth keeping. Only truly
      // empty (zero onresult events at all — e.g. the speech service call itself was
      // blocked/hung on the network) counts as a failure worth surfacing.
      const transcript = (finalTranscriptRef.current || latestInterim).trim();
      if (transcript) {
        onResult(transcript);
      } else if (!gotAnyResult) {
        onError?.('no-speech-detected');
      }
      teardown();
    };

    recognition.onerror = (ev) => {
      onError?.(ev.error);
      teardown();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      stallTimerRef.current = setTimeout(() => recognition.stop(), STALL_TIMEOUT_MS);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'unknown-start-error');
      teardown();
    }
  }, [lang, listening, onResult, onError, clearStallTimer, teardown]);

  // Stop any in-flight recognition if the component unmounts mid-listen (e.g. the chat
  // panel is closed while the mic is live).
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
