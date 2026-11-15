import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, format, startOfWeek, getDay } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, Camera, FileText, Flame, Layers, PenLine, Sparkles, Target, Trophy, CalendarCheck, CheckCircle2, Clock } from "lucide-react";

import { InlineError, LoadingScreen, ProgressRing, Stamp } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { dailyXpGoal, sessionSize } from "@/lib/plan";
import { materialsQuery, profileQuery, statsQuery } from "@/lib/queries";
import { displayedStreak, maxGapDays, toLocalDateString } from "@/lib/streak";
import { goalName, levelName } from "@/lib/study-config";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/_hub/dashboard")({
  head: () => ({
    meta: [
      { title: "Oggi — LexiFlow Study Hub" },
      { name: "description", content: "Il tuo piano di studio di oggi: ripasso, streak e XP." },
      { property: "og:title", content: "Oggi — LexiFlow" },
      { property: "og:description", content: "Ripasso giornaliero, streak e progressi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(profileQuery),
      context.queryClient.ensureQueryData(statsQuery),
      context.queryClient.ensureQueryData(materialsQuery),
    ]),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function Dashboard() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: materials } = useSuspenseQuery(materialsQuery);

  // Recuperiamo anche i compiti (tasks) dal database per il riepilogo odierno
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", profile.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const today = toLocalDateString();
  const now = new Date();
  const jsDay = getDay(now); // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato
  // Convertiamo il giorno JS nel formato della nostra app (1 = Lunedì ... 7 = Domenica)
  const currentDayId = jsDay === 0 ? 7 : jsDay;
  
  // Verifichiamo se oggi è un giorno di lezione configurato nel profilo
  const lessonDays = profile.lesson_days ?? [];
  const isLessonDay = lessonDays.includes(currentDayId);

  const days = profile.days_per_week ?? 5;
  const streak = displayedStreak({ streak: profile.streak, lastStudyDate: profile.last_study_date, daysPerWeek: days }, today);
  const goal = dailyXpGoal(profile.cefr_level, days);
  const size = sessionSize(profile.cefr_level, days);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const studied = new Set(stats.weekStudyDates);
  const studiedCount = week.filter((d) => studied.has(toLocalDateString(d))).length;
  const name = profile.display_name?.split(/[\s.@_]/)[0] ?? "";
  const dueNow = Math.min(stats.dueCount, size);

  // Filtriamo i compiti non completati
  const pendingTasks = tasks.filter((t) => t.status !== "completed");

  return (
    <div className="space-y-8">
      <header className="animate-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">{format(new Date(), "EEEE d MMMM yyyy", { locale: it })}</p>
          <h1 className="text-[2.1rem] font-medium leading-[1.05] sm:text-[2.7rem]">
            {greeting()}
            {name && <span className="italic text-primary">, {name.charAt(0).toUpperCase() + name.slice(1)}</span>}.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Stamp tone="green">Livello {profile.cefr_level} · {levelName(profile.cefr_level)}</Stamp>
          <Stamp tone="navy">{goalName(profile.goal)}</Stamp>
        </div>
      </header>

      {/* Avviso nei giorni di lezione */}
      {isLessonDay && (
        <div className="animate-rise flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 shadow-soft">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <CalendarCheck className="size-5" />
            </div>
            <div>
              <p className="eyebrow text-primary">Oggi hai lezione!</p>
              <h2 className="text-base font-semibold sm:text-lg">Programma della giornata di studio in classe</h2>
              <p className="text-xs text-muted-foreground">Ricordati di caricare i materiali o gli appunti a fine lezione per generare il vocabolario.</p>
            </div>
          </div>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/upload">
              Carica lezione <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="paper animate-rise relative overflow-hidden p-6 shadow-lift sm:p-8 [animation-delay:60ms]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-border" />
          <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full border border-border" />
          <p className="eyebrow">Ripasso di oggi</p>
          {stats.totalCards === 0 ? (
            <>
              <h2 className="mt-3 max-w-md text-[1.9rem] font-medium leading-tight">Carica la tua prima lezione per iniziare.</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Una foto della dispensa o i tuoi appunti bastano: l'AI creerà le schede per il livello {profile.cefr_level}.
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link to="/upload">
                  Carica una lezione <ArrowRight />
                </Link>
              </Button>
            </>
          ) : stats.dueCount > 0 ? (
            <>
              <h2 className="mt-3 text-[1.9rem] font-medium leading-tight">
                <span className="font-display text-5xl italic text-primary">{dueNow}</span> schede ti aspettano
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {stats.dueCount > size
                  ? `Ne hai ${stats.dueCount} in scadenza: la sessione di oggi ne include ${size}, le più urgenti per prime.`
                  : "Prima quelle che hai sbagliato, poi quelle in scadenza. Rispondi scrivendo o a voce."}
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link to="/review">
                  Inizia il ripasso <ArrowRight />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-[1.9rem] font-medium leading-tight">Sei in pari. Ottimo lavoro.</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Nessuna scheda in scadenza ora. Puoi fare un allenamento extra sulle parole più difficili.
              </p>
              <Button asChild size="lg" variant="outline" className="mt-6">
                <Link to="/review" search={{ mode: "practice" }}>
                  Allenamento extra <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="paper animate-rise flex items-center gap-6 p-6 [animation-delay:120ms]">
          <ProgressRing value={stats.todayXp / goal} size={116} stroke={8}>
            <span className="font-display text-3xl font-medium leading-none">{stats.todayXp}</span>
            <span className="eyebrow mt-1 text-[9.5px]">/ {goal} XP</span>
          </ProgressRing>
          <div>
            <p className="eyebrow">Obiettivo giornaliero</p>
            <p className="mt-1.5 font-display text-xl font-medium leading-snug">
              {stats.todayXp >= goal ? "Obiettivo raggiunto!" : `Ancora ${goal - stats.todayXp} XP`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {stats.todayReviews} risposte oggi · 10 XP per risposta giusta, +5 se a voce.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={<Flame className="size-4 text-burgundy" />} label="Streak" value={`${streak}`} unit={streak === 1 ? "giorno" : "giorni"} note={`Record: ${profile.longest_streak}`} />
        <StatTile icon={<Sparkles className="size-4 text-gold" />} label="XP totali" value={`${profile.xp}`} unit="XP" note="Dall'inizio" />
        <StatTile icon={<Trophy className="size-4 text-primary" />} label="Padroneggiate" value={`${stats.masteredCards}`} unit={`/ ${stats.totalCards}`} note="Intervallo ≥ 21 giorni" />
        <StatTile
          icon={<Target className="size-4 text-navy" />}
          label="Precisione"
          value={stats.weekAccuracy === null ? "—" : `${Math.round(stats.weekAccuracy * 100)}`}
          unit={stats.weekAccuracy === null ? "" : "%"}
          note="Questa settimana"
        />
      </section>

      {/* Sezione Compiti in scadenza */}
      <section className="paper p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow">Organizzazione studio</p>
            <h3 className="mt-1 text-xl font-medium">Compiti per casa</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {pendingTasks.length === 0 ? "Nessun compito in sospeso" : `${pendingTasks.length} da completare`}
          </span>
        </div>
        {pendingTasks.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-4 shadow-soft">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow text-[10px] text-primary">{task.exercise_ref || "Compito"}</span>
                    {task.due_date && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="size-3" /> {format(new Date(task.due_date), "d MMM", { locale: it })}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug line-clamp-2">{task.description}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground capitalize">Stato: {task.status}</span>
                  <Link to="/library/$materialId" params={{ materialId: task.material_id }} className="text-xs font-semibold text-primary hover:underline">
                    Visualizza materiale →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-5 text-primary shrink-0" />
            <span>Tutti i compiti assegnati dall'AI sono stati completati o non ci sono scadenze imminenti. Buon lavoro!</span>
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="paper p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="eyebrow">Piano settimanale</p>
              <h3 className="mt-1 text-xl font-medium">
                {studiedCount} di {days} giorni
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {maxGapDays(days) === 1 ? "Streak giornaliera" : `Pausa max ${maxGapDays(days) - 1} gg`}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {week.map((d) => {
              const key = toLocalDateString(d);
              const done = studied.has(key);
              const isToday = key === today;
              return (
                <div key={key} className="flex flex-col items-center gap-2">
                  <span className="eyebrow text-[9.5px]">{format(d, "EEEEEE", { locale: it })}</span>
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors sm:size-10",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : isToday
                          ? "border-primary border-dashed text-primary"
                          : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {done ? <Flame className="size-4" /> : format(d, "d")}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Sessioni da {size} schede, calibrate su livello {profile.cefr_level} e {days} giorni a settimana.
          </p>
        </div>

        <div className="paper p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="eyebrow">Nuovo materiale</p>
              <h3 className="mt-1 text-xl font-medium">Carica una lezione</h3>
            </div>
            <Link to="/library" className="text-sm font-semibold text-primary hover:underline">
              Archivio
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { mode: "photo" as const, icon: Camera, label: "Foto" },
              { mode: "file" as const, icon: FileText, label: "File" },
              { mode: "text" as const, icon: PenLine, label: "Testo" },
            ].map(({ mode, icon: Icon, label }) => (
              <Link
                key={mode}
                to="/upload"
                search={{ mode }}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-background px-2 py-5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-[18px]" />
                </span>
                {label}
              </Link>
            ))}
          </div>
          {materials.length > 0 && (
            <ul className="mt-5 divide-y divide-border border-t border-border">
              {materials.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <Link
                    to="/library/$materialId"
                    params={{ materialId: m.id }}
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-primary"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{m.title}</span>
                      <span className="eyebrow text-[9.5px]">{format(new Date(m.created_at), "d MMM", { locale: it })} · {m.card_count} schede</span>
                    </span>
                    <Layers className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({ icon, label, value, unit, note }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string }) {
  return (
    <div className="paper p-4 sm:p-5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="eyebrow">{label}</span>
      </div>
      <p className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-display text-[2rem] font-medium leading-none">{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
