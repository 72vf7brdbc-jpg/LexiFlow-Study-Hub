// Shared pieces for every Ripasso method: answer saving, header, inputs, feedback and summary.
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Flame, Keyboard, Loader2, Mic, RotateCcw, Sparkles, Square, Trophy, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useVoiceAnswer } from "@/hooks/use-voice-answer";
import type { CoachVerdict } from "@/lib/coach.functions";
import { endOfLocalDay, methodInfo, type MethodId } from "@/lib/methods";
import type { ReviewCard } from "@/lib/queries";
import { recordReview } from "@/lib/review.functions";
import { speakEnglish } from "@/lib/speak";
import { toLocalDateString, xpForAnswer } from "@/lib/streak";
import { splitAround } from "@/lib/practice";
import { cn } from "@/lib/utils";

export type AnswerMode = "typed" | "voice";
export type AnswerLog = { cardId: string; correct: boolean };

/** Saves each answer (schedule, XP, streak, errors notebook) and keeps the session tally. */
export function useReviewRecorder(method: MethodId) {
  const record = useServerFn(recordReview);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  const [log, setLog] = useState<AnswerLog[]>([]);

  // Answers are saved one after the other so XP and streak never overwrite each other.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback(
    (cardId: string, correct: boolean, mode: AnswerMode, answer: string) => {
      setXp((x) => x + xpForAnswer(correct, mode));
      setLog((l) => [...l, { cardId, correct }]);
      const payload = {
        cardId,
        correct,
        mode,
        answer: answer.slice(0, 500),
        localDate: toLocalDateString(),
        method,
        dueBefore: endOfLocalDay().toISOString(),
      };
      chain.current = chain.current
        .then(() => record({ data: payload }))
        .then((res) => {
          if (res.ok) setStreak(res.streak);
          else toast.error(res.message);
        })
        .catch(() => {
          toast.error("Risposta non salvata: controlla la connessione.");
        });
    },
    [record, method],
  );

  return { xp, streak, log, save };
}

export function SessionHeader({ method, done, total, xp, onExit }: { method: MethodId; done: number; total: number; xp: number; onExit: () => void }) {
  const info = methodInfo(method);
  const progress = total ? done / total : 0;
  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          onClick={onExit}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Esci dalla sessione"
          title="Esci dalla sessione"
        >
          <X className="size-5" />
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          <Sparkles className="size-4 text-gold" /> {xp}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <strong className="font-semibold text-primary">{info.name}</strong>
        </span>
        <span className="font-mono">
          {Math.min(done + 1, total)} / {total}
        </span>
      </div>
    </div>
  );
}

/** One-line answer field with an optional microphone. */
export function AnswerBox({
  value,
  onChange,
  onSubmit,
  onVoice,
  placeholder,
  disabled,
  label = "Risposta",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onVoice?: ((text: string) => void) | undefined;
  placeholder: string;
  disabled?: boolean | undefined;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceAnswer(
    useCallback((t: string) => onVoice?.(t), [onVoice]),
    useCallback((m: string) => toast.error(m), []),
  );
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-input bg-paper p-2 shadow-soft transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Keyboard className="ml-2 size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={voice.status === "transcribing" ? "Trascrivo…" : placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled || voice.status !== "idle"}
          aria-label={label}
        />
        {onVoice && <MicButton status={voice.status} onToggle={voice.toggle} />}
      </div>
      {voice.status === "recording" && (
        <p className="mt-2 text-center text-xs font-medium text-burgundy">Sto ascoltando… {voice.seconds}s — tocca ■ quando hai finito</p>
      )}
    </form>
  );
}

