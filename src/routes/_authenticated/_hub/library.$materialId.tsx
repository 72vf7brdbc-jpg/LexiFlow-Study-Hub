import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Check, Layers, Trash2, Volume2, X, Calendar, Edit3, Save, ClipboardList } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SourceIcon, sourceLabel } from "@/components/lexi/source-icon";
import { InlineError, LoadingScreen, Stamp } from "@/components/lexi/ui-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { materialQuery, type Card } from "@/lib/queries";
import { speakEnglish } from "@/lib/speak";
import { masteryOf } from "@/lib/srs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_hub/library/$materialId")({
  head: () => ({
    meta: [
      { title: "Lezione — LexiFlow Study Hub" },
      { name: "description", content: "Le schede di studio generate da questa lezione." },
      { property: "og:title", content: "Lezione — LexiFlow" },
      { property: "og:description", content: "Vocabolario e schede di una lezione salvata." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(materialQuery(params.materialId)),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : undefined} onRetry={reset} />,
  component: MaterialPage,
});

const MASTERY = {
  new: { label: "Nuova", tone: "navy" },
  learning: { label: "In studio", tone: "burgundy" },
  review: { label: "In ripasso", tone: "camel" },
  mastered: { label: "Acquisita", tone: "green" },
} as const;

const KIND_LABEL: Record<string, string> = { vocabulary: "Vocabolo", grammar: "Grammatica", phrase: "Espressione" };

function MaterialPage() {
  const { materialId } = Route.useParams();
  const { data } = useSuspenseQuery(materialQuery(materialId));
  const [tab, setTab] = useState<"cards" | "text">("cards");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const m = data.material;
  
  // Stato per la modifica della data
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [newDate, setNewDate] = useState(m ? m.created_at.slice(0, 16) : "");
  const [savingDate, setSavingDate] = useState(false);

  // Stato per la modifica dei compiti in un secondo momento
  const [isEditingHomework, setIsEditingHomework] = useState(false);
  const [homeworkText, setHomeworkText] = useState((m as any).homework ?? "");
  const [savingHomework, setSavingHomework] = useState(false);

  if (!m) {
    return (
      <InlineError
        title="Lezione non trovata"
        message="Potrebbe essere stata eliminata."
        onRetry={() => navigate({ to: "/library" })}
      />
    );
  }

  const created = new Date(m.created_at);

  async function handleSaveDate() {
    if (!newDate) return;
    setSavingDate(true);
    const { error } = await supabase
      .from("materials")
      .update({ created_at: new Date(newDate).toISOString() })
      .eq("id", m.id);
    
    setSavingDate(false);
    if (error) {
      toast.error("Impossibile aggiornare la data");
      return;
    }
    setIsEditingDate(false);
    await queryClient.invalidateQueries({ queryKey: ["material", m.id] });
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
    toast.success("Data della lezione aggiornata");
  }

  async function handleSaveHomework() {
    setSavingHomework(true);
    const { error } = await supabase
      .from("materials")
      .update({ homework: homeworkText.trim() || null })
      .eq("id", m.id);
    
    setSavingHomework(false);
    if (error) {
      toast.error("Impossibile aggiornare i compiti");
      return;
    }
    setIsEditingHomework(false);
    await queryClient.invalidateQueries({ queryKey: ["material", m.id] });
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
    toast.success("Compiti aggiornati");
  }

  async function remove() {
    const { error } = await supabase.from("materials").delete().eq("id", m.id);
    if (error) {
      toast.error("Eliminazione non riuscita");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["materials"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
    ]);
    toast.success("Lezione eliminata");
    navigate({ to: "/library", replace: true });
  }

  return (
    <div className="space-y-8">
      <Link to="/library" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Archivio
      </Link>

      <header className="animate-rise flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp tone="camel">
              <SourceIcon type={m.source_type} className="size-3" /> {sourceLabel(m.source_type)}
            </Stamp>
            
            {/* Sezione Data modificabile */}
            {isEditingDate ? (
              <div className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 text-xs rounded-lg bg-background"
                />
                <Button size="sm" onClick={handleSaveDate} disabled={savingDate} className="h-8 px-3">
                  <Save className="size-3.5 mr-1" /> Salva
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingDate(false)} className="h-8 px-2">
                  Annulla
                </Button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2">
                <span className="eyebrow">{format(created, "d MMMM yyyy · HH:mm", { locale: it })}</span>
                <button
                  onClick={() => setIsEditingDate(true)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  title="Modifica data lezione"
                >
                  <Edit3 className="size-3" /> Modifica data
                </button>
              </div>
            )}
          </div>

          <h1 className="mt-3 text-[2rem] font-medium leading-[1.08] sm:text-[2.5rem]">{m.title}</h1>
          {m.summary && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{m.summary}</p>}
          
          {/* Box per i compiti manuali (Aggiungibile o Modificabile in qualsiasi momento) */}
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="size-4 text-primary" />
                <p className="eyebrow text-primary font-semibold">Compiti assegnati</p>
              </div>
              {!isEditingHomework && (
                <button
                  onClick={() => {
                    setHomeworkText((m as any).homework ?? "");
                    setIsEditingHomework(true);
                  }}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Edit3 className="size-3" /> {(m as any).homework ? "Modifica compiti" : "Aggiungi compiti"}
                </button>
              )}
            </div>

            {isEditingHomework ? (
              <div className="space-y-2 mt-2">
                <Textarea
                  value={homeworkText}
                  onChange={(e) => setHomeworkText(e.target.value.slice(0, 1000))}
                  placeholder="Scrivi qui i compiti o gli esercizi assegnati per la prossima lezione..."
                  className="h-20 text-sm bg-background"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveHomework} disabled={savingHomework} className="h-8 px-3">
                    <Save className="size-3.5 mr-1" /> Salva compiti
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingHomework(false)} className="h-8 px-2">
                    Annulla
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap mt-1">
                {(m as any).homework || <span className="text-muted-foreground italic">Nessun compito assegnato inserito. Clicca su "Aggiungi compiti" per scriverli quando vuoi.</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button asChild size="lg">
            <Link to="/review" search={{ material: m.id }}>
              <Layers /> Ripassa {data.cards.length} schede
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="size-12" aria-label="Elimina lezione">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl font-medium">Eliminare la lezione?</AlertDialogTitle>
                <AlertDialogDescription>
                  Verranno eliminate anche le {data.cards.length} schede e i loro progressi. L'operazione non si può annullare.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={remove} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border">
        {[
          { id: "cards" as const, label: `Schede (${data.cards.length})` },
          { id: "text" as const, label: "Testo estratto" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cards" ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.cards.map((c, i) => (
            <CardItem key={c.id} card={c} index={i} />
          ))}
        </ul>
      ) : (
        <div className="paper lined whitespace-pre-wrap px-6 py-2 text-[15px] leading-8">
          {m.extracted_text || "Nessun testo estratto disponibile."}
        </div>
      )}
    </div>
  );
}

function CardItem({ card: c, index }: { card: Card; index: number }) {
  const mastery = MASTERY[masteryOf(c)];
  const due = new Date(c.due_at);
  const isDue = due.getTime() <= Date.now();
  return (
    <li className="paper animate-rise flex flex-col p-5" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-[10px]">{KIND_LABEL[c.kind] ?? c.kind}</p>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="font-display text-2xl font-medium italic">{c.term}</h3>
            <button
              onClick={() => speakEnglish(c.term)}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              aria-label={`Ascolta ${c.term}`}
            >
              <Volume2 className="size-4" />
            </button>
          </div>
          {c.phonetic && <p className="font-mono text-xs text-muted-foreground">{c.phonetic}</p>}
        </div>
        <Stamp tone={mastery.tone}>{mastery.label}</Stamp>
      </div>
      <p className="mt-3 font-semibold">{c.meaning}</p>
      {c.definition && <p className="mt-1 text-sm text-muted-foreground">{c.definition}</p>}
      {c.example && <p className="mt-3 border-l-2 border-camel/60 pl-3 text-sm italic text-foreground/80">“{c.example}”</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-primary"><Check className="size-3.5" /> {c.correct_count}</span>
          <span className="inline-flex items-center gap-1 text-burgundy"><X className="size-3.5" /> {c.incorrect_count}</span>
        </span>
        <span>{isDue ? "Da ripassare ora" : `Prossimo ripasso tra ${formatDistanceToNowStrict(due, { locale: it })}`}</span>
      </div>
    </li>
  );
}
