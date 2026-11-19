// Vocabolario: Collocations, Contextual Learning, Translation Practice.
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState, InlineError, Stamp } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { prepareItalianSentences } from "@/lib/coach.functions";
import { gradeAnswer } from "@/lib/grading";
import { buildCollocationRounds, buildTranslationItems, isOrderCorrect, type CollocationRound, type MatchPair, type TranslationItem } from "@/lib/method-exercises";
import { coachCountsAsCorrect } from "@/lib/methods";
import { shuffle } from "@/lib/practice";
import { cn } from "@/lib/utils";
import { useCoach, useRetryQueue, type SessionProps } from "./hooks";
import {
  AnswerArea,
  AnswerBox,
  CoachFeedback,
  coachHeading,
  GapText,
  Highlighted,
  PromptCard,
  ResultPanel,
  SessionHeader,
  SessionSummary,
  SpeakButton,
  useReviewRecorder,
  xpForAnswer,
  type AnswerMode,
} from "./session-kit";

/* ------------------------------ Collocations ------------------------------ */

export function CollocationsSession({ cards, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("collocations");
  const [rounds] = useState<CollocationRound[]>(() => buildCollocationRounds(cards));
  const [index, setIndex] = useState(0);
  const round = rounds[index];

  if (rounds.length === 0) {
    return <EmptyState icon={<RotateCcw className="size-6" />} title="Nessuna espressione da allenare" description="Servono parole con una frase d'esempio o un'espressione." action={<Button onClick={onExit}>Torna al Ripasso</Button>} />;
  }
  if (!round) return <SessionSummary method="collocations" cards={cards} log={rec.log} xp={rec.xp} streak={rec.streak} onExit={onExit} onRestart={onRestart} />;

  const next = () => setIndex((i) => i + 1);

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader method="collocations" done={index} total={rounds.length} xp={rec.xp} onExit={onExit} />
      {round.type === "match" && (
        <MatchRound
          key={index}
          pairs={round.pairs}
          mode={round.mode}
          onDone={(results) => {
            for (const r of results) rec.save(r.cardId, r.correct, "typed", "abbinamento");
            next();
          }}
        />
      )}
      {round.type === "gap" && (
        <GapRound
          key={index}
          round={round}
          onDone={(correct, answer, mode) => {
            rec.save(round.cardId, correct, mode, answer);
            next();
          }}
        />
      )}
      {round.type === "order" && (
        <OrderRound
          key={index}
          round={round}
          onDone={(correct, answer) => {
            rec.save(round.cardId, correct, "typed", answer);
            next();
          }}
        />
      )}
    </div>
  );
}