/** Multi-line answer area; the microphone adds the spoken text at the end. */
export function AnswerArea({
  value,
  onChange,
  placeholder,
  label,
  rows = 3,
  voice: withVoice = true,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  rows?: number;
  voice?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(value);
  latest.current = value;
  const voice = useVoiceAnswer(
    useCallback((t: string) => onChange(latest.current.trim() ? `${latest.current.trim()} ${t}` : t), [onChange]),
    useCallback((m: string) => toast.error(m), []),
  );
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div>
      <div className="flex items-start gap-2 rounded-2xl border border-input bg-paper p-2 shadow-soft transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={voice.status === "transcribing" ? "Trascrivo…" : placeholder}
          className="min-h-[4.5rem] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          disabled={voice.status !== "idle"}
          aria-label={label}
          maxLength={400}
        />
        {withVoice && <MicButton status={voice.status} onToggle={voice.toggle} />}
      </div>
      {voice.status === "recording" && (
        <p className="mt-2 text-center text-xs font-medium text-burgundy">Sto ascoltando… {voice.seconds}s — tocca ■ quando hai finito</p>
      )}
    </div>
  );
}

function MicButton({ status, onToggle }: { status: "idle" | "recording" | "transcribing"; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={status === "transcribing"}
      aria-label={status === "recording" ? "Ferma registrazione" : "Rispondi a voce"}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
        status === "recording" ? "animate-pulse-ring bg-burgundy text-primary-foreground" : "bg-secondary text-primary hover:bg-accent",
      )}
    >
      {status === "transcribing" ? <Loader2 className="size-5 animate-spin" /> : status === "recording" ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
    </button>
  );
}

export function SpeakButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => speakEnglish(text)}
      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
      aria-label="Ascolta la pronuncia"
    >
      <Volume2 className="size-4" />
    </button>
  );
}

