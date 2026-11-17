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
  Timer,
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
import { PRACTICE_CATEGORIES, buildExercise, type Exercise, type PracticeMethod } from "@/lib/practice";

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
      { name: "description", content: "Sessione di ripasso avanzata con le 10 metodologie C1." },
      { property: "og:title", content: "Ripasso — LexiFlow" },
      { property: "og:description", content: "Sessioni mirate di Active Recall, Spaced Repetition, Speaking e altro." },
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

function ReviewPage() {
  const search = Route.useSearch();
  const { data: profile } = useSuspenseQuery(profileQuery);
  const size = sessionSize(profile.cefr_level, profile.days_per_week);
  const { data: cards } = useSuspenseQuery(sessionQuery(search.mode, search.material, size));

  const [selectedMethod, setSelectedMethod] = useState<PracticeMethod | null>(null);

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

  if (!selectedMethod) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 animate-rise pb-12">
        <header className="space-y-2">
          <p className="eyebrow text-primary">Metodologie di studio C1</p>
          <h1 className="text-[2rem] font-medium leading-tight">Come vuoi ripassare oggi?</h1>
          <p className="text-sm text-muted-foreground">
            Ogni metodologia attiva processi cognitivi differenti. Scegli quella più adatta al tuo obiettivo di studio attuale.
          </p>
        </header>

        <div className="space-y-8">
          {Object.entries(PRACTICE_CATEGORIES).map(([catKey, catData]) => (
            <div key={catKey} className="space-y-3">
              <h3 className="font-display text-lg font-medium text-foreground flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" /> {catData.title}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {catData.methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m)}
                    className="paper text-left p-5 transition-all duration-200 hover:border-primary hover:shadow-soft flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors">{m.name}</span>
                        <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5 font-mono text-muted-foreground">#{m.id}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{m.description}</p>
                    </div>
                    <div className="mt-5 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Avvia sessione <ArrowRight className="size-3 ml-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Session
      key={`${search.mode}-${search.material}-${selectedMethod.type}`}
      cards={cards}
      method={selectedMethod}
      onBack={() => setSelectedMethod(null)}
    />
  );
}

type QueueItem = { card: Card; attempt: number };
type Feedback = GradeResult & { answer: string; mode: "typed" | "voice"; overridden?: boolean };

function Session({ cards, method, onBack }: { cards: Card[]; method: PracticeMethod; onBack: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const record = useServerFn(recordReview);

  const [queue, setQueue] = useState<QueueItem[]>(() => cards.map((card) => ({ card, attempt: 0 })));
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [sessionXp, setSessionXp] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  
  const [selectedRegister, setSelectedRegister] = useState<string | null>(null);
  const [speakingSecondsLeft, setSpeakingSecondsLeft] = useState<number>(90);
  const [speakingActive, setSpeakingActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const currentItem = queue[0];
  const total = cards.length;
  const finished = !currentItem;

  useEffect(() => {
    if (currentItem) {
      const ex = buildExercise(currentItem.card, method.type as any, cards, Math.random);
      setCurrentExercise(ex);
      setAnswer("");
      setSelectedRegister(null);
      if (method.type === "speaking_challenge") {
        setSpeakingSecondsLeft(ex.timerSeconds ?? 90);
        setSpeakingActive(true);
      }
    }
  }, [currentItem, method.type, cards]);

  useEffect(() => {
    if (!speakingActive || speakingSecondsLeft <= 0) return;
    const t = setInterval(() => {
      setSpeakingSecondsLeft((s) => {
        if (s <= 1) {
          setSpeakingActive(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [speakingActive, speakingSecondsLeft]);

  useEffect(() => {
    if (!feedback) inputRef.current?.focus();
    else continueRef.current?.focus();
  }, [feedback, currentItem?.card.id]);

  const evaluate = useCallback(
    (raw: string, mode: "typed" | "voice") => {
      if (!currentItem || !currentExercise || feedback) return;
      const text = raw.trim();
      if (!text && method.type !== "speaking_challenge" && method.type !== "spaced_repetition") return;
      
      const targetTerm = currentExercise.answers[0] ?? currentItem.card.term;
      const g = gradeAnswer(text || targetTerm, targetTerm, mode);
      setAnswer(text);
      setFeedback({ ...g, answer: text || "(Completato)", mode });
    },
    [currentItem, currentExercise, feedback, method.type],
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
    if (!currentItem || feedback) return;
    setFeedback({ correct: false, close: false, similarity: 0, answer: "", mode: "typed" });
  }

  async function next() {
    if (!currentItem || !feedback || !currentExercise) return;
    const { card } = currentItem;
    const correct = feedback.correct;
    const mode = feedback.mode;

    record({ data: { cardId: card.id, correct, mode, answer: feedback.answer, localDate: toLocalDateString() } })
      .then((res) => {
        if (res.ok) setStreak(res.streak);
        else toast.error(res.message);
      })
      .catch(() => toast.error("Errore di salvataggio"));

    setSessionXp((x) => x + xpForAnswer(correct, mode));
    if (!(card.id in firstTry)) setFirstTry((f) => ({ ...f, [card.id]: correct }));

    setQueue((q) => {
      const rest = q.slice(1);
      if (!correct && currentItem.attempt < 2) {
        const pos = Math.min(3, rest.length);
        rest.splice(pos, 0, { card: { ...card, repetitions: 0 }, attempt: currentItem.attempt + 1 });
      }
      return rest;
    });
    if (correct || currentItem.attempt >= 2) setCompleted((c) => new Set(c).add(card.id));
    setFeedback(null);
    setAnswer("");
    setShowHint(false);
  }

  if (finished) {
    const firstTryCorrect = Object.values(firstTry).filter(Boolean).length;
    const accuracy = total ? firstTryCorrect / total : 0;
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper animate-rise p-7 text-center shadow-lift sm:p-9">
          <div className="animate-pop mx-auto flex size-16 items-center justify-center rounded-full bg-gold/25 text-accent-foreground">
            <Trophy className="size-7" />
          </div>
          <p className="eyebrow mt-5">Sessione completata ({method.name})</p>
          <h1 className="mt-2 text-[2.2rem] font-medium leading-tight">
            {accuracy >= 0.85 ? "Splendido lavoro!" : "Ottimo impegno!"}
          </h1>
          <div className="mt-7 grid grid-cols-3 gap-3">
            <SummaryStat icon={<Sparkles className="size-4 text-gold" />} value={`+${sessionXp}`} label="XP" />
            <SummaryStat icon={<Check className="size-4 text-primary" />} value={`${Math.round(accuracy * 100)}%`} label="Al primo colpo" />
            <SummaryStat icon={<Flame className="size-4 text-burgundy" />} value={streak === null ? "…" : String(streak)} label="Streak" />
          </div>
          <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Button size="lg" onClick={() => navigate({ to: "/dashboard" })}>
              Torna a Oggi <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" onClick={onBack}>
              <RotateCcw /> Cambia metodologia
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = completed.size / total;
  const card = currentItem.card;
  const ex = currentExercise;

  return (
    <div className="mx-auto flex max-w-2xl flex-col pb-16">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" title="Cambia metodologia">
          <X className="size-5" />
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          <Sparkles className="size-4 text-gold" /> {sessionXp}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Metodologia attiva: <strong className="text-primary">{method.name}</strong></span>
        <span>{completed.size + 1} / {total}</span>
      </div>

      {ex && (
        <div key={`${card.id}-${currentItem.attempt}`} className="animate-rise mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-primary">{method.category}</p>
            {currentItem.attempt > 0 && <Stamp tone="burgundy">Riprova</Stamp>}
          </div>

          <div className="paper lined p-6 sm:p-8 shadow-lift space-y-4">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{method.name}</p>
            
            <p className="font-display text-xl sm:text-2xl leading-relaxed font-medium text-foreground">
              {ex.prompt}
            </p>

            {ex.note && (
              <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-xl border border-border/50">
                {ex.note}
              </p>
            )}

            {ex.gap && (
              <div className="p-4 rounded-xl bg-background border border-border font-display text-lg">
                {ex.gap.before} <span className="text-primary underline decoration-dashed underline-offset-4 font-bold">_____</span> {ex.gap.after}
              </div>
            )}

            {ex.scrambledWords && (
              <div className="flex flex-wrap gap-2 pt-2">
                {ex.scrambledWords.map((w, i) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-secondary font-mono text-sm border border-border">{w}</span>
                ))}
              </div>
            )}

            {ex.registerOptions && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Seleziona il registro linguistico:</p>
                <div className="flex gap-2">
                  {ex.registerOptions.map((reg) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setSelectedRegister(reg)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-semibold border transition-all",
                        selectedRegister === reg ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-secondary"
                      )}
                    >
                      {reg}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ex.speakingWords && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Timer className="size-4 text-gold" /> Tempo consigliato: {Math.floor(speakingSecondsLeft / 60)}:{String(speakingSecondsLeft % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-semibold text-primary">Parla ad alta voce</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ex.speakingWords.map((w, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-accent/30 text-accent-foreground text-xs font-display font-medium border border-primary/20">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!feedback && (
            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              {method.type !== "speaking_challenge" && method.type !== "spaced_repetition" ? (
                <div className="flex items-center gap-2 rounded-2xl border border-input bg-paper p-2 shadow-soft transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <Keyboard className="ml-2 size-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={voice.status === "transcribing" ? "Trascrivo…" : "Scrivi la risposta o traduzione qui…"}
                    className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    disabled={voice.status !== "idle"}
                  />
                  <button
                    type="button"
                    onClick={voice.toggle}
                    disabled={voice.status === "transcribing"}
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                      voice.status === "recording"
                        ? "animate-pulse-ring bg-burgundy text-primary-foreground"
                        : "bg-secondary text-primary hover:bg-accent",
                    )}
                  >
                    {voice.status === "transcribing" ? <Loader2 className="size-5 animate-spin" /> : voice.status === "recording" ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
                  </button>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowHint(true)} disabled={showHint}>
                    <Lightbulb /> Indizio
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={skip}>
                    Salta / Non lo so
                  </Button>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={method.type !== "speaking_challenge" && method.type !== "spaced_repetition" && !answer.trim()}
                >
                  {method.type === "spaced_repetition" || method.type === "speaking_challenge" ? "Fatto / Verifica" : "Verifica"}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {feedback && (
        <FeedbackPanel
          card={card}
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

  return (
    <div
      className={cn(
        "animate-rise fixed inset-x-0 bottom-0 z-40 border-t px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 sm:static sm:mt-6 sm:rounded-2xl sm:border sm:pb-5",
        ok ? "border-primary/30 bg-success-soft" : "border-burgundy/30 bg-danger-soft",
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
              <p className={cn("font-display text-xl font-medium", ok ? "text-primary" : "text-burgundy")}>
                {ok ? "Corretto!" : "Non proprio"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2">
                <span className="font-display text-2xl italic text-foreground">{card.term}</span>
                <button
                  onClick={() => speakEnglish(card.term)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground"
                >
                  <Volume2 className="size-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Significato: {card.meaning}</p>
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
          ) : <span />}
          <Button ref={continueRef} size="lg" onClick={onContinue} className={cn("min-w-[150px]", !ok && "bg-burgundy hover:bg-burgundy/90")}>
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
