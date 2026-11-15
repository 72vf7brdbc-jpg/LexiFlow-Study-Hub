import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, Check, Layers, Trash2, Volume2, X, Calendar, Edit3, Save, ClipboardList, Plus, Loader2, FileText, ImageIcon, CheckCircle2, Circle } from "lucide-react";
import { useRef, useState } from "react";
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
import { prepareUpload } from "@/lib/file-prep";
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
  const [tab, setTab] = useState<"cards" | "files" | "text">("cards");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const m = data.material;
  const tasks = (data as any).tasks || [];
  
  // Stato per la modifica della data
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [newDate, setNewDate] = useState(m ? m.created_at.slice(0, 16) : "");
  const [savingDate, setSavingDate] = useState(false);

  // Stato per l'aggiunta di nuovi compiti sulla tabella relazionale tasks
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Stato per l'aggiunta di nuovi file/foto in un secondo momento
  const [addingFiles, setAddingFiles] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

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

  async function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    setSavingTask(true);
    const { error } = await supabase.from("tasks").insert({
      material_id: m.id,
      title: newTaskTitle.trim(),
      status: "todo",
    });

    setSavingTask(false);
    if (error) {
      toast.error("Impossibile salvare il compito");
      return;
    }
    setNewTaskTitle("");
    setIsAddingTask(false);
    await queryClient.invalidateQueries({ queryKey: ["material", m.id] });
    toast.success("Compito aggiunto con successo");
  }

  async function handleToggleTaskStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "completed" ? "todo" : "completed";
    const { error } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", taskId);

    if (error) {
      toast.error("Impossibile aggiornare lo stato del compito");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["material", m.id] });
    toast.success(nextStatus === "completed" ? "Compito completato!" : "Compito riaperto");
  }

  async function handleDeleteTask(taskId: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Impossibile eliminare il compito");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["material", m.id] });
    toast.success("Compito eliminato");
  }

  // Funzione per gestire l'aggiunta di nuovi allegati/foto in un secondo momento
  async function handleAddMoreFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setAddingFiles(true);
    try {
      const extraTexts: string[] = [];
      for (const file of Array.from(fileList)) {
        const prepared = await prepareUpload(file);
        if (prepared.kind === "text") {
          extraTexts.push(`\n\n--- [Allegato: ${file.name}] ---\n${prepared.text}`);
        }
      }

      if (extraTexts.length > 0) {
        const currentText = m.extracted_text || "";
        const updatedText = currentText + extraTexts.join("");
        const { error } = await supabase
          .from("materials")
          .update({ extracted_text: updatedText })
          .eq("id", m.id);

        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["material", m.id] });
        toast.success("Nuovi file aggiunti con successo alla lezione!");
      } else {
        toast.success("File ricevuti correttamente.");
      }
    } catch (e) {
      toast.error("Errore durante l'aggiunta dei file");
    } finally {
      setAddingFiles(false);
    }
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

  // Estrae i nomi degli allegati direttamente dal testo memorizzato
  const extractedFiles = (m.extracted_text || "")
    .split("---")
    .filter(chunk => chunk.includes("Allegato:"))
    .map(chunk => {
      const match = chunk.match(/Allegato:\s*([^\]]+)/);
      return match ? match[1].trim() : "Documento allegato";
    });

  return (
    <div className="space-y-8">
      {/* Input nascosto per selezionare nuovi file/foto in un secondo momento */}
      <input
        ref={addFileRef}
        type="file"
        accept="application/pdf,image/*,.txt,.md,.markdown,.csv,text/plain"
        multiple
        className="sr-only"
        onChange={(e) => { handleAddMoreFiles(e.target.files); e.target.value = ""; }}
      />

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
          
          {/* Box per i compiti collegati alla tabella relazionale tasks */}
          <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="size-4 text-primary" />
                <p className="eyebrow text-primary font-semibold">Compiti assegnati ({tasks.length})</p>
              </div>
              {!isAddingTask && (
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Plus className="size-3.5" /> Aggiungi compito
                </button>
              )}
            </div>

            {isAddingTask && (
              <div className="space-y-2 mt-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Es. Esercizio a pagina 10, studiare grammatica..."
                  className="text-sm bg-background"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleCreateTask} disabled={savingTask} className="h-8 px-3">
                    <Save className="size-3.5 mr-1" /> Salva compito
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingTask(false)} className="h-8 px-2">
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {tasks.length > 0 ? (
              <ul className="space-y-2 mt-2">
                {tasks.map((task: any) => {
                  const isCompleted = task.status === "completed";
                  return (
                    <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-background/80 border border-border p-2.5 text-sm">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          onClick={() => handleToggleTaskStatus(task.id, task.status)}
                          className={cn("shrink-0 transition-colors", isCompleted ? "text-green-600" : "text-muted-foreground hover:text-primary")}
                          aria-label={isCompleted ? "Segna da fare" : "Segna come completato"}
                        >
                          {isCompleted ? <CheckCircle2 className="size-4 fill-green-100" /> : <Circle className="size-4" />}
                        </button>
                        <span className={cn("truncate font-medium", isCompleted && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        title="Elimina compito"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !isAddingTask && (
                <p className="text-sm text-muted-foreground italic">Nessun compito assegnato. Clicca su "Aggiungi compito" per inserirlo.</p>
              )
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Pulsante per aggiungere allegati in un secondo momento */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => addFileRef.current?.click()}
            disabled={addingFiles}
          >
            {addingFiles ? <Loader2 className="animate-spin" /> : <Plus />}
            {addingFiles ? "Aggiungo..." : "Aggiungi allegati"}
          </Button>

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

      {/* Tab di navigazione: Schede, File e Allegati, Testo estratto */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "cards" as const, label: `Schede (${data.cards.length})` },
          { id: "files" as const, label: "File e Allegati" },
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

      {tab === "cards" && (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.cards.map((c, i) => (
            <CardItem key={c.id} card={c} index={i} />
          ))}
        </ul>
      )}

      {tab === "files" && (
        <div className="space-y-4">
          <div className="paper p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-medium">File e documenti associati</h3>
                <p className="text-xs text-muted-foreground">Ecco l'elenco dei file, delle foto e dei documenti associati a questa sessione.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => addFileRef.current?.click()}>
                <Plus className="size-4 mr-1" /> Aggiungi file
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{m.title || "Lezione principale"}</p>
                  <p className="text-[11px] text-muted-foreground">Origine ({m.source_type})</p>
                </div>
              </div>

              {extractedFiles.map((fileName, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <ImageIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{fileName}</p>
                    <p className="text-[11px] text-muted-foreground">Allegato extra</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "text" && (
        <div className="paper lined whitespace-pre-wrap px-6 py-4 text-[15px] leading-8">
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