/** Result strip shown after an answer. */
export function ResultPanel({
  ok,
  heading,
  xp,
  children,
  onContinue,
  onOverride,
  continueLabel = "Continua",
}: {
  ok: boolean;
  heading: string;
  xp?: number | undefined;
  children?: ReactNode;
  onContinue: () => void;
  onOverride?: (() => void) | undefined;
  continueLabel?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      className={cn("animate-rise mt-6 rounded-2xl border px-5 py-5", ok ? "border-primary/30 bg-success-soft" : "animate-shake border-burgundy/30 bg-danger-soft")}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground", ok ? "bg-primary" : "bg-burgundy")}>
          {ok ? <Check className="size-5" /> : <X className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={cn("font-display text-xl font-medium", ok ? "text-primary" : "text-burgundy")}>{heading}</p>
            {xp !== undefined && (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
                <Sparkles className="size-4 text-gold" /> +{xp}
              </span>
            )}
          </div>
          <div className="mt-1 space-y-2 text-sm">{children}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        {onOverride ? (
          <button onClick={onOverride} className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Era giusta
          </button>
        ) : (
          <span />
        )}
        <Button ref={ref} size="lg" onClick={onContinue} className={cn("min-w-[150px]", !ok && "bg-burgundy hover:bg-burgundy/90")}>
          {continueLabel} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

const VERDICT_HEADING = { correct: "Ottimo lavoro!", almost: "Quasi perfetto", wrong: "Da rivedere" } as const;

/** AI feedback: verdict, checklist, comment and suggested version. */
export function CoachFeedback({ result, suggestionLabel = "Versione corretta" }: { result: CoachVerdict; suggestionLabel?: string }) {
  return (
    <div className="space-y-3">
      <p className="sr-only">{VERDICT_HEADING[result.verdict]}</p>
      {result.checks.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {result.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 rounded-xl border border-border/70 bg-paper/70 px-3 py-2">
              <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-primary-foreground", c.ok ? "bg-primary" : "bg-burgundy")}>
                {c.ok ? <Check className="size-3" /> : <X className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">{c.label}</span>
                {c.note && <span className="block text-[13px] leading-snug text-muted-foreground">{c.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="leading-relaxed text-foreground/85">{result.feedback}</p>
      {result.literal && (
        <p className="inline-flex items-center gap-1.5 rounded-full border border-camel/60 bg-accent/60 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent-foreground">
          Troppo letterale
        </p>
      )}
      {result.suggestion && (
        <div className="rounded-xl border border-border/70 bg-paper/80 px-4 py-3">
          <p className="eyebrow mb-1">{suggestionLabel}</p>
          <p className="font-display text-[1.05rem] italic leading-snug text-foreground">{result.suggestion}</p>
        </div>
      )}
    </div>
  );
}

export function coachHeading(verdict: CoachVerdict["verdict"]): string {
  return VERDICT_HEADING[verdict];
}

/** Final screen of a session. */
export function SessionSummary({
  method,
  cards,
  log,
  xp,
  streak,
  onExit,
  onRestart,
  extra,
}: {
  method: MethodId;
  cards: readonly ReviewCard[];
  log: readonly AnswerLog[];
  xp: number;
  streak: number | null;
  onExit: () => void;
  onRestart: () => void;
  extra?: ReactNode;
}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const t = setTimeout(() => {
      for (const key of ["review-data", "profile", "stats", "material"]) queryClient.invalidateQueries({ queryKey: [key] });
    }, 800);
    return () => clearTimeout(t);
  }, [queryClient]);

  const first = new Map<string, boolean>();
  for (const a of log) if (!first.has(a.cardId)) first.set(a.cardId, a.correct);
  const total = first.size;
  const right = [...first.values()].filter(Boolean).length;
  const accuracy = total ? right / total : 0;
  const hard = cards.filter((c) => first.get(c.id) === false);

  return (
    <div className="mx-auto max-w-xl">
      <div className="paper animate-rise p-7 text-center shadow-lift sm:p-9">
        <div className="animate-pop mx-auto flex size-16 items-center justify-center rounded-full bg-gold/25 text-accent-foreground">
          <Trophy className="size-7" />
        </div>
        <p className="eyebrow mt-5">{methodInfo(method).name} · completato</p>
        <h1 className="mt-2 text-[2.1rem] font-medium leading-tight">
          {accuracy >= 0.85 ? "Splendido lavoro!" : accuracy >= 0.6 ? "Ottimi progressi." : "Ogni errore è un passo avanti."}
        </h1>
        <div className="mt-7 grid grid-cols-3 gap-3">
          <SummaryStat icon={<Sparkles className="size-4 text-gold" />} value={`+${xp}`} label="XP" />
          <SummaryStat icon={<Check className="size-4 text-primary" />} value={`${Math.round(accuracy * 100)}%`} label="Corrette" />
          <SummaryStat icon={<Flame className="size-4 text-burgundy" />} value={streak === null ? "…" : String(streak)} label="Streak" />
        </div>
        {extra}
        {hard.length > 0 && (
          <div className="mt-7 text-left">
            <p className="eyebrow mb-2">Finite tra gli errori da ripassare</p>
            <ul className="flex flex-wrap gap-2">
              {hard.map((c) => (
                <li key={c.id} className="rounded-full border border-burgundy/25 bg-danger-soft px-3 py-1 font-display text-sm italic text-burgundy">
                  {c.term}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button size="lg" onClick={onExit}>
            Torna al Ripasso <ArrowRight />
          </Button>
          <Button size="lg" variant="outline" onClick={onRestart}>
            <RotateCcw /> Ripeti
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1.5 font-display text-2xl font-medium">{value}</p>
      <p className="eyebrow text-[9.5px]">{label}</p>
    </div>
  );
}

/** The paper card that holds the question. */
export function PromptCard({ eyebrow, children, aside }: { eyebrow: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="animate-rise mt-6">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{eyebrow}</p>
        {aside}
      </div>
      <div className="paper lined mt-3 min-h-[160px] px-6 py-7 shadow-lift sm:px-8">{children}</div>
    </div>
  );
}

export { xpForAnswer };

/** A sentence with the lesson word highlighted. */
export function Highlighted({ text, term }: { text: string; term: string }) {
  const split = splitAround(text, term);
  if (!split) return <>{text}</>;
  return (
    <>
      {split.before}
      <mark className="rounded-md bg-gold/30 px-1 text-foreground">{split.match}</mark>
      {split.after}
    </>
  );
}

/** A sentence with a blank to fill. */
export function GapText({ before, after }: { before: string; after: string }) {
  return (
    <>
      {before}
      <span className="mx-1 inline-block min-w-[4.5rem] border-b-2 border-dashed border-primary align-baseline">&nbsp;</span>
      {after}
    </>
  );
}
