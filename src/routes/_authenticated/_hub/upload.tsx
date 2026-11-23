import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Camera, Check, FileText, FileUp, ImageIcon, Loader2, PenLine, RotateCcw, Sparkles, X, BookOpen, ClipboardList, Plus } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { PageHeader, Stamp } from "@/components/lexi/ui-bits";
import { PdfUpload } from "@/components/lexi/pdf-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, prepareUpload, type PreparedUpload } from "@/lib/file-prep";
import { analyzeMaterial, saveManualLesson } from "@/lib/materials.functions";
import { profileQuery } from "@/lib/queries";
import { goalName } from "@/lib/study-config";
import { cn } from "@/lib/utils";

type Mode = "photo" | "file" | "text";
type UploadSearch = { mode?: Mode | undefined };

export const Route = createFileRoute("/_authenticated/_hub/upload")({
  validateSearch: (s: Record<string, unknown>): UploadSearch => ({
    mode: s["mode"] === "photo" || s["mode"] === "file" || s["mode"] === "text" ? s["mode"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Carica una lezione — LexiFlow" },
      { name: "description", content: "Carica foto, file multipli o testo: l'AI crea le tue schede di studio o archivia il registro." },
      { property: "og:title", content: "Carica una lezione — LexiFlow" },
      { property: "og:description", content: "Da dispense e appunti a schede di vocabolario, in un attimo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: UploadPage,
});

const MODES = [
  { id: "photo" as const, label: "Foto", hint: "Dispense, lavagna, quaderno", icon: Camera },
  { id: "file" as const, label: "File", hint: "PDF, immagini, .txt", icon: FileUp },
  { id: "text" as const, label: "Testo", hint: "Scrivi o incolla", icon: PenLine },
];

const PHASES = ["Leggo i materiali", "Estraggo il vocabolario chiave", "Calibro le schede sul tuo livello", "Salvo nel tuo archivio"];

type Done = { materialId: string; title: string; cardCount: number; grammarCount: number; saveOnly: boolean };

function UploadPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery);
  const analyze = useServerFn(analyzeMaterial);
  const manualSave = useServerFn(saveManualLesson);
  const [manual, setManual] = useState(true);

  const mode: Mode = search.mode ?? "photo";
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [homework, setHomework] = useState("");
  
  // Gestione di file e foto multiple
  const [preparedList, setPreparedList] = useState<PreparedUpload[]>([]);
  const [fileMetas, setFileMetas] = useState<{ name: string; size: number }[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saveOnly, setSaveOnly] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    setPhase(0);
    const t = setInterval(() => setPhase((p) => Math.min(PHASES.length - 1, p + 1)), 4500);
    return () => clearInterval(t);
  }, [busy]);

  function setMode(m: Mode) {
    setError(null);
    setPreparedList([]);
    setFileMetas([]);
    setPdfFile(null);
    navigate({ to: "/upload", search: { mode: m }, replace: true });
  }

  async function handleFiles(fileList: FileList | File[] | null | undefined) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setPreparing(true);
    try {
      const files = Array.from(fileList);
      const pdf = files.find(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
      if (pdf) {
        if (files.length !== 1 || preparedList.length > 0) throw new Error("Carica un libro PDF alla volta, separatamente dagli altri allegati.");
        setPdfFile(pdf);
        if (!title) setTitle(pdf.name.replace(/\.pdf$/i, "").slice(0, 140));
        if (mode !== "file") navigate({ to: "/upload", search: { mode: "file" }, replace: true });
        return;
      }
      const newPrepared: PreparedUpload[] = [];
      const newMetas: { name: string; size: number }[] = [];

      for (const file of Array.from(fileList)) {
        const p = await prepareUpload(file);
        newPrepared.push(p);
        newMetas.push({ name: file.name, size: file.size });
      }

      setPreparedList((prev) => [...prev, ...newPrepared]);
      setFileMetas((prev) => [...prev, ...newMetas]);

      if (!title && fileList[0]) {
        setTitle(fileList[0].name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel caricamento dei file");
    } finally {
      setPreparing(false);
    }
  }

  function removeFile(index: number) {
    setPreparedList((prev) => prev.filter((_, i) => i !== index));
    setFileMetas((prev) => prev.filter((_, i) => i !== index));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const canSubmit = mode === "text" ? (manual ? !!title.trim() && text.trim().length > 0 : text.trim().length >= 20) : preparedList.length > 0;

  async function submit() {
    if (!canSubmit || busy) return;
    setError(null);
    setBusy(true);
    try {
      const primary = preparedList[0];
      const payload = {
        ...(mode === "text"
          ? { sourceType: "text" as const, title: title || null, text }
          : primary?.kind === "text"
            ? { sourceType: mode, title: title || null, text: primary.text, fileName: primary.fileName }
            : {
                sourceType: mode,
                title: title || null,
                base64: primary && primary.kind === "binary" ? primary.base64 : null,
                mimeType: primary && primary.kind === "binary" ? primary.mimeType : null,
                fileName: primary ? primary.fileName : "file",
              }),
        saveOnly,
        homework: homework.trim() || null,
        additionalFiles: preparedList.slice(1),
      };

      const res = mode === "text" && manual ? await manualSave({ data: { title, text } }) : await analyze({ data: payload });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone({ materialId: res.materialId, title: res.title, cardCount: res.cardCount, grammarCount: res.grammarCount, saveOnly: mode === "text" && manual ? false : saveOnly });
      queryClient.invalidateQueries({ queryKey: ["grammar"] });
      queryClient.invalidateQueries({ queryKey: ["review-data"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(saveOnly ? "Lezione archiviata nel registro" : `${res.cardCount} schede create`);
    } catch (e) {
      console.error(e);
      setError("Connessione interrotta durante l'analisi. Controlla la rete e riprova.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setPreparedList([]);
    setFileMetas([]);
    setText("");
    setTitle("");
    setHomework("");
    setError(null);
    setSaveOnly(false);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper animate-rise p-8 text-center shadow-lift">
          <div className="animate-pop mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
            <Check className="size-7" />
          </div>
          <p className="eyebrow mt-6">Lezione archiviata</p>
          <h1 className="mt-2 text-[2rem] font-medium leading-tight">{done.title}</h1>
          <p className="mt-2 text-muted-foreground">
            {done.saveOnly ? (
              <span>Salvato nel registro delle lezioni senza creare nuove schede.</span>
            ) : (
              <>
                <span className="font-display text-2xl italic text-primary">{done.cardCount}</span> schede pronte per il livello{" "}
                {profile.cefr_level}.
              </>
            )}
          </p>
          {done.grammarCount > 0 && <p className="mt-3 font-semibold text-grammar">{done.grammarCount} {done.grammarCount === 1 ? "argomento di grammatica pronto" : "argomenti di grammatica pronti"}</p>}
          <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
            {!done.saveOnly && (
              <Button asChild size="lg">
                <Link to="/review" search={{ material: done.materialId }}>
                  Ripassa subito <ArrowRight />
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant={done.saveOnly ? "default" : "outline"}>
              <Link to="/library/$materialId" params={{ materialId: done.materialId }}>
                {done.saveOnly ? "Apri nel registro" : "Vedi le schede"}
              </Link>
            </Button>
          </div>
          <button onClick={reset} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <RotateCcw className="size-3.5" /> Carica un'altra lezione
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Nuova lezione"
        title={
          <>
            Carica foto o file multipli, e fai fare <span className="italic text-primary">all'AI</span>.
          </>
        }
        description="Seleziona una o più foto, PDF o documenti insieme. Estrarremo il vocabolario e creeremo le tue schede."
      />

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-secondary/60 p-1.5" role="tablist">
        {MODES.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            disabled={busy}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-2 py-3 transition-all duration-200 sm:flex-row sm:justify-center sm:gap-3 sm:py-3.5",
              mode === id ? "bg-paper text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-5", mode === id && "text-primary")} />
            <span className="text-center sm:text-left">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div key={mode} className="animate-rise space-y-5">
        {mode === "photo" && (
          <div className="paper p-5 sm:p-6 space-y-4">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

            {preparedList.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {preparedList.map((p, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-xl border border-border bg-background aspect-square flex items-center justify-center">
                    {p.kind === "binary" && p.previewUrl ? (
                      <img src={p.previewUrl} alt={`Foto ${idx + 1}`} className="size-full object-cover" />
                    ) : (
                      <FileText className="size-8 text-primary" />
                    )}
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-paper/95 shadow-soft transition-transform hover:scale-105"
                      aria-label="Rimuovi foto"
                      disabled={busy}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  disabled={preparing || busy}
                  className="rounded-xl border border-dashed border-input bg-background flex flex-col items-center justify-center aspect-square text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="size-6 mb-1" />
                  <span className="text-xs font-medium">Aggiungi altre</span>
                </button>
              </div>
            )}

            {preparedList.length === 0 && (
              <div className="lined flex flex-col items-center rounded-xl border border-dashed border-input px-4 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
                  {preparing ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
                </div>
                <p className="mt-4 font-display text-xl font-medium">Fotografa o seleziona più foto</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Puoi selezionare più immagini contemporaneamente dalla galleria.</p>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <Button size="lg" onClick={() => cameraRef.current?.click()} disabled={preparing}>
                    <Camera /> Scatta foto
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => galleryRef.current?.click()} disabled={preparing}>
                    <ImageIcon /> Dalla galleria (multiplo)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "file" && (
          <div className="paper p-5 sm:p-6 space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.txt,.md,.markdown,.csv,text/plain"
              multiple
              className="sr-only"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />

            {pdfFile && <PdfUpload key={`${pdfFile.name}-${pdfFile.lastModified}`} file={pdfFile} title={title} onRemove={() => setPdfFile(null)} />}

            {!pdfFile && fileMetas.length > 0 && (
              <div className="space-y-2">
                {fileMetas.map((meta, idx) => (
                  <div key={idx} className="flex items-center gap-4 rounded-xl border border-border bg-background p-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">{meta.name}</p>
                      <p className="eyebrow text-[10px]">{formatBytes(meta.size)} · pronto</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(idx)} aria-label="Rimuovi file" disabled={busy}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={preparing || busy} className="w-full">
                  <Plus className="size-4 mr-2" /> Aggiungi altri file o PDF
                </Button>
              </div>
            )}

            {!pdfFile && fileMetas.length === 0 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex w-full flex-col items-center rounded-xl border border-dashed px-4 py-14 text-center transition-all duration-200",
                  dragging ? "border-primary bg-success-soft" : "border-input bg-background hover:border-primary/50",
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
                  {preparing ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
                </div>
                <p className="mt-4 font-display text-xl font-medium">Trascina qui i tuoi file</p>
                <p className="mt-1 text-sm text-muted-foreground">oppure seleziona più PDF, immagini o documenti insieme</p>
              </button>
            )}
          </div>
        )}

        {mode === "text" && <div className="flex flex-wrap gap-2" role="tablist" aria-label="Inserimento testo"><Button role="tab" aria-selected={manual} variant={manual ? "default" : "outline"} onClick={() => { setManual(true); setError(null); }}><PenLine /> Vocaboli manuali</Button><Button role="tab" aria-selected={!manual} variant={!manual ? "default" : "outline"} onClick={() => { setManual(false); setError(null); }}><Sparkles /> Analizza con Gemini</Button></div>}
        {mode === "text" && (
          <div className="paper overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="eyebrow">Appunti</span>
              <span className="eyebrow text-[10px]">{text.length.toLocaleString("it")} / 60.000</span>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60000))}
              aria-label={manual ? "Vocaboli della lezione" : "Testo della lezione"}
              placeholder={manual ? "Parola | significato | frase in inglese (facoltativa)\n\nUna parola per riga" : "Incolla o scrivi qui il testo della lezione, le parole viste in classe o i tuoi appunti…\n\nEs. Phrasal verbs: give up, look forward to, put off…"}
              className="lined min-h-[280px] resize-y rounded-none border-0 bg-transparent px-5 py-2 text-[15px] leading-8 shadow-none focus-visible:ring-0"
              disabled={busy}
            />
          </div>
        )}

        {!pdfFile && <>
        <div className="grid gap-1.5">
          <label htmlFor="title" className="eyebrow">{mode === "text" && manual ? "Titolo della lezione" : "Titolo (facoltativo)"}</label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 140))}
            placeholder="Es. Unit 4 — Travel & Holidays"
            className="h-11 rounded-xl bg-paper"
            disabled={busy}
          />
        </div>

        {!(mode === "text" && manual) && <>
        {/* Sezione per i Compiti Assegnati Manuali */}
        <div className="paper space-y-3 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            <label htmlFor="homework" className="eyebrow">Compiti assegnati (facoltativo)</label>
          </div>
          <Textarea
            id="homework"
            value={homework}
            onChange={(e) => setHomework(e.target.value.slice(0, 1000))}
            placeholder="Es. Esercizio a pagina 3 del file allegato, studiare i phrasal verbs..."
            className="h-24 resize-y rounded-xl bg-background p-3 text-sm"
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">Scrivi qui eventuali consegne o esercizi assegnati dalla professoressa per la prossima lezione.</p>
        </div>

        {/* Opzione "Solo registro" */}
        <div className="paper flex items-center justify-between p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base">Registra senza creare schede</p>
              <p className="text-xs text-muted-foreground">Salva il materiale e gli appunti nell'archivio senza generare nuove flashcard di ripasso.</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={saveOnly}
            onClick={() => setSaveOnly(!saveOnly)}
            disabled={busy}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              saveOnly ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-5 transform rounded-full bg-paper shadow-lg ring-0 transition duration-200 ease-in-out",
                saveOnly ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        </>}
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-burgundy/25 bg-danger-soft px-4 py-3 text-sm text-burgundy">
            <X className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="paper flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          {busy ? (
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p key={phase} className="animate-rise font-semibold">{PHASES[phase]}…</p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-[4000ms] ease-out" style={{ width: `${((phase + 1) / PHASES.length) * 92}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Calibrato su</span>
              <Stamp tone="green">{profile.cefr_level}</Stamp>
              <Stamp tone="navy">{goalName(profile.goal)}</Stamp>
            </div>
          )}
          <Button size="lg" onClick={submit} disabled={!canSubmit || busy || preparing} className="sm:min-w-[210px]">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Analisi in corso" : mode === "text" && manual ? "Salva lezione e vocaboli" : saveOnly ? "Salva nel registro" : "Crea le schede"}
          </Button>
        </div>
        {mode === "text" && !manual && !canSubmit && text.length > 0 && (
          <p className="-mt-2 text-xs text-muted-foreground">Scrivi almeno qualche frase (20 caratteri) per un'analisi utile.</p>
        )}
        </>}
      </div>
    </div>
  );
}
