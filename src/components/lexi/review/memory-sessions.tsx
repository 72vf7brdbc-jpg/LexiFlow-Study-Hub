// Memorizzazione: Active Recall, Spaced Repetition, Retrieval Practice.
import { Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Stamp } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { gradeAnswer } from "@/lib/grading";
import { buildRecallItems, buildRetrievalQuestions, meaningVariants } from "@/lib/method-exercises";
import { MAX_LEVEL, levelOf, reviewSchedule } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { useRetryQueue, type SessionProps } from "./hooks";
import {
  AnswerBox,
  GapText,
  PromptCard,
  ResultPanel,
  SessionHeader,
  SessionSummary,
  SpeakButton,
  useReviewRecorder,
  xpForAnswer,
  type AnswerMode,
} from "./session-kit";

type Feedback = { correct: boolean; close: boolean; answer: string; mode: AnswerMode; overridden?: boolean };

/* ------------------------------ Active Recall ----------------------------- */

export function ActiveRecallSession({ cards, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("active_recall");
  const items = useMemo(() => buildRecallItems(cards), [cards]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const q = useRetryQueue(items);
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<Feedback | null>(null);

  if (!q.current) return <SessionSummary method="active_recall" cards={cards} {...rec} onExit={onExit} onRestart={onRestart} />;

  const { item, attempt } = q.current;
  const card = byId.get(item.cardId);
  if (!card) return null;
  const toEnglish = item.direction === "it_en";

  function check(raw: string, mode: AnswerMode) {
    const text = raw.trim();
    if (!text || fb) return;
    const g = gradeAnswer(text, toEnglish ? item.expected : meaningVariants(item.expected), mode);
    setAnswer(text);
    setFb({ correct: g.correct, close: g.close, answer: text, mode });
  }

  function next() {
    if (!fb || !card) return;
    rec.save(card.id, fb.correct, fb.mode, fb.answer);
    q.advance(fb.correct);
    setFb(null);
    setAnswer("");
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader method="active_recall" done={q.done} total={q.total} xp={rec.xp} onExit={onExit} />
      <PromptCard eyebrow={toEnglish ? "Come si dice in inglese?" : "Che cosa significa in italiano?"} aside={attempt > 0 ? <Stamp tone="burgundy">Riprova</Stamp> : undefined}>
        <div className="flex items-start gap-2">
          <p className={cn("font-display font-medium leading-snug text-foreground", toEnglish ? "text-[1.7rem]" : "text-[2.1rem] italic")}>{item.prompt}</p>
          {!toEnglish && <SpeakButton text={card.term} />}
        </div>
        {item.note && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{toEnglish ? item.note : <>“{item.note}”</>}</p>}
      </PromptCard>

      {!fb ? (
        <div className="mt-5 space-y-3">
          <AnswerBox
            key={`${item.cardId}-${attempt}`}
            value={answer}
            onChange={setAnswer}
            onSubmit={() => check(answer, "typed")}
            onVoice={(t) => check(t, "voice")}
            placeholder={toEnglish ? "Scrivi la parola inglese…" : "Scrivi il significato…"}
          />
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setFb({ correct: false, close: false, answer: "", mode: "typed" })}>
              Non lo so
            </Button>
            <Button size="lg" onClick={() => check(answer, "typed")} disabled={!answer.trim()}>
              Verifica
            </Button>
          </div>
        </div>
      ) : (
        <ResultPanel
          ok={fb.correct}
          heading={fb.correct ? (fb.close ? "Giusto, occhio all'ortografia" : "Corretto!") : "Non proprio"}
          xp={xpForAnswer(fb.correct, fb.mode)}
          onContinue={next}
          onOverride={!fb.correct && fb.answer ? () => setFb({ ...fb, correct: true, overridden: true }) : undefined}
        >
          {fb.answer && !fb.correct && <p className="text-muted-foreground">Hai scritto: «{fb.answer}»</p>}
          <p className="flex items-center gap-1">
            <span className="font-display text-xl italic text-foreground">{card.term}</span>
            <SpeakButton text={card.term} />
            <span className="text-muted-foreground">— {card.meaning}</span>
          </p>
          {card.example && <p className="italic text-foreground/75">“{card.example}”</p>}
        </ResultPanel>
      )}
    </div>
  );
}

/* ---------------------------- Spaced Repetition --------------------------- */

export function SpacedRepetitionSession({ cards, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("spaced_repetition");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; level: number; days: number } | null>(null);
  const card = cards[index];

  if (!card) return <SessionSummary method="spaced_repetition" cards={cards} {...rec} onExit={onExit} onRestart={onRestart} />;

  const level = levelOf(card);

  function answer(correct: boolean) {
    if (!card || result) return;
    const next = reviewSchedule(card, correct, true);
    rec.save(card.id, correct, "typed", correct ? "La sapevo" : "Non la sapevo");
    setResult({ correct, level: Math.min(MAX_LEVEL, next?.repetitions ?? level), days: next?.interval_days ?? card.interval_days });
  }

  function next() {
    setIndex((i) => i + 1);
    setFlipped(false);
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader method="spaced_repetition" done={index} total={cards.length} xp={rec.xp} onExit={onExit} />
      <PromptCard eyebrow="In scadenza oggi" aside={<LevelDots level={level} />}>
        <div className="flex flex-col items-center py-2 text-center">
          <div className="flex items-center gap-1">
            <p className="font-display text-[2.4rem] font-medium italic leading-tight text-foreground">{card.term}</p>
            <SpeakButton text={card.term} />
          </div>
          {card.phonetic && <p className="mt-1 font-mono text-xs text-muted-foreground">{card.phonetic}</p>}
          {flipped ? (
            <div className="animate-rise mt-6 w-full space-y-2 border-t border-border pt-5">
              <p className="font-display text-xl text-primary">{card.meaning}</p>
              {card.definition && <p className="text-sm text-muted-foreground">{card.definition}</p>}
              {card.example && <p className="text-sm italic text-foreground/75">“{card.example}”</p>}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Pensa al significato, poi gira la scheda.</p>
          )}
        </div>
      </PromptCard>

      {!flipped ? (
        <div className="mt-5 flex justify-center">
          <Button size="lg" onClick={() => setFlipped(true)} className="min-w-[200px]">
            <RotateCcw /> Gira la scheda
          </Button>
        </div>
      ) : !result ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" className="border-burgundy/40 text-burgundy hover:bg-danger-soft hover:text-burgundy" onClick={() => answer(false)}>
            <X /> Non la sapevo
          </Button>
          <Button size="lg" onClick={() => answer(true)}>
            <Check /> La sapevo
          </Button>
        </div>
      ) : (
        <ResultPanel
          ok={result.correct}
          heading={result.correct ? `Sale al livello ${result.level}` : "Torna al livello 1"}
          xp={xpForAnswer(result.correct, "typed")}
          onContinue={next}
        >
          <p className="text-muted-foreground">
            {result.days <= 1 ? "La rivedrai domani." : `La rivedrai tra ${result.days} giorni.`}
          </p>
        </ResultPanel>
      )}
    </div>
  );
}

function LevelDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={level === 0 ? "Parola nuova" : `Livello ${level} di ${MAX_LEVEL}`}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{level === 0 ? "Nuova" : `Livello ${level}/${MAX_LEVEL}`}</span>
      <span className="flex gap-1">
        {Array.from({ length: MAX_LEVEL }, (_, i) => (
          <span key={i} className={cn("size-2 rounded-full", i < level ? "bg-primary" : "bg-secondary")} />
        ))}
      </span>
    </span>
  );
}

/* --------------------------- Retrieval Practice --------------------------- */

export function RetrievalSession({ cards, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("retrieval_practice");
  const questions = useMemo(() => buildRetrievalQuestions(cards), [cards]);
  const [answers, setAnswers] = useState<{ text: string; mode: AnswerMode }[]>([]);
  const [draft, setDraft] = useState("");
  const [overrides, setOverrides] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState(false);

  if (saved) return <SessionSummary method="retrieval_practice" cards={cards} {...rec} onExit={onExit} onRestart={onRestart} />;

  const current = questions[answers.length];

  if (current) {
    const submit = (text: string, mode: AnswerMode) => {
      setAnswers((a) => [...a, { text: text.trim(), mode }]);
      setDraft("");
    };
    return (
      <div className="mx-auto max-w-2xl pb-16">
        <SessionHeader method="retrieval_practice" done={answers.length} total={questions.length} xp={rec.xp} onExit={onExit} />
        <PromptCard eyebrow={current.label} aside={<Stamp tone="navy">Senza aiuti</Stamp>}>
          <p className="font-display text-[1.6rem] font-medium leading-snug text-foreground">
            {current.gap ? <GapText before={current.gap.before} after={current.gap.after} /> : current.prompt}
          </p>
        </PromptCard>
        <div className="mt-5 space-y-3">
          <AnswerBox
            key={answers.length}
            value={draft}
            onChange={setDraft}
            onSubmit={() => draft.trim() && submit(draft, "typed")}
            onVoice={(t) => submit(t, "voice")}
            placeholder="Scrivi la parola inglese…"
          />
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => submit("", "typed")}>
              Non lo so
            </Button>
            <Button size="lg" onClick={() => submit(draft, "typed")} disabled={!draft.trim()}>
              {answers.length + 1 === questions.length ? "Fine: vedi i risultati" : "Avanti"}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">Le risposte corrette compariranno solo alla fine.</p>
        </div>
      </div>
    );
  }

  const graded = questions.map((q, i) => {
    const a = answers[i] ?? { text: "", mode: "typed" as const };
    const auto = a.text ? gradeAnswer(a.text, q.answer, a.mode).correct : false;
    return { q, a, correct: auto || overrides.has(i), auto };
  });
  const right = graded.filter((g) => g.correct).length;

  function confirm() {
    for (const g of graded) rec.save(g.q.cardId, g.correct, g.a.mode, g.a.text);
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader method="retrieval_practice" done={questions.length} total={questions.length} xp={rec.xp} onExit={onExit} />
      <div className="animate-rise mt-6">
        <p className="eyebrow">Risultati</p>
        <h2 className="mt-1 text-[1.8rem] font-medium leading-tight">
          {right} su {questions.length} corrette
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Confronta con le soluzioni. Se una tua risposta era giusta, toccala per segnarla come corretta.</p>
        <ul className="mt-5 space-y-2.5">
          {graded.map((g, i) => (
            <li key={`${g.q.cardId}-${i}`} className={cn("rounded-2xl border px-4 py-3", g.correct ? "border-primary/30 bg-success-soft" : "border-burgundy/30 bg-danger-soft")}>
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-primary-foreground", g.correct ? "bg-primary" : "bg-burgundy")}>
                  {g.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-muted-foreground">{g.q.gap ? `${g.q.gap.before}_____${g.q.gap.after}` : g.q.prompt}</p>
                  <p className="mt-1">
                    <span className="text-muted-foreground">Tu: </span>
                    <span className="font-medium">{g.a.text || "—"}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Soluzione: </span>
                    <span className="font-display text-base italic text-foreground">{g.q.answer}</span>
                  </p>
                </div>
                {!g.auto && g.a.text && (
                  <Button variant="ghost"
                    onClick={() =>
                      setOverrides((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className="shrink-0 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {overrides.has(i) ? "Annulla" : "Era giusta"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end">
          <Button size="lg" onClick={confirm}>
            Conferma e salva
          </Button>
        </div>
      </div>
    </div>
  );
}
