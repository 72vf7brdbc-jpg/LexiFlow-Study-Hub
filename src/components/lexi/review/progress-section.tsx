import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, ChartNoAxesColumnIncreasing, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewProgressQuery } from "@/lib/queries";
import { reviewProgress } from "@/lib/review-progress";
import { toLocalDateString } from "@/lib/streak";
import { cn } from "@/lib/utils";

export function ReviewProgressSection() {
  const { data } = useSuspenseQuery(reviewProgressQuery);
  const report = reviewProgress(data);
  const [selected, setSelected] = useState(toLocalDateString());
  const day = report.days.find((item) => item.date === selected) ?? report.days.at(-1);
  return <section aria-label="Progressi degli ultimi 14 giorni" className="mb-9 border-y border-border py-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-medium">I tuoi progressi</h2><span className="text-xs text-muted-foreground">Ultimi 14 giorni · Tutte le lezioni</span></div>
    <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
      {[{ label: "Risposte", value: report.answers, icon: ChartNoAxesColumnIncreasing }, { label: "Corrette", value: report.accuracy === null ? "—" : `${report.accuracy}%`, icon: Check }, { label: "Giorni di studio", value: `${report.activeDays}/14`, icon: CalendarDays }, { label: "XP guadagnati", value: report.xp, icon: Sparkles }].map(({ label, value, icon: Icon }) => <div key={label}><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4 text-primary" />{label}</dt><dd className="mt-2 font-display text-2xl font-medium tabular-nums">{value}</dd></div>)}
    </dl>
    <div className="mt-6 grid grid-cols-7 gap-2 sm:grid-cols-14" aria-label="Attività giornaliera">{report.days.map((item) => <Button key={item.date} variant={item.date === selected ? "default" : "outline"} aria-pressed={item.date === selected} aria-label={`${new Date(`${item.date}T12:00:00`).toLocaleDateString("it-IT")}: ${item.answers} risposte`} title={`${item.answers} risposte · ${item.correct} corrette`} onClick={() => setSelected(item.date)} className={cn("h-16 min-w-0 flex-col gap-1 rounded-lg px-1", item.answers > 0 && item.date !== selected && "border-primary/40 bg-success-soft")}><span className="font-mono text-[10px]">{item.date.slice(8)}/{item.date.slice(5, 7)}</span><span className="text-sm font-semibold tabular-nums">{item.answers}</span></Button>)}</div>
    {day && <p className="mt-4 min-h-10 text-sm leading-relaxed text-muted-foreground" role="status">{new Date(`${day.date}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long" })} · {day.answers ? `${day.vocabulary} risposte di vocabolario, ${day.grammar} di grammatica · ${day.correct}/${day.answers} corrette · ${day.xp} XP` : "Nessuna risposta salvata"}</p>}
  </section>;
}