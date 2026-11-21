import { useEffect, useRef, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, Check, FileText, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { InlineError, LoadingScreen } from "@/components/lexi/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { bookQuery } from "@/lib/book-queries";
import { analyzeMaterial } from "@/lib/materials.functions";
import { formatBytes } from "@/lib/file-prep";

export const Route = createFileRoute("/_authenticated/_hub/books/$bookId")({
  head: () => ({ meta: [
    { title: "Libro e lezioni progressive — LexiFlow" },
    { name: "description", content: "Le parti del tuo libro PDF, con vocabolario e grammatica da studiare." },
    { property: "og:title", content: "Libro e lezioni progressive — LexiFlow" },
    { property: "og:description", content: "Riprendi il tuo libro e prepara le lezioni dalle pagine scelte." },
    { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bookQuery(params.bookId)),
  pendingComponent: () => <LoadingScreen />,
  errorComponent: ({ error, reset }) => <InlineError message={error instanceof Error ? error.message : "Libro non trovato."} onRetry={reset} />,
  component: BookPage,
});

function BookPage() {
  const { bookId } = Route.useParams();
  const { data: { book, lessons } } = useSuspenseQuery(bookQuery(bookId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeMaterial);
  const pdf = useRef<PDFDocumentProxy | null>(null);
  const running = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(20);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => () => { void pdf.current?.loadingTask.destroy(); }, []);

  async function originalUrl() {
    const { data, error: storageError } = await supabase.storage.from("lesson-files").createSignedUrl(book.file_path, 3600);
    if (storageError || !data) throw new Error("Impossibile aprire il PDF originale.");
    return data.signedUrl;
  }
  async function generate(id: string) {
    const lesson = lessons.find(part => part.id === id);
    if (!lesson || running.current) return;
    running.current = true;
    setBusy(id);
    setError(null);
    setMessage("Leggo le pagine…");
    try {
      const { openPdf, preparePdfPages } = await import("@/lib/pdf-browser");
      pdf.current ??= await openPdf(await originalUrl());
      const files = await preparePdfPages(pdf.current, { start: lesson.page_start, end: lesson.page_end }, page => setMessage(`Leggo pagina ${page}…`));
      const first = files[0];
      if (!first) throw new Error("Non ho trovato pagine leggibili.");
      setMessage("Creo vocabolario e grammatica…");
      const result = await analyze({ data: {
        sourceType: "file", bookLessonId: id, fileName: book.file_name,
        ...(first.kind === "text" ? { text: first.text } : { base64: first.base64, mimeType: first.mimeType }), additionalFiles: files.slice(1),
      } });
      if (!result.ok) { setError(result.message); return; }
      toast.success(`${result.cardCount} schede · ${result.grammarCount} regole di grammatica`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["book", bookId] }), ...["materials", "review-data", "grammar", "stats"].map(key => queryClient.invalidateQueries({ queryKey: [key] }))]);
    } catch (e) { setError(e instanceof Error ? e.message : "Connessione interrotta. La parte resta salvata, puoi riprovare."); }
    finally { running.current = false; setBusy(null); }
  }
  async function openOriginal() {
    try {
      const link = document.createElement("a");
      link.href = await originalUrl(); link.target = "_blank"; link.rel = "noopener noreferrer"; link.click();
    } catch (e) { setError(e instanceof Error ? e.message : "PDF non disponibile."); }
  }
  async function remove() {
    setDeleting(true);
    try {
      const { error: removeError } = await supabase.storage.from("lesson-files").remove([book.file_path]);
      if (removeError) throw new Error("Impossibile eliminare il file originale. Riprova.");
      const { error: bookError } = await supabase.from("books").delete().eq("id", book.id);
      if (bookError) throw new Error("Impossibile eliminare il libro dall’archivio.");
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      navigate({ to: "/library" });
    } catch (e) { setError(e instanceof Error ? e.message : "Eliminazione non riuscita."); }
    finally { setDeleting(false); }
  }
  const ready = lessons.filter(part => part.material_id).length;
  return <div className="space-y-7">
    <Link to="/library" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Archivio</Link>
    <header className="space-y-4 border-b border-border pb-6">
      <div className="flex items-center gap-2 text-primary"><BookOpen className="size-5" /><span className="eyebrow">Il tuo libro</span></div>
      <h1 className="break-words font-display text-4xl font-medium">{book.title}</h1>
      <p className="text-sm text-muted-foreground">{book.page_count} pagine · {formatBytes(book.file_size)} · {ready}/{lessons.length} lezioni pronte</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void openOriginal()}><FileText />Apri PDF originale</Button><Button variant="ghost" size="icon" aria-label="Aggiorna lezioni" disabled={Boolean(busy)} onClick={() => void queryClient.invalidateQueries({ queryKey: ["book", bookId] })}><RefreshCw /></Button>
        <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Elimina libro" disabled={Boolean(busy) || deleting}><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare il libro?</AlertDialogTitle><AlertDialogDescription>Il PDF originale e le parti ancora da generare verranno eliminati. Le lezioni già create resteranno nell’archivio, senza il PDF originale.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => void remove()}>Elimina libro</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </header>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-danger-soft p-4 text-sm text-destructive">{error}</p>}
    <ol className="grid gap-3 md:grid-cols-2">{lessons.slice(0, visible).map(lesson => {
      const working = busy === lesson.id;
      const processing = lesson.status === "processing" && Boolean(lesson.started_at) && Date.now() - new Date(lesson.started_at ?? "").getTime() < 30 * 60 * 1000;
      return <li key={lesson.id} className="flex flex-col gap-4 rounded-lg border border-border bg-paper p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl">Parte {lesson.part_number}</h2><p className="mt-1 text-sm text-muted-foreground">Pagine {lesson.page_start}–{lesson.page_end}</p></div>{lesson.material_id && <Check className="size-5 text-primary" />}</div>
        {lesson.material_id ? <div className="mt-auto flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/library/$materialId" params={{ materialId: lesson.material_id }}>Apri lezione</Link></Button><Button asChild><Link to="/review" search={{ material: lesson.material_id }}>Ripassa</Link></Button></div> : <Button className="mt-auto" variant="outline" disabled={Boolean(busy) || processing} onClick={() => void generate(lesson.id)}>{working || processing ? <Loader2 className="animate-spin" /> : <Sparkles />}{working ? message : processing ? "In elaborazione…" : "Genera lezione"}</Button>}
      </li>;
    })}</ol>
    {lessons.length > visible && <Button variant="outline" onClick={() => setVisible(value => value + 20)}>Altre parti ({lessons.length - visible})</Button>}
  </div>;
}