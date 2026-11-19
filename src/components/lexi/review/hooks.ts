// Small state helpers shared by the Ripasso sessions.
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";

import { coachEvaluate, type CoachVerdict } from "@/lib/coach.functions";
import type { ReviewCard, ReviewData } from "@/lib/queries";

export type SessionProps = {
  cards: ReviewCard[];
  data: ReviewData;
  onExit: () => void;
  onRestart: () => void;
};

type Entry<T> = { item: T; attempt: number };

/** A queue where a wrong answer comes back a few items later (once). */
export function useRetryQueue<T>(items: readonly T[], maxRetries = 1) {
  const [queue, setQueue] = useState<Entry<T>[]>(() => items.map((item) => ({ item, attempt: 0 })));
  const [done, setDone] = useState(0);
  const current = queue[0];

  const advance = useCallback(
    (correct: boolean) => {
      if (!current) return;
      if (correct || current.attempt >= maxRetries) setDone((d) => d + 1);
      setQueue((q) => {
        const [head, ...rest] = q;
        if (!head) return q;
        if (!correct && head.attempt < maxRetries) rest.splice(Math.min(3, rest.length), 0, { item: head.item, attempt: head.attempt + 1 });
        return rest;
      });
    },
    [current, maxRetries],
  );

  return { current, done, total: items.length, advance };
}

export type CoachPayload =
  | { method: "sentence_creation"; cardId: string; answer: string }
  | { method: "synonyms_paraphrasing"; cardId: string; task: "synonym" | "paraphrase"; answer: string }
  | { method: "contextual_learning"; cardId: string; meaning: string; register: "formale" | "informale" | "neutro"; sentence: string }
  | { method: "translation_practice"; cardId: string; direction: "it_en" | "en_it"; source: string; answer: string };

/** Sends an open answer to the AI coach and keeps its verdict. */
export function useCoach() {
  const evaluate = useServerFn(coachEvaluate);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (payload: CoachPayload) => {
      setLoading(true);
      setError(null);
      try {
        const res = await evaluate({ data: payload });
        if (res.ok) setResult(res.result);
        else setError(res.message);
      } catch {
        setError("La correzione non è disponibile in questo momento. Riprova tra poco.");
      } finally {
        setLoading(false);
      }
    },
    [evaluate],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { run, loading, result, error, reset };
}
