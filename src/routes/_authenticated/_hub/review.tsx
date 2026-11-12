import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Flame,
  Keyboard,
  Lightbulb,
  Loader2,
  Mic,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Square,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, InlineError, LoadingScreen, Stamp } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { useVoiceAnswer } from "@/hooks/use-voice-answer";
import { supabase } from "@/integrations/supabase/client";
import { gradeAnswer, type GradeResult } from "@/lib/grading";
import { sessionSize } from "@/lib/plan";
import { profileQuery, type Card } from "@/lib/queries";
import { recordReview } from "@/lib/review.functions";
import { speakEnglish } from "@/lib/speak";
import { toLocalDateString, xpForAnswer } from "@/lib/streak";
import { cn } from "@/lib/utils";

type ReviewSearch = { mode?: "practice" | undefined; material?: string | undefined };

export const Route = createFileRoute("/_authenticated/_hub/review")({
  validateSearch: (s: Record<string, unknown>): ReviewSearch => ({
    mode: s["mode"] === "practice" ? "practice" : undefined,
    material: typeof s["material"] === "string" && /^[0-9a-f-]{36}$/i.test(s["material"]) ? s["material"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ mode: search.mode, material: search.material }),
  loader: async ({ context, deps }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery);
    const size = sessionSize(profile.cefr_level, profile.days_per_week);
    return context.queryClient.ensureQueryData(sessionQuery(deps.mode, deps.material, size));
  },
  head: () => ({
    meta: [
      { title: "Ripasso — LexiFlow Study Hub" },
      { name: "description", content: "Sessione di ripasso con active recall e ripetizione spaziata." },
      { property: "og:title", content: "Ripasso — LexiFlow" },
      { property: "og:description", content: "Rispondi scrivendo o a voce e guadagna XP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: () => <LoadingScreen label="Preparo la sessione…" />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: ReviewPage,
});

function sessionQuery(mode: ReviewSearch["mode"], material: string | undefined, size: number) {
  return queryOptions({
    queryKey: ["session", mode ?? "due", material ?? "all", size],
    queryFn: async (): Promise<Card[]> => {
      let q = supabase.from("cards").select("*");
      if (material) {
        q = q.eq("material_id", material).order("due_at", { ascending: true }).limit(40);
      } else if (mode === "practice") {
        q = q.order("incorrect_count", { ascending: false }).order("ease", { ascending: true }).limit(size);
      } else {
        q = q
          .lte("due_at", new Date().toISOString())
          .order("due_at", { ascending: true })
          .order("incorrect_count", { ascending: false })
          .limit(size);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

type QueueItem = { card: Card; attempt: number };
type Feedback = GradeResult & { answer: string; mode: "typed" | "voice"; overridden?: boolean };

function exerciseType(item: QueueItem): "recall" | "cloze" {
  if (!item.card.cloze) return "recall";
  return (item.card.repetitions + item.attempt) % 2 === 1 ? "cloze" : "recall";
}

function ReviewPage() {
  const search = Route.useSearch();
  const { data: profile } = useSuspenseQuery(profileQuery);
  const size = sessionSize(profile.cefr_level, profile.days_per_week);
  const { data: cards } = useSuspenseQuery(sessionQuery(search.mode, search.material, size));

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <EmptyState
          icon={<PartyPopper className="size-6" />}
          title={search.material ? "Nessuna scheda in questa lezione" : "Sei in pari con il ripasso"}
          description={
            search.material
              ? "Carica un'altra lezione per creare nuove schede."
              : "Nessuna scheda in scadenza adesso. Allenati sulle più difficili o carica nuovo materiale."
          }
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link to="/review" search={{ mode: "practice" }}>Allenamento extra</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/upload">Carica lezione</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return <Session key={`${search.mode}-${search.material}`} cards={cards} />;
}

function Session({ cards }: { cards: Card[] }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const record = useServerFn(recordReview);

  const [queue, setQueue] = useState<QueueItem[]>(() => cards.map((card) => ({ card, attempt: 0 })));
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [sessionXp, setSessionXp] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  const [answers, setAnswers] = useState({ correct: 0, wrong: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const current = queue[0];
  const total = cards.length;
  const finished = !current;
  const type = current ? exerciseType(current) : "recall";

  useEffect(() => {
    if (!feedback) inputRef.current?.focus();
    else continueRef.current?.focus();
  }, [feedback, current?.card.id, current?.attempt]);

  const evaluate = useCallback(
    (raw: string, mode: "typed" | "voice") => {
      if (!current || feedback) return;
      const text = raw.trim();
      if (!text) return;
      const g = gradeAnswer(text, current.card.term, mode);
      setAnswer(text);
      setFeedback({ ...g, answer: text, mode });
    },
    [current, feedback],
  );

  const voice = useVoiceAnswer(
    useCallback((t: string) => evaluate(t, "voice"), [evaluate]),
    useCallback((m: string) => toast.error(m), []),
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    evaluate(answer, "typed");
  }

  function skip() {
    if (!current || feedback) return;
    setFeedback({ correct: false, close: false, similarity: 0, answer: "", mode: "typed" });
  }

  async function next() {
    if (!current || !feedback) return;
    const { card } = current;
    const correct = feedback.correct;
    const mode = feedback.mode;

    // Persist the answer (spaced repetition + XP + streak) in the background.
    record({ data: { cardId: card.id, correct, mode, answer: feedback.answer, localDate: toLocalDateString() } })
      .then((res) => {
        if (res.ok) setStreak(res.streak);
        else toast.error(res.message);
      })
      .catch(() => toast.error("Risposta non salvata: controlla la connessione."));

    setSessionXp((x) => x + xpForAnswer(correct, mode));
    setAnswers((a) => ({ correct: a.correct + (correct ? 1 : 0), wrong: a.wrong + (correct ? 0 : 1) }));
    if (!(card.id in firstTry)) setFirstTry((f) => ({ ...f, [card.id]: correct }));

    setQueue((q) => {
      const rest = q.slice(1);
      if (!correct && current.attempt < 2) {
        const pos = Math.min(3, rest.length);
        rest.splice(pos, 0, { card: { ...card, repetitions: 0 }, attempt: current.attempt + 1 });
      }
      return rest;
    });
    if (correct || current.attempt >= 2) setCompleted((c) => new Set(c).add(card.id));
    setFeedback(null);
    setAnswer("");
    setShowHint(false);
  }

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["material"] });
    }, 800);
    return () => clearTimeout(t);
  }, [finished, queryClient]);

  if (finished) {
    const firstTryCorrect = Object.values(firstTry).filter(Boolean).length;
    const accuracy = total ? firstTryCorrect / total : 0;
    const hard = cards.filter((c) => firstTry[c.id] === false);
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper animate-rise p-7 text-center shadow-lift sm:p-9">
          <div className="animate-pop mx-auto flex size-16 items-center justify-center rounded-full bg-gold/25 text-accent-foreground">
            <Trophy className="size-7" />
          </div>
          <p className="eyebrow mt-5">Sessione completata</p>
          <h1 className="mt-2 text-[2.2rem] font-medium leading-tight">
            {accuracy >= 0.85 ? "Splendido lavoro!" : accuracy >= 0.6 ? "Ottimi progressi." : "Ogni errore è un passo avanti."}
          </h1>
          <div className="mt-7 grid grid-cols-3 gap-3">
            <SummaryStat icon={<Sparkles className="size-4 text-gold" />} value={`+${sessionXp}`} label="XP" />
            <SummaryStat icon={<Check className="size-4 text-primary" />} value={`${Math.round(accuracy * 100)}%`} label="Al primo colpo" />
            <SummaryStat icon={<Flame className="size-4 text-burgundy" />} value={streak === null ? "…" : String(streak)} label="Streak" />
          </div>
          {hard.length > 0 && (
            <div className="mt-7 text-left">
              <p className="eyebrow mb-2">Da rivedere presto</p>
              <ul className="flex flex-wrap gap-2">
                {hard.map((c) => (
                  <li key={c.id} className="rounded-full border border-burgundy/25 bg-danger-soft px-3 py-1 font-display text-sm italic text-burgundy">
                    {c.term}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Torneranno nel ripasso tra pochi minuti, poi a intervalli più lunghi.</p>
            </div>
          )}
          <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Button size="lg" onClick={() => navigate({ to: "/dashboard" })}>
              Torna a Oggi <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/review", search: { mode: "practice" } })}>
              <RotateCcw /> Allenamento extra
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = completed.size / total;
  const c = current.card;
  const clozeParts = (c.cloze ?? "").split(/_{3,}/);

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Chiudi sessione">
          <X className="size-5" />
        </Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          <Sparkles className="size-4 text-gold" /> {sessionXp}
        </span>
      </div>

      <div key={`${c.id}-${current.attempt}`} className="animate-rise mt-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow">{type === "cloze" ? "Completa la frase" : "Come si dice in inglese?"}</p>
          <div className="flex items-center gap-2">
            {current.attempt > 0 && <Stamp tone="burgundy">Riprova</Stamp>}
            <span className="eyebrow">{completed.size + 1} / {total}</span>
          </div>
        </div>

        <div className="paper lined mt-4 min-h-[180px] px-6 py-7 shadow-lift sm:px-8">
          {type === "cloze" ? (
            <>
              <p className="font-display text-[1.6rem] leading-[1.45] sm:text-[1.9rem]">
                {clozeParts[0]}
                <span className="mx-1 inline-block min-w-[5.5rem] border-b-2 border-dashed border-primary text-center text-primary">
                  {feedback ? c.term : "\u00a0"}
                </span>
                {clozeParts.slice(1).join("_____")}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">Significato: {c.meaning}</p>
            </>
          ) : (
            <>
              <p className="font-display text-[2rem] font-medium leading-tight sm:text-[2.4rem]">{c.meaning}</p>
              {c.definition && (showHint || feedback) && <p className="mt-3 text-[15px] text-muted-foreground">{c.definition}</p>}
            </>
          )}
          {showHint && !feedback && (
            <p className="mt-3 font-mono text-sm text-camel">
              Inizia con «{c.term.slice(0, 1)}» · {c.term.split(" ").map((w) => "•".repeat(w.length)).join(" ")}
            </p>
          )}
        </div>

        {!feedback && (
          <form onSubmit={onSubmit} className="mt-5">
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-paper p-2 shadow-soft transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <Keyboard className="ml-2 size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={voice.status === "transcribing" ? "Trascrivo…" : "Scrivi la risposta in inglese"}
                className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={voice.status !== "idle"}
                aria-label="Risposta"
              />
              <button
                type="button"
                onClick={voice.toggle}
                disabled={voice.status === "transcribing"}
                aria-label={voice.status === "recording" ? "Ferma registrazione" : "Rispondi a voce"}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                  voice.status === "recording"
                    ? "animate-pulse-ring bg-burgundy text-primary-foreground"
                    : "bg-secondary text-primary hover:bg-accent",
                )}
              >
                {voice.status === "transcribing" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : voice.status === "recording" ? (
                  <Square className="size-4 fill-current" />
                ) : (
                  <Mic className="size-5" />
                )}
              </button>
            </div>
            {voice.status === "recording" && (
              <p className="mt-2 text-center text-xs font-medium text-burgundy">
                Sto ascoltando… {voice.seconds}s — tocca ■ quando hai finito
              </p>
            )}
            <div className="mt-5 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowHint(true)} disabled={showHint}>
                  <Lightbulb /> Indizio
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={skip}>
                  Non lo so
                </Button>
              </div>
              <Button type="submit" size="lg" disabled={!answer.trim() || voice.status !== "idle"}>
                Verifica
              </Button>
            </div>
          </form>
        )}
      </div>

      {feedback && (
        <FeedbackPanel
          card={c}
          feedback={feedback}
          onOverride={() => setFeedback((f) => (f ? { ...f, correct: true, overridden: true } : f))}
          onContinue={next}
          continueRef={continueRef}
        />
      )}
    </div>
  );
}

function FeedbackPanel({
  card,
  feedback,
  onOverride,
  onContinue,
  continueRef,
}: {
  card: Card;
  feedback: Feedback;
  onOverride: () => void;
  onContinue: () => void;
  continueRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const ok = feedback.correct;
  const xp = xpForAnswer(ok, feedback.mode);
  const heading = useMemo(() => {
    if (ok && feedback.overridden) return "Segnata come corretta";
    if (ok && feedback.close) return "Corretto — occhio all'ortografia!";
    if (ok) return ["Perfetto!", "Esatto!", "Ottimo!", "Bravissimo!"][card.term.length % 4];
    if (feedback.close) return "Ci sei quasi";
    return feedback.answer ? "Non proprio" : "Ecco la risposta";
  }, [ok, feedback, card.term]);

  return (
    <div
      className={cn(
        "animate-rise fixed inset-x-0 bottom-0 z-40 border-t px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 sm:static sm:mt-6 sm:rounded-2xl sm:border sm:pb-5",
        ok ? "border-primary/30 bg-success-soft" : "border-burgundy/30 bg-danger-soft",
        !ok && feedback.answer && "animate-shake",
      )}
      role="status"
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", ok ? "bg-primary text-primary-foreground" : "bg-burgundy text-primary-foreground")}>
              {ok ? <Check className="size-5" /> : <X className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className={cn("font-display text-xl font-medium", ok ? "text-primary" : "text-burgundy")}>{heading}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2">
                <span className="font-display text-2xl italic text-foreground">{card.term}</span>
                {card.phonetic && <span className="font-mono text-xs text-muted-foreground">{card.phonetic}</span>}
                <button
                  onClick={() => speakEnglish(card.term)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  aria-label="Ascolta la pronuncia"
                >
                  <Volume2 className="size-4" />
                </button>
              </div>
              {feedback.answer && (!ok || feedback.mode === "voice" || feedback.close) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {feedback.mode === "voice" ? "Hai detto" : "Hai scritto"}: «{feedback.answer}»
                </p>
              )}
              {card.example && <p className="mt-2 text-sm italic text-foreground/75">“{card.example}”</p>}
            </div>
          </div>
          <span className="hidden shrink-0 items-center gap-1 font-semibold sm:inline-flex">
            <Sparkles className="size-4 text-gold" /> +{xp}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          {!ok && feedback.answer ? (
            <button onClick={onOverride} className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Era giusta
            </button>
          ) : (
            <span className="text-sm font-semibold sm:hidden">
              <Sparkles className="mr-1 inline size-4 text-gold" />+{xp} XP
            </span>
          )}
          <Button
            ref={continueRef}
            size="lg"
            onClick={onContinue}
            className={cn("min-w-[150px]", !ok && "bg-burgundy hover:bg-burgundy/90")}
          >
            Continua <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1.5 font-display text-2xl font-medium">{value}</p>
      <p className="eyebrow text-[9.5px]">{label}</p>
    </div>
  );
}

