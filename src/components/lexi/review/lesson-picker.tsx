import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReviewData } from "@/lib/queries";

export function LessonPicker({ data, picked, onChange }: { data: ReviewData; picked: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const counts = new Map<string, number>();
  for (const card of data.cards) if (card.material_id) counts.set(card.material_id, (counts.get(card.material_id) ?? 0) + 1);
  const lessons = data.materials.filter((lesson) => lesson.title.toLocaleLowerCase("it").includes(search.toLocaleLowerCase("it")));
  return <section className="mt-7" aria-label="Scegli le lezioni">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-medium">Quali lezioni vuoi ripassare?</h2><Button size="sm" variant={picked.length ? "ghost" : "secondary"} aria-pressed={!picked.length} onClick={() => onChange([])}>Tutte le lezioni</Button></div>
    <div className="mt-3 relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Cerca una lezione" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca una lezione…" className="pl-9" /></div>
    <p className="mt-2 text-sm text-muted-foreground">{picked.length ? `${picked.length} ${picked.length === 1 ? "lezione selezionata" : "lezioni selezionate"}` : "Tutte le lezioni"}</p>
    <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-border border-y border-border">{lessons.map((lesson) => {
      const count = counts.get(lesson.id) ?? 0;
      const selected = picked.includes(lesson.id);
      return <Button key={lesson.id} variant="ghost" aria-pressed={selected} disabled={!count} onClick={() => onChange(selected ? picked.filter((id) => id !== lesson.id) : [...picked, lesson.id])} className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal rounded-none px-2 py-3 text-left">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-primary/40 text-primary">{selected && <Check className="size-4" />}</span>
        <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{lesson.title}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{new Date(`${lesson.lesson_date}T12:00:00`).toLocaleDateString("it-IT")} · {count ? `${count} parole` : "Nessuna parola salvata"}</span></span>
      </Button>;
    })}{lessons.length === 0 && <p className="py-5 text-sm text-muted-foreground">Nessuna lezione trovata.</p>}</div>
  </section>;
}