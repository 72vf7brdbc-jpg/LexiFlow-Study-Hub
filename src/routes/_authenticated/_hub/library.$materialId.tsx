
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Layers,
  Trash2,
  Volume2,
  X,
  Edit3,
  Save,
  ClipboardList,
  Plus,
  Loader2,
  FileText,
  ImageIcon,
} from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { prepareUpload } from "@/lib/file-prep";
import { materialQuery, type Card, type Task } from "@/lib/queries";
import { speakEnglish } from "@/lib/speak";
import { masteryOf } from "@/lib/srs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_hub/library/$materialId")({
  head: () => ({
    meta: [
      { title: "Lezione — LexiFlow Study Hub" },
      {
        name: "description",
        content: "Le schede di studio generate da questa lezione.",
      },
      { property: "og:title", content: "Lezione — LexiFlow" },
      {
        property: "og:description",
        content: "Vocabolario e schede di una lezione salvata.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(materialQuery(params.materialId)),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => (
    <InlineError
      message={error instanceof Error ? error.message : undefined}
      onRetry={reset}
    />
  ),
  component: MaterialPage,
});

const MASTERY = {
  new: { label: "Nuova", tone: "navy" },
  learning: { label: "In studio", tone: "burgundy" },
  review: { label: "In ripasso", tone: "camel" },
  mastered: { label: "Acquisita", tone: "green" },
} as const;

const KIND_LABEL: Record<string, string> = {
  vocabulary: "Vocabolo",
  grammar: "Grammatica",
  phrase: "Espressione",
};

const TASK_STATUS = {
  todo: {
    label: "Da fare",
    className: "text-muted-foreground bg-secondary",
  },
  in_progress: {
    label: "In corso",
    className: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950",
  },
  done: {
    label: "Completato",
    className: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-950",
  },
} as const;

function MaterialPage() {
  const { materialId } = Route.useParams();
  const { data } = useSuspenseQuery(materialQuery(materialId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"cards" | "files" | "text">("cards");

  const maybeM = data.material;
  const tasks: Task[] = data.tasks ?? [];

  // Modifica della data della lezione
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [newDate, setNewDate] = useState(
    maybeM ? maybeM.created_at.slice(0, 16) : "",
  );
  const [savingDate, setSavingDate] = useState(false);

  // Creazione dei compiti
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Aggiunta di allegati
  const [addingFiles, setAddingFiles] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  if (!maybeM) {
    return (
      <InlineError
        title="Lezione non trovata"
        message="Potrebbe essere stata eliminata."
        onRetry={() => navigate({ to: "/library" })}
      />
    );
  }

  const m = maybeM;
  const created = new Date(m.created_at);

  async function refreshMaterial() {
    await queryClient.invalidateQueries({
      queryKey: ["material", m.id],
    });
  }

  async function handleSaveDate() {
    if (!newDate) return;

    setSavingDate(true);

    const { error } = await supabase
      .from("materials")
      .update({
        created_at: new Date(newDate).toISOString(),
      })
      .eq("id", m.id);

    setSavingDate(false);

    if (error) {
      toast.error("Impossibile aggiornare la data");
      return;
    }

    setIsEditingDate(false);

    await refreshMaterial();
    await queryClient.invalidateQueries({
      queryKey: ["materials"],
    });

    toast.success("Data della lezione aggiornata");
  }

  async function handleCreateTask() {
    const description = newTaskTitle.trim();

    if (!description) {
      toast.error("Inserisci una descrizione per il compito");
      return;
    }

    setSavingTask(true);

    try {
      // Recupera l'utente attualmente autenticato
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        toast.error("Sessione non valida. Effettua nuovamente l'accesso.");
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        material_id: m.id,
        user_id: authData.user.id,
        description,
        status: "todo",
        due_date: newTaskDueDate || null,
      });

      if (error) {
        console.error("Errore creazione compito:", error);
        toast.error("Impossibile salvare il compito");
        return;
      }

      setNewTaskTitle("");
      setNewTaskDueDate("");
      setIsAddingTask(false);

      await refreshMaterial();

      toast.success("Compito aggiunto con successo");
    } finally {
      setSavingTask(false);
    }
  }

  async function handleToggleTaskStatus(
    taskId: string,
    currentStatus: string,
  ) {
    // Ciclo degli stati: Da fare → In corso → Completato → Da fare
    const nextStatus =
      currentStatus === "todo"
        ? "in_progress"
        : currentStatus === "in_progress"
          ? "done"
          : "todo";

    const { error } = await supabase
      .from("tasks")
      .update({
        status: nextStatus,
        completed_at:
          nextStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", taskId);

    if (error) {
      console.error("Errore aggiornamento compito:", error);
      toast.error("Impossibile aggiornare lo stato del compito");
      return;
    }

    await refreshMaterial();

    toast.success(
      nextStatus === "done"
        ? "Compito completato!"
        : nextStatus === "in_progress"
          ? "Compito spostato in corso"
          : "Compito riportato tra quelli da fare",
    );
  }

  async function handleDeleteTask(taskId: string) {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast.error("Impossibile eliminare il compito");
      return;
    }

    await refreshMaterial();
    toast.success("Compito eliminato");
  }

  async function handleAddMoreFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setAddingFiles(true);

    try {
      const extraTexts: string[] = [];

      for (const file of Array.from(fileList)) {
        const prepared = await prepareUpload(file);

        if (prepared.kind === "text") {
          extraTexts.push(
            `\n\n--- [Allegato: ${file.name}] ---\n${prepared.text}`,
          );
        }
      }

      if (extraTexts.length > 0) {
        const currentText = m.extracted_text || "";
        const updatedText = currentText + extraTexts.join("");

        const { error } = await supabase
          .from("materials")
          .update({
            extracted_text: updatedText,
          })
          .eq("id", m.id);

        if (error) throw error;

        await refreshMaterial();

        toast.success("Nuovi file aggiunti con successo alla lezione!");
      } else {
        toast.success("File ricevuti correttamente.");
      }
    } catch (error) {
      console.error("Errore aggiunta allegati:", error);
      toast.error("Errore durante l'aggiunta dei file");
    } finally {
      setAddingFiles(false);
    }
  }

  async function remove() {
    const { error } = await supabase
      .from("materials")
      .delete()
      .eq("id", m.id);

    if (error) {
      toast.error("Eliminazione non riuscita");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["materials"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["stats"],
      }),
    ]);

    toast.success("Lezione eliminata");

    navigate({
      to: "/library",
      replace: true,
    });
  }

  // Estrae i nomi degli allegati dal testo memorizzato
  const extractedFiles = (m.extracted_text || "")
    .split("---")
    .filter((chunk) => chunk.includes("Allegato:"))
    .map((chunk) => {
      const match = chunk.match(/Allegato:\s*([^\]]+)/);
      return match?.[1]?.trim() || "Documento allegato";
    });

  return (
    <div className="space-y-8">
      {/* Input nascosto per selezionare nuovi file */}
      <input
        ref={addFileRef}
        type="file"
        accept="application/pdf,image/*,.txt,.md,.markdown,.csv,text/plain"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleAddMoreFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Link
        to="/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Archivio
      </Link>

      <header className="animate-rise flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp tone="camel">
              <SourceIcon
                type={m.source_type}
                className="size-3"
              />
              {sourceLabel(m.source_type)}
            </Stamp>

            {/* Data modificabile */}
            {isEditingDate ? (
              <div className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 rounded-lg bg-background text-xs"
                />

                <Button
                  size="sm"
                  onClick={handleSaveDate}
                  disabled={savingDate}
                  className="h-8 px-3"
                >
                  <Save className="mr-1 size-3.5" />
                  Salva
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingDate(false)}
                  className="h-8 px-2"
                >
                  Annulla
                </Button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2">
                <span className="eyebrow">
                  {format(created, "d MMMM yyyy · HH:mm", {
                    locale: it,
                  })}
                </span>

                <button
                  onClick={() => setIsEditingDate(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  title="Modifica data lezione"
                >
                  <Edit3 className="size-3" />
                  Modifica data
                </button>
              </div>
            )}
          </div>

          <h1 className="mt-3 text-[2rem] font-medium leading-[1.08] sm:text-[2.5rem]">
            {m.title}
          </h1>

          {m.summary && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {m.summary}
            </p>
          )}

          {/* Gestione compiti */}
          <div className="mt-4 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="size-4 text-primary" />
                <p className="eyebrow font-semibold text-primary">
                  Compiti assegnati ({tasks.length})
                </p>
              </div>

              {!isAddingTask && (
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="size-3.5" />
                  Aggiungi compito
                </button>
              )}
            </div>

            {/* Form nuovo compito */}
            {isAddingTask && (
              <div className="mt-2 space-y-3">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Es. Esercizio a pagina 10, studiare grammatica..."
                  className="bg-background text-sm"
                />

                <div className="space-y-1">
                  <label
                    htmlFor="task-due-date"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Data di scadenza (facoltativa)
                  </label>

                  <Input
                    id="task-due-date"
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="bg-background text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateTask}
                    disabled={savingTask || !newTaskTitle.trim()}
                    className="h-8 px-3"
                  >
                    {savingTask ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 size-3.5" />
                    )}
                    Salva compito
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskTitle("");
                      setNewTaskDueDate("");
                    }}
                    className="h-8 px-2"
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {/* Elenco compiti */}
            {tasks.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {tasks.map((task) => {
                  const status =
                    TASK_STATUS[task.status as keyof typeof TASK_STATUS] ?? TASK_STATUS.todo;

                  const isCompleted = task.status === "done";

                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/80 p-2.5 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <button
                          onClick={() =>
                            handleToggleTaskStatus(task.id, task.status)
                          }
                          className={cn(
                            "mt-0.5 shrink-0 transition-colors",
                            isCompleted
                              ? "text-green-600"
                              : task.status === "in_progress"
                                ? "text-amber-600"
                                : "text-muted-foreground hover:text-primary",
                          )}
                          aria-label={`Cambia stato: ${status.label}`}
                          title="Clicca per cambiare stato"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="size-4" />
                          ) : task.status === "in_progress" ? (
                            <Clock3 className="size-4" />
                          ) : (
                            <Circle className="size-4" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p
                            className={cn(
                              "break-words font-medium",
                              isCompleted &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {task.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                status.className,
                              )}
                            >
                              {status.label}
                            </span>

                            {task.due_date && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock3 className="size-3" />
                                Scadenza:{" "}
                                {format(parseISO(task.due_date), "d MMM yyyy", {
                                  locale: it,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                        title="Elimina compito"
                        aria-label="Elimina compito"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !isAddingTask && (
                <p className="text-sm italic text-muted-foreground">
                  Nessun compito assegnato. Clicca su "Aggiungi compito" per
                  inserirlo.
                </p>
              )
            )}

            {tasks.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Clicca sull'icona accanto a un compito per passare allo stato
                successivo.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Aggiunta allegati */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => addFileRef.current?.click()}
            disabled={addingFiles}
          >
            {addingFiles ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}
            {addingFiles ? "Aggiungo..." : "Aggiungi allegati"}
          </Button>

          <Button asChild size="lg">
            <Link to="/review" search={{ material: m.id }}>
              <Layers />
              Ripassa {data.cards.length} schede
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-12"
                aria-label="Elimina lezione"
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl font-medium">
                  Eliminare la lezione?
                </AlertDialogTitle>

                <AlertDialogDescription>
                  Verranno eliminate anche le {data.cards.length} schede e i
                  loro progressi. L'operazione non si può annullare.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">
                  Annulla
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={remove}
                  className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Navigazione tra schede, file e testo */}
      <div className="flex gap-1 border-b border-border">
        {[
          {
            id: "cards" as const,
            label: `Schede (${data.cards.length})`,
          },
          {
            id: "files" as const,
            label: "File e Allegati",
          },
          {
            id: "text" as const,
            label: "Testo estratto",
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Schede */}
      {tab === "cards" && (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.cards.map((c, i) => (
            <CardItem key={c.id} card={c} index={i} />
          ))}
        </ul>
      )}

      {/* File e allegati */}
      {tab === "files" && (
        <div className="space-y-4">
          <div className="paper space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-medium">
                  File e documenti associati
                </h3>

                <p className="text-xs text-muted-foreground">
                  Ecco l'elenco dei file, delle foto e dei documenti associati
                  a questa sessione.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => addFileRef.current?.click()}
              >
                <Plus className="mr-1 size-4" />
                Aggiungi file
              </Button>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <FileText className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {m.title || "Lezione principale"}
                  </p>

                  <p className="text-[11px] text-muted-foreground">
                    Origine ({m.source_type})
                  </p>
                </div>
              </div>

              {extractedFiles.map((fileName, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <ImageIcon className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {fileName}
                    </p>

                    <p className="text-[11px] text-muted-foreground">
                      Allegato extra
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Testo estratto */}
      {tab === "text" && (
        <div className="paper lined whitespace-pre-wrap px-6 py-4 text-[15px] leading-8">
          {m.extracted_text || "Nessun testo estratto disponibile."}
        </div>
      )}
    </div>
  );
}

function CardItem({
  card: c,
  index,
}: {
  card: Card;
  index: number;
}) {
  const mastery = MASTERY[masteryOf(c)];
  const due = new Date(c.due_at);
  const isDue = due.getTime() <= Date.now();

  return (
    <li
      className="paper animate-rise flex flex-col p-5"
      style={{
        animationDelay: `${Math.min(index, 10) * 35}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-[10px]">
            {KIND_LABEL[c.kind] ?? c.kind}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <h3 className="font-display text-2xl font-medium italic">
              {c.term}
            </h3>

            <button
              onClick={() => speakEnglish(c.term)}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              aria-label={`Ascolta ${c.term}`}
            >
              <Volume2 className="size-4" />
            </button>
          </div>

          {c.phonetic && (
            <p className="font-mono text-xs text-muted-foreground">
              {c.phonetic}
            </p>
          )}
        </div>

        <Stamp tone={mastery.tone}>{mastery.label}</Stamp>
      </div>

      <p className="mt-3 font-semibold">{c.meaning}</p>

      {c.definition && (
        <p className="mt-1 text-sm text-muted-foreground">
          {c.definition}
        </p>
      )}

      {c.example && (
        <p className="mt-3 border-l-2 border-camel/60 pl-3 text-sm italic text-foreground/80">
          “{c.example}”
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="size-3.5" />
            {c.correct_count}
          </span>

          <span className="inline-flex items-center gap-1 text-burgundy">
            <X className="size-3.5" />
            {c.incorrect_count}
          </span>
        </span>

        <span>
          {isDue
            ? "Da ripassare ora"
            : `Prossimo ripasso tra ${formatDistanceToNowStrict(due, {
                locale: it,
              })}`}
        </span>
      </div>
    </li>
  );
}
