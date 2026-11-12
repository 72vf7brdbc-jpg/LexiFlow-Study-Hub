import { useCallback, useEffect, useRef, useState } from "react";

import { recordWav } from "@/lib/record-wav";
import { transcribeRecording } from "@/lib/transcribe-client";

type Status = "idle" | "recording" | "transcribing";
const MAX_SECONDS = 15;

/** Records a short spoken answer and returns its transcript. */
export function useVoiceAnswer(onTranscript: (text: string) => void, onError: (message: string) => void) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<{ stop: () => Promise<File> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    clearTimer();
    setStatus("transcribing");
    try {
      const file = await rec.stop();
      abortRef.current = new AbortController();
      const text = await transcribeRecording(file, abortRef.current.signal);
      onTranscript(text);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") onError(e instanceof Error ? e.message : "Registrazione non riuscita");
    } finally {
      setStatus("idle");
      setSeconds(0);
    }
  }, [onTranscript, onError]);

  const start = useCallback(async () => {
    if (status !== "idle") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError("Il tuo browser non supporta la registrazione vocale.");
      return;
    }
    try {
      recRef.current = await recordWav();
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) void stop();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      const name = (e as Error)?.name;
      onError(
        name === "NotAllowedError"
          ? "Consenti l'accesso al microfono per rispondere a voce."
          : "Microfono non disponibile su questo dispositivo.",
      );
    }
  }, [status, stop, onError]);

  const toggle = useCallback(() => (status === "recording" ? stop() : start()), [status, start, stop]);

  useEffect(
    () => () => {
      clearTimer();
      abortRef.current?.abort();
      recRef.current?.stop().catch(() => {});
    },
    [],
  );

  return { status, seconds, toggle, maxSeconds: MAX_SECONDS };
}
