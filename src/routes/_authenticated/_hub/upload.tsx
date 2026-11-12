import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Camera, Check, FileText, FileUp, ImageIcon, Loader2, PenLine, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { PageHeader, Stamp } from "@/components/lexi/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, prepareUpload, type PreparedUpload } from "@/lib/file-prep";
import { analyzeMaterial } from "@/lib/materials.functions";
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
      { name: "description", content: "Carica foto, file o testo: l'AI crea le tue schede di studio." },
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

const PHASES = ["Leggo il materiale", "Estraggo il vocabolario chiave", "Calibro le schede sul tuo livello", "Salvo nel tuo archivio"];

type Done = { materialId: string; title: string; cardCount: number };

function UploadPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery);
  const analyze = useServerFn(analyzeMaterial);

  const mode: Mode = search.mode ?? "photo";
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [dragging, setDragging] = useState(false);

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
    setPrepared(null);
    setFileMeta(null);
    navigate({ to: "/upload", search: { mode: m }, replace: true });
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const p = await prepareUpload(file);
      setPrepared(p);
      setFileMeta({ name: file.name, size: file.size });
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80));
    } catch (e) {
      setPrepared(null);
      setFileMeta(null);
      setError(e instanceof Error ? e.message : "File non valido");
    } finally {
      setPreparing(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  const canSubmit = mode === "text" ? text.trim().length >= 20 : !!prepared;

  async function submit() {
    if (!canSubmit || busy) return;
    setError(null);
    setBusy(true);
    try {
      const payload =
        mode === "text"
          ? { sourceType: "text" as const, title: title || null, text }
          : prepared?.kind === "text"
            ? { sourceType: mode, title: title || null, text: prepared.text, fileName: prepared.fileName }
            : {
                sourceType: mode,
                title: title || null,
                base64: prepared!.kind === "binary" ? prepared!.base64 : null,
                mimeType: prepared!.kind === "binary" ? prepared!.mimeType : null,
                fileName: prepared!.fileName,
              };
      const res = await analyze({ data: payload });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone({ materialId: res.materialId, title: res.title, cardCount: res.cardCount });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success(`${res.cardCount} schede create`);
    } catch (e) {
      console.error(e);
      setError("Connessione interrotta durante l'analisi. Controlla la rete e riprova.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setPrepared(null);
    setFileMeta(null);
    setText("");
    setTitle("");
    setError(null);
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
            <span className="font-display text-2xl italic text-primary">{done.cardCount}</span> schede pronte per il livello{" "}
            {profile.cefr_level}.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/review" search={{ material: done.materialId }}>
                Ripassa subito <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/library/$materialId" params={{ materialId: done.materialId }}>
                Vedi le schede
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
            Carica, e lascia fare <span className="italic text-primary">all'AI</span>.
          </>
        }
        description="Scegli come caricare il materiale ricevuto a lezione. Estrarremo il vocabolario chiave e creeremo le schede."
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
          <div className="paper p-5 sm:p-6">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
            {prepared?.kind === "binary" && prepared.previewUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-border bg-background">
                <img src={prepared.previewUrl} alt="Anteprima della foto caricata" className="max-h-[420px] w-full object-contain" />
                <button
                  onClick={() => { setPrepared(null); setFileMeta(null); }}
                  className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-paper/95 shadow-soft transition-transform hover:scale-105"
                  aria-label="Rimuovi foto"
                  disabled={busy}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="lined flex flex-col items-center rounded-xl border border-dashed border-input px-4 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
                  {preparing ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
                </div>
                <p className="mt-4 font-display text-xl font-medium">Fotografa la dispensa o la lavagna</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Inquadra bene il testo, con buona luce. Anche la scrittura a mano va bene.</p>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <Button size="lg" onClick={() => cameraRef.current?.click()} disabled={preparing}>
                    <Camera /> Scatta una foto
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => galleryRef.current?.click()} disabled={preparing}>
                    <ImageIcon /> Dalla galleria
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "file" && (
          <div className="paper p-5 sm:p-6">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.txt,.md,.markdown,.csv,text/plain"
              className="sr-only"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />
            {fileMeta && prepared ? (
              <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  {prepared.kind === "binary" && prepared.previewUrl ? (
                    <img src={prepared.previewUrl} alt="" className="size-12 rounded-lg object-cover" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{fileMeta.name}</p>
                  <p className="eyebrow text-[10px]">{formatBytes(fileMeta.size)} · pronto</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setPrepared(null); setFileMeta(null); }} aria-label="Rimuovi file" disabled={busy}>
                  <X />
                </Button>
              </div>
            ) : (
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
                <p className="mt-4 font-display text-xl font-medium">Trascina qui il file</p>
                <p className="mt-1 text-sm text-muted-foreground">oppure tocca per sceglierlo · PDF, JPG, PNG, TXT fino a 10 MB</p>
              </button>
            )}
          </div>
        )}

        {mode === "text" && (
          <div className="paper overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="eyebrow">Appunti</span>
              <span className="eyebrow text-[10px]">{text.length.toLocaleString("it")} / 60.000</span>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60000))}
              placeholder={"Incolla o scrivi qui il testo della lezione, le parole viste in classe o i tuoi appunti…\n\nEs. Phrasal verbs: give up, look forward to, put off…"}
              className="lined min-h-[280px] resize-y rounded-none border-0 bg-transparent px-5 py-2 text-[15px] leading-8 shadow-none focus-visible:ring-0"
              disabled={busy}
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <label htmlFor="title" className="eyebrow">Titolo (facoltativo)</label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 140))}
            placeholder="Es. Unit 4 — Travel & Holidays"
            className="h-11 rounded-xl bg-paper"
            disabled={busy}
          />
        </div>

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
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Analisi in corso" : "Crea le schede"}
          </Button>
        </div>
        {mode === "text" && !canSubmit && text.length > 0 && (
          <p className="-mt-2 text-xs text-muted-foreground">Scrivi almeno qualche frase (20 caratteri) per un'analisi utile.</p>
        )}
      </div>
    </div>
  );
}
