import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Flame, Loader2, Timer, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/lexi/logo";
import { InlineError, LoadingScreen } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sessionSize, weeklyMinutes } from "@/lib/plan";
import { profileQuery } from "@/lib/queries";
import { maxGapDays } from "@/lib/streak";
import { CEFR_LEVELS, NATIVE_LANGUAGES, STUDY_GOALS, type CefrLevel, type StudyGoal } from "@/lib/study-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Il tuo profilo di studio — LexiFlow" },
      { name: "description", content: "Imposta lingua, livello CEFR, obiettivo e frequenza di studio." },
      { property: "og:title", content: "Profilo di studio — LexiFlow" },
      { property: "og:description", content: "Tre passaggi per calibrare le tue schede di inglese." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: Onboarding,
});

const STEPS = ["Lingua & livello", "Obiettivo", "Frequenza & Lezioni"] as const;

const WEEKDAYS = [
  { id: 1, label: "Lunedì", short: "Lun" },
  { id: 2, label: "Martedì", short: "Mar" },
  { id: 3, label: "Mercoledì", short: "Mer" },
  { id: 4, label: "Giovedì", short: "Gio" },
  { id: 5, label: "Venerdì", short: "Ven" },
  { id: 6, label: "Sabato", short: "Sab" },
  { id: 7, label: "Domenica", short: "Dom" },
];

function Onboarding() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<string>(profile.native_language ?? "it");
  const [level, setLevel] = useState<CefrLevel | null>((profile.cefr_level as CefrLevel) ?? null);
  const [goal, setGoal] = useState<StudyGoal | null>((profile.goal as StudyGoal) ?? null);
  
  // Gestione dei giorni di lezione specifici (array di numeri, es. [1, 3, 5])
  const [lessonDays, setLessonDays] = useState<number[]>(profile.lesson_days ?? [1, 3, 5]);
  const [saving, setSaving] = useState(false);

  const daysCount = Math.max(1, lessonDays.length);
  const canNext = step === 0 ? !!lang && !!level : step === 1 ? !!goal : lessonDays.length > 0;

  function toggleDay(dayId: number) {
    setLessonDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort((a, b) => a - b)
    );
  }

  async function finish() {
    if (!level || !goal) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        native_language: lang,
        cefr_level: level,
        goal,
        days_per_week: daysCount,
        lesson_days: lessonDays,
        onboarded: true,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Non è stato possibile salvare il profilo. Riprova.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profilo pronto. Buono studio!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen">
      <div className="stripe-preppy h-1.5 w-full" />
      <div className="mx-auto flex min-h-[calc(100vh-6px)] max-w-3xl flex-col px-5 pb-28 pt-6 sm:px-8 sm:pb-10">
        <div className="flex items-center justify-between">
          <Logo to="/dashboard" />
          <span className="eyebrow">Passo {step + 1} di 3</span>
        </div>

        <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Avanzamento">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-col gap-2">
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: i < step ? "100%" : i === step ? "50%" : "0%" }}
                />
              </div>
              <span className={cn("eyebrow text-[10px]", i === step && "text-foreground")}>{label}</span>
            </li>
          ))}
        </ol>

        <div key={step} className="animate-rise mt-10 flex-1">
          {step === 0 && (
            <section>
              <h1 className="text-[2rem] font-medium leading-tight sm:text-[2.5rem]">
                Partiamo da <span className="italic text-primary">te</span>.
              </h1>
              <p className="mt-2 text-muted-foreground">Le traduzioni delle schede saranno nella tua lingua nativa.</p>

              <h2 className="eyebrow mb-3 mt-8">Lingua nativa</h2>
              <div className="flex flex-wrap gap-2">
                {NATIVE_LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    aria-pressed={lang === l.id}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200",
                      lang === l.id
                        ? "border-primary bg-primary text-primary-foreground shadow-soft"
                        : "border-border bg-paper hover:border-foreground/25",
                    )}
                  >
                    <span aria-hidden="true">{l.flag}</span>
                    {l.name}
                  </button>
                ))}
              </div>

              <h2 className="eyebrow mb-3 mt-9">Il tuo livello d'inglese (CEFR) · obbligatorio</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {CEFR_LEVELS.map((l) => (
                  <OptionCard key={l.id} selected={level === l.id} onClick={() => setLevel(l.id)}>
                    <span className="font-display text-3xl font-medium italic text-primary">{l.id}</span>
                    <span className="mt-2 block font-semibold">{l.name}</span>
                    <span className="mt-1 block text-sm leading-snug text-muted-foreground">{l.blurb}</span>
                  </OptionCard>
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="text-[2rem] font-medium leading-tight sm:text-[2.5rem]">
                Per cosa stai <span className="italic text-primary">studiando</span>?
              </h1>
              <p className="mt-2 text-muted-foreground">L'AI sceglierà il vocabolario più utile per il tuo obiettivo.</p>
              <div className="mt-8 grid gap-3">
                {STUDY_GOALS.map((g) => (
                  <OptionCard key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)} row>
                    <span className="block font-display text-xl font-medium">{g.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{g.blurb}</span>
                  </OptionCard>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-[2rem] font-medium leading-tight sm:text-[2.5rem]">
                Quali giorni hai <span className="italic text-primary">lezione</span>?
              </h1>
              <p className="mt-2 text-muted-foreground">Seleziona i giorni della settimana in cui segui o studi regolarmente.</p>
              
              <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEKDAYS.map((d) => {
                  const isSelected = lessonDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border p-4 font-medium transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-soft"
                          : "border-border bg-paper hover:border-foreground/25 text-foreground",
                      )}
                    >
                      <span>{d.label}</span>
                      <span className={cn("flex size-5 items-center justify-center rounded-full border text-xs", isSelected ? "border-primary-foreground bg-primary-foreground text-primary" : "border-border")}>
                        {isSelected ? <Check className="size-3" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="paper mt-8 grid gap-px overflow-hidden bg-border p-0 sm:grid-cols-3">
                <PlanStat icon={<Layers className="size-4" />} label="Schede per sessione" value={String(sessionSize(level, daysCount))} />
                <PlanStat icon={<Timer className="size-4" />} label="Minuti a settimana" value={`~${weeklyMinutes(level, daysCount)}`} />
                <PlanStat
                  icon={<Flame className="size-4" />}
                  label="Streak"
                  value={maxGapDays(daysCount) === 1 ? "ogni giorno" : `pausa max ${maxGapDays(daysCount) - 1} gg`}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                L'app riconoscerà automaticamente i giorni di lezione per pianificare il riepilogo e i compiti.
              </p>
            </section>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/90 px-5 py-3 backdrop-blur sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className={step === 0 ? "invisible" : ""}>
              <ArrowLeft /> Indietro
            </Button>
            {step < 2 ? (
              <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Continua <ArrowRight />
              </Button>
            ) : (
              <Button size="lg" onClick={finish} disabled={!canNext || saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />} Crea il mio piano
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionCard({ selected, onClick, children, row }: { selected: boolean; onClick: () => void; children: React.ReactNode; row?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-2xl border bg-paper p-5 text-left transition-all duration-200 ease-out hover:-translate-y-px",
        selected ? "border-primary shadow-lift ring-1 ring-primary" : "border-border shadow-soft hover:border-foreground/25",
        row && "pr-14",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute right-4 top-4 flex size-6 items-center justify-center rounded-full border transition-all",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-transparent",
        )}
      >
        <Check className="size-3.5" />
      </span>
    </button>
  );
}

function PlanStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-paper p-5">
      <div className="flex items-center gap-2 text-camel">{icon}<span className="eyebrow">{label}</span></div>
      <p className="mt-2 font-display text-2xl font-medium">{value}</p>
    </div>
  );
}
