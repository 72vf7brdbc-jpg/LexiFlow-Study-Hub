import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/lexi/ui-bits";
import { gradeAnswer } from "@/lib/grading";
import { buildErrorExercise } from "@/lib/method-exercises";
import { mistakePhase } from "@/lib/mistakes";
import { useRetryQueue, type SessionProps } from "./hooks";
import { AnswerBox, GapText, PromptCard, ResultPanel, SessionHeader, SessionSummary, useReviewRecorder, xpForAnswer, type AnswerMode } from "./session-kit";

export function ErrorSession({ cards, data, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("error_based");
  const [items] = useState(() => cards.map((card) => {
    const mistake = data.mistakes.find((m) => m.card_id === card.id);
    return { card, mistake, exercise: buildErrorExercise(card, mistake?.method ?? "active_recall", cards, 0) };
  }));
  const q = useRetryQueue(items, 0);
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<{ correct: boolean; answer: string; mode: AnswerMode } | null>(null);
  if (!q.current) return <SessionSummary method="error_based" cards={cards} {...rec} onExit={onExit} onRestart={onRestart} />;
  const { card, mistake, exercise } = q.current.item;
  const phase = mistake ? mistakePhase(mistake) : "practice";
  const check = (raw: string, mode: AnswerMode) => {
    if (!raw.trim() || fb) return;
    setAnswer(raw);
    setFb({ correct: gradeAnswer(raw, exercise.answers.join(";"), mode).correct, answer: raw.trim(), mode });
  };
  return <div className="mx-auto max-w-2xl pb-16">
    <SessionHeader method="error_based" done={q.done} total={q.total} xp={rec.xp} onExit={onExit} />
    <PromptCard eyebrow={exercise.instruction} aside={<Stamp tone="burgundy">{phase === "check" ? "Verifica dopo 3 giorni" : "Riallenamento"}</Stamp>}>
      {exercise.gap ? <p className="font-display text-2xl"><GapText {...exercise.gap} /></p> : <p className="font-display text-2xl">{exercise.prompt}</p>}
    </PromptCard>
    {!fb ? <div className="mt-5 space-y-3"><AnswerBox value={answer} onChange={setAnswer} onSubmit={() => check(answer, "typed")} onVoice={(t) => check(t, "voice")} placeholder="Scrivi la risposta…" /><div className="flex justify-between"><Button variant="ghost" onClick={() => setFb({ correct: false, answer: "", mode: "typed" })}>Non lo so</Button><Button disabled={!answer.trim()} onClick={() => check(answer, "typed")}>Verifica</Button></div></div> : <ResultPanel ok={fb.correct} heading={fb.correct ? phase === "check" ? "Errore superato!" : "Bene! Verifica tra 3 giorni" : "Continuiamo ad allenarla"} xp={xpForAnswer(fb.correct, fb.mode)} onOverride={!fb.correct && fb.answer ? () => setFb({ ...fb, correct: true }) : undefined} onContinue={() => { rec.save(card.id, fb.correct, fb.mode, fb.answer); q.advance(true); setFb(null); setAnswer(""); }}><p className="font-display text-xl italic">{card.term} — {card.meaning}</p>{card.example && <p>{card.example}</p>}</ResultPanel>}
  </div>;
}