function MatchRound({ pairs, mode, onDone }: { pairs: MatchPair[]; mode: "expression" | "meaning"; onDone: (r: { cardId: string; correct: boolean }[]) => void }) {
  const [left] = useState(() => shuffle(pairs.map((_, i) => i)));
  const [right] = useState(() => shuffle(pairs.map((_, i) => i)));
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [selRight, setSelRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<number | null>(null);
  const finished = matched.size === pairs.length;

  function tryPair(l: number | null, r: number | null) {
    if (l === null || r === null) return;
    if (l === r) {
      setMatched((m) => new Set(m).add(l));
    } else {
      setMissed((m) => new Set(m).add(l));
      setFlash(l);
      setTimeout(() => setFlash(null), 450);
    }
    setSelLeft(null);
    setSelRight(null);
  }

  const tile = (active: boolean, done: boolean, wrong: boolean) =>
    cn(
      "w-full rounded-xl border px-3 py-3 text-left text-[15px] transition-all duration-200",
      done ? "border-primary/30 bg-success-soft text-primary" : active ? "border-primary bg-accent shadow-soft" : "border-border bg-paper hover:border-primary/50",
      wrong && "animate-shake border-burgundy bg-danger-soft",
    );

  return (
    <>
      <PromptCard eyebrow="Abbina le coppie" aside={<Stamp tone="camel">{mode === "expression" ? "Espressioni" : "Significati"}</Stamp>}>
        <p className="mb-4 text-sm text-muted-foreground">
          {mode === "expression" ? "Tocca un'espressione a sinistra e la parola che la completa a destra." : "Tocca un significato a sinistra e la parola inglese a destra."}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {left.map((i) => (
              <button
                key={i}
                disabled={matched.has(i) || finished}
                onClick={() => {
                  setSelLeft(i);
                  tryPair(i, selRight);
                }}
                className={tile(selLeft === i, matched.has(i), flash === i)}
              >
                {pairs[i]?.left}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {right.map((i) => (
              <button
                key={i}
                disabled={matched.has(i) || finished}
                onClick={() => {
                  setSelRight(i);
                  tryPair(selLeft, i);
                }}
                className={cn(tile(selRight === i, matched.has(i), false), "font-display italic")}
              >
                {pairs[i]?.right}
              </button>
            ))}
          </div>
        </div>
      </PromptCard>
      {finished && (
        <ResultPanel
          ok={missed.size === 0}
          heading={missed.size === 0 ? "Tutte giuste al primo colpo!" : "Coppie completate"}
          onContinue={() => onDone(pairs.map((p, i) => ({ cardId: p.cardId, correct: !missed.has(i) })))}
        >
          <ul className="space-y-1">
            {pairs.map((p, i) => (
              <li key={p.cardId} className={cn(missed.has(i) ? "text-burgundy" : "text-foreground/85")}>
                {mode === "expression" ? <span className="italic">{p.full}</span> : <><span className="italic">{p.right}</span> — {p.left}</>}
              </li>
            ))}
          </ul>
        </ResultPanel>
      )}
    </>
  );
}

function GapRound({ round, onDone }: { round: Extract<CollocationRound, { type: "gap" }>; onDone: (correct: boolean, answer: string, mode: AnswerMode) => void }) {
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<{ correct: boolean; answer: string; mode: AnswerMode } | null>(null);
  const check = (raw: string, mode: AnswerMode) => {
    const t = raw.trim();
    if (!t || fb) return;
    setAnswer(t);
    setFb({ correct: gradeAnswer(t, round.answer, mode).correct, answer: t, mode });
  };
  return (
    <>
      <PromptCard eyebrow="Completa l'espressione">
        <p className="font-display text-[1.6rem] font-medium leading-snug text-foreground">
          <GapText before={round.before} after={round.after} />
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Significato della parola: {round.meaning}</p>
      </PromptCard>
      {!fb ? (
        <div className="mt-5 space-y-3">
          <AnswerBox value={answer} onChange={setAnswer} onSubmit={() => check(answer, "typed")} onVoice={(t) => check(t, "voice")} placeholder="La parola che manca…" />
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setFb({ correct: false, answer: "", mode: "typed" })}>
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
          heading={fb.correct ? "Corretto!" : "Non proprio"}
          xp={xpForAnswer(fb.correct, fb.mode)}
          onContinue={() => onDone(fb.correct, fb.answer, fb.mode)}
          onOverride={!fb.correct && fb.answer ? () => setFb({ ...fb, correct: true }) : undefined}
        >
          <p className="font-display text-lg italic text-foreground">{round.full}</p>
        </ResultPanel>
      )}
    </>
  );
}

function OrderRound({ round, onDone }: { round: Extract<CollocationRound, { type: "order" }>; onDone: (correct: boolean, answer: string) => void }) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const built = chosen.map((i) => round.tokens[i] ?? "");
  const complete = chosen.length === round.tokens.length;

  return (
    <>
      <PromptCard eyebrow="Rimetti in ordine" aside={<SpeakButton text={round.full} />}>
        <p className="text-sm text-muted-foreground">Tocca le parole nell'ordine giusto. Significato della parola chiave: {round.meaning}</p>
        <div className="mt-4 flex min-h-[3.25rem] flex-wrap gap-2 rounded-xl border border-dashed border-border bg-background/60 p-2.5">
          {chosen.length === 0 && <span className="px-1 py-1.5 text-sm text-muted-foreground/70">La tua frase apparirà qui</span>}
          {chosen.map((i, pos) => (
            <button
              key={`${i}-${pos}`}
              disabled={result !== null}
              onClick={() => setChosen((c) => c.filter((_, p) => p !== pos))}
              className="rounded-lg border border-primary/40 bg-paper px-3 py-1.5 font-display text-[15px] text-foreground shadow-soft"
            >
              {round.tokens[i]}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {round.tokens.map((t, i) =>
            chosen.includes(i) ? (
              <span key={i} className="rounded-lg border border-transparent bg-secondary/60 px-3 py-1.5 font-display text-[15px] text-transparent">
                {t}
              </span>
            ) : (
              <button
                key={i}
                disabled={result !== null}
                onClick={() => setChosen((c) => [...c, i])}
                className="rounded-lg border border-border bg-paper px-3 py-1.5 font-display text-[15px] text-foreground transition-colors hover:border-primary/60"
              >
                {t}
              </button>
            ),
          )}
        </div>
      </PromptCard>
      {result === null ? (
        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setChosen([])} disabled={chosen.length === 0}>
            <RotateCcw /> Ricomincia
          </Button>
          <Button size="lg" disabled={!complete} onClick={() => setResult(isOrderCorrect(built, round.answer))}>
            Verifica
          </Button>
        </div>
      ) : (
        <ResultPanel ok={result} heading={result ? "Ordine perfetto!" : "L'ordine giusto era"} xp={xpForAnswer(result, "typed")} onContinue={() => onDone(result, built.join(" "))}>
          <p className="font-display text-lg italic text-foreground">{round.full}</p>
        </ResultPanel>
      )}
    </>
  );
}

/* --------------------------- Contextual Learning -------------------------- */

const REGISTERS = [
  { id: "formale", label: "Formale" },
  { id: "neutro", label: "Neutro" },
  { id: "informale", label: "Informale" },
] as const;
type Register = (typeof REGISTERS)[number]["id"];

export function ContextualSession({ cards, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("contextual_learning");
  const coach = useCoach();
  const [index, setIndex] = useState(0);
  const [meaning, setMeaning] = useState("");
  const [register, setRegister] = useState<Register | null>(null);
  const [sentence, setSentence] = useState("");
  const [override, setOverride] = useState(false);
  const card = cards[index];

  if (!card) return <SessionSummary method="contextual_learning" cards={cards} log={rec.log} xp={rec.xp} streak={rec.streak} onExit={onExit} onRestart={onRestart} />;

  const ready = meaning.trim() && register && sentence.trim();
  const check = () => {
    if (!ready || !register) return;
    void coach.run({ method: "contextual_learning", cardId: card.id, meaning: meaning.trim(), register, sentence: sentence.trim() });
  };
  const correct = coach.result ? override || coachCountsAsCorrect(coach.result.verdict) : false;
  const next = () => {
    if (coach.result) rec.save(card.id, correct, "typed", `${meaning.trim()} | ${register ?? ""} | ${sentence.trim()}`);
    coach.reset();
    setIndex((i) => i + 1);
    setMeaning("");
    setRegister(null);
    setSentence("");
    setOverride(false);
  };

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader method="contextual_learning" done={index} total={cards.length} xp={rec.xp} onExit={onExit} />
      <PromptCard eyebrow="Leggi la frase" aside={<SpeakButton text={card.example ?? card.term} />}>
        <p className="font-display text-[1.5rem] leading-snug text-foreground">
          <Highlighted text={card.example ?? card.term} term={card.term} />
        </p>
      </PromptCard>

      {!coach.result ? (
        <div key={card.id} className="mt-5 space-y-5">
          <Step n={1} label={`Che cosa significa «${card.term}» in questa frase?`}>
            <AnswerArea value={meaning} onChange={setMeaning} placeholder="Scrivi il significato in italiano…" label="Significato" rows={2} autoFocus />
          </Step>
          <Step n={2} label="Che registro ha?">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Registro">
              {REGISTERS.map((r) => (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={register === r.id}
                  onClick={() => setRegister(r.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                    register === r.id ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-paper hover:border-primary/50",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Step>
          <Step n={3} label={`Usa «${card.term}» in un contesto diverso`}>
            <AnswerArea value={sentence} onChange={setSentence} placeholder="Scrivi una nuova frase in inglese…" label="Nuova frase" rows={2} />
          </Step>
          {coach.error && <InlineError title="Correzione non riuscita" message={coach.error} onRetry={check} />}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={next}>
              Salta
            </Button>
            <Button size="lg" onClick={check} disabled={!ready || coach.loading}>
              {coach.loading ? <Loader2 className="animate-spin" /> : null} Verifica
            </Button>
          </div>
        </div>
      ) : (
        <ResultPanel
          ok={correct}
          heading={override ? "Segnata come giusta" : coachHeading(coach.result.verdict)}
          xp={xpForAnswer(correct, "typed")}
          onContinue={next}
          onOverride={!correct ? () => setOverride(true) : undefined}
        >
          <CoachFeedback result={coach.result} />
          <p className="text-muted-foreground">
            Significato: <span className="text-foreground">{card.meaning}</span>
            {coach.result.actual_register && (
              <>
                {" "}· Registro: <span className="text-foreground">{REGISTERS.find((r) => r.id === coach.result?.actual_register)?.label}</span>
              </>
            )}
          </p>
        </ResultPanel>
      )}
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-secondary font-mono text-[11px] text-primary">{n}</span>
        {label}
      </p>
      {children}
    </div>
  );
}

/* --------------------------- Translation Practice ------------------------- */

export function TranslationSession({ cards, onExit, onRestart }: SessionProps) {
  const rec = useReviewRecorder("translation_practice");
  const prepare = useServerFn(prepareItalianSentences);
  const baseItems = useMemo(() => buildTranslationItems(cards), [cards]);
  const [italian, setItalian] = useState<Map<string, string> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ids = baseItems.filter((i) => i.direction === "it_en").map((i) => i.cardId);
    if (ids.length === 0) {
      setItalian(new Map());
      return;
    }
    prepare({ data: { cardIds: ids.slice(0, 12) } })
      .then((res) => {
        if (res.ok) setItalian(new Map(res.items.map((x) => [x.id, x.it])));
        else {
          setNotice(res.message);
          setItalian(new Map());
        }
      })
      .catch(() => {
        setNotice("Non sono riuscita a preparare le frasi in italiano: oggi traduci solo dall'inglese.");
        setItalian(new Map());
      });
  }, [baseItems, prepare]);

  if (!italian) {
    return (
      <div className="mx-auto max-w-2xl pb-16">
        <SessionHeader method="translation_practice" done={0} total={baseItems.length} xp={0} onExit={onExit} />
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm">Preparo le frasi delle tue lezioni…</p>
        </div>
      </div>
    );
  }

  const items: (TranslationItem & { source: string })[] = baseItems.map((i) => {
    const it = italian.get(i.cardId);
    return i.direction === "it_en" && it ? { ...i, source: it } : { ...i, direction: "en_it", source: i.english };
  });

  return <TranslationRun items={items} cards={cards} notice={notice} rec={rec} onExit={onExit} onRestart={onRestart} />;
}

function TranslationRun({
  items,
  cards,
  notice,
  rec,
  onExit,
  onRestart,
}: {
  items: (TranslationItem & { source: string })[];
  cards: SessionProps["cards"];
  notice: string | null;
  rec: ReturnType<typeof useReviewRecorder>;
  onExit: () => void;
  onRestart: () => void;
}) {
  const coach = useCoach();
  const q = useRetryQueue(items, 0);
  const [answer, setAnswer] = useState("");
  const [override, setOverride] = useState(false);

  if (!q.current) return <SessionSummary method="translation_practice" cards={cards} log={rec.log} xp={rec.xp} streak={rec.streak} onExit={onExit} onRestart={onRestart} />;
  const item = q.current.item;
  const toEnglish = item.direction === "it_en";

  const check = () => {
    if (!answer.trim()) return;
    void coach.run({ method: "translation_practice", cardId: item.cardId, direction: item.direction, source: item.source, answer: answer.trim() });
  };
  const correct = coach.result ? override || coachCountsAsCorrect(coach.result.verdict) : false;
  const next = () => {
    if (coach.result) rec.save(item.cardId, correct, "typed", answer.trim());
    coach.reset();
    q.advance(true);
    setAnswer("");
    setOverride(false);
  };

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <SessionHeader method="translation_practice" done={q.done} total={q.total} xp={rec.xp} onExit={onExit} />
      {notice && <p className="mt-4 rounded-xl border border-camel/50 bg-accent/50 px-4 py-2.5 text-sm text-accent-foreground">{notice}</p>}
      <PromptCard eyebrow={toEnglish ? "Traduci in inglese" : "Traduci in italiano"} aside={<Stamp tone={toEnglish ? "navy" : "green"}>{toEnglish ? "IT → EN" : "EN → IT"}</Stamp>}>
        <div className="flex items-start gap-2">
          <p className="font-display text-[1.45rem] leading-snug text-foreground">{item.source}</p>
          {!toEnglish && <SpeakButton text={item.source} />}
        </div>
      </PromptCard>
      {!coach.result ? (
        <div key={item.cardId} className="mt-5 space-y-3">
          <AnswerArea value={answer} onChange={setAnswer} placeholder={toEnglish ? "Scrivi la frase in inglese…" : "Scrivi la frase in italiano…"} label="Traduzione" autoFocus />
          {coach.error && <InlineError title="Correzione non riuscita" message={coach.error} onRetry={check} />}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={next}>
              Salta
            </Button>
            <Button size="lg" onClick={check} disabled={!answer.trim() || coach.loading}>
              {coach.loading ? <Loader2 className="animate-spin" /> : null} Verifica
            </Button>
          </div>
        </div>
      ) : (
        <ResultPanel
          ok={correct}
          heading={override ? "Segnata come giusta" : coachHeading(coach.result.verdict)}
          xp={xpForAnswer(correct, "typed")}
          onContinue={next}
          onOverride={!correct ? () => setOverride(true) : undefined}
        >
          <CoachFeedback result={coach.result} suggestionLabel="Forma naturale" />
          {toEnglish && (
            <p className="text-muted-foreground">
              Frase della lezione: <span className="italic text-foreground">{item.english}</span>
            </p>
          )}
        </ResultPanel>
      )}
    </div>
  );
}
