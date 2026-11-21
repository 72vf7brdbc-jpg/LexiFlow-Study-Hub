import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { BookOpen, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookRanges, type BookMode, type PageRange } from "@/lib/book-rules";
import { registerBook } from "@/lib/books.functions";
import { analyzeMaterial } from "@/lib/materials.functions";
import { formatBytes } from "@/lib/file-prep";

export function PdfUpload({ file, title, onRemove }: { file: File; title: string; onRemove: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const register = useServerFn(registerBook);
  const analyze = useServerFn(analyzeMaterial);
  const pdf = useRef<PDFDocumentProxy | null>(null);
  const controller = useRef<AbortController | null>(null);
  const storedPath = useRef<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<BookMode>("automatic");
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("1");
  const [name, setName] = useState(title || file.name.replace(/\.pdf$/i, "").slice(0, 140));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let alive = true;
    void import("@/lib/pdf-browser").then(m => m.openPdf(file)).then(document => {
      if (!alive) { void document.loadingTask.destroy(); return; }
      pdf.current = document;
      setPageCount(document.numPages);
      setEnd(String(document.numPages));
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : "PDF non leggibile."); });
    return () => { alive = false; controller.current?.abort(); void pdf.current?.loadingTask.destroy(); };
  }, [file]);

  let ranges: PageRange[] | null = null;
  try { if (pageCount) ranges = bookRanges(pageCount, mode, Number(start), Number(end)); } catch { /* Invalid input is shown below. */ }

  async function submit() {
    if (busy || !ranges || !name.trim()) return;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const { uploadBookPdf, preparePdfPages } = await import("@/lib/pdf-browser");
      storedPath.current ??= await uploadBookPdf(file, setProgress, abort.signal);
      if (abort.signal.aborted) return;
      const result = await register({ data: { title: name.trim(), filePath: storedPath.current, fileName: file.name.slice(0, 200), fileSize: file.size, pageCount, mode, start: Number(start), end: Number(end) } });
      setAnalyzing(true);
      try {
        const document = pdf.current;
        if (!document) throw new Error("Libro salvato. Aprilo nell’archivio per generare la prima lezione.");
        const files = await preparePdfPages(document, { start: result.firstLesson.page_start, end: result.firstLesson.page_end });
        const first = files[0];
        if (!first) throw new Error("Nessuna pagina leggibile.");
        const analysis = await analyze({ data: { sourceType: "file", bookLessonId: result.firstLesson.id, fileName: file.name.slice(0, 200), ...(first.kind === "text" ? { text: first.text } : { base64: first.base64, mimeType: first.mimeType }), additionalFiles: files.slice(1) } });
        if (!analysis.ok) toast.error(analysis.message);
        else toast.success("Prima lezione pronta");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Libro salvato, ma la prima lezione non è ancora pronta."); }
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      await Promise.all(["materials", "review-data", "grammar", "stats"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      navigate({ to: "/books/$bookId", params: { bookId: result.bookId } });
    } catch (e) { setError(e instanceof Error ? e.message : "Impossibile caricare il PDF."); }
    finally { setBusy(false); setAnalyzing(false); }
  }

  return <section className="space-y-5">
    <div className="flex items-center gap-3 border-b border-border pb-4">
      <BookOpen className="size-7 shrink-0 text-primary" />
      <div className="min-w-0 flex-1"><h2 className="break-words font-display text-xl">{file.name}</h2><p className="text-sm text-muted-foreground">{formatBytes(file.size)} · {pageCount ? `${pageCount} pagine` : "Lettura del PDF…"}</p></div>
      <Button variant="ghost" size="icon" aria-label="Rimuovi PDF" onClick={onRemove} disabled={busy}><X /></Button>
    </div>
    <div className="space-y-2"><label htmlFor="book-title" className="eyebrow">Titolo del libro</label><Input id="book-title" value={name} onChange={e => setName(e.target.value.slice(0, 140))} disabled={busy} /></div>
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Come vuoi studiare il PDF?">
      {([{ value: "automatic", icon: BookOpen, label: "Divisione automatica" }, { value: "pages", icon: FileText, label: "Scegli le pagine" }] as const).map(option => <Button key={option.value} role="radio" aria-checked={mode === option.value} variant={mode === option.value ? "default" : "outline"} className="h-auto min-h-16 justify-start whitespace-normal px-4 py-4 text-left" disabled={busy} onClick={() => setMode(option.value)}><option.icon className="shrink-0" /><span className="flex-1">{option.label}</span>{mode === option.value && <Check className="shrink-0" />}</Button>)}
    </div>
    {mode === "pages" && <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2"><label htmlFor="book-start" className="text-sm font-semibold">Da pagina</label><Input id="book-start" type="number" min={1} max={pageCount} value={start} onChange={e => setStart(e.target.value)} disabled={busy} /></div>
      <div className="space-y-2"><label htmlFor="book-end" className="text-sm font-semibold">A pagina</label><Input id="book-end" type="number" min={1} max={pageCount} value={end} onChange={e => setEnd(e.target.value)} disabled={busy} /></div>
    </div>}
    {ranges && <p className="text-sm text-muted-foreground">{ranges.length} {ranges.length === 1 ? "lezione" : "lezioni"} · pagine {ranges[0]?.start}–{ranges.at(-1)?.end}</p>}
    {pageCount > 0 && !ranges && <p role="alert" className="text-sm text-destructive">Scegli un intervallo valido tra 1 e {pageCount}.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy && <div className="space-y-2"><progress className="h-2 w-full accent-primary" max={100} value={progress} aria-label="Caricamento PDF" /><p className="text-sm text-muted-foreground">{analyzing ? "L’AI sta preparando la prima lezione…" : progress < 100 ? `Caricamento ${progress}%` : "Salvataggio delle lezioni…"}</p></div>}
    <div className="flex flex-wrap gap-2"><Button size="lg" disabled={busy || !ranges || !name.trim()} onClick={() => void submit()}>{busy || !pageCount ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Caricamento in corso" : "Crea le lezioni"}</Button>{busy && progress < 100 && <Button variant="outline" onClick={() => controller.current?.abort()}>Annulla</Button>}</div>
    <p className="text-xs text-muted-foreground">Limite file: 5 GB. Pagine numerate secondo il PDF.</p>
  </section>;
}