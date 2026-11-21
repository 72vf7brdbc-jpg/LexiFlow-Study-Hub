import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { validatePdfSize, type PageRange } from "./book-rules";
import type { PreparedUpload } from "./file-prep";

export async function openPdf(source: File | string): Promise<PDFDocumentProxy> {
  if (source instanceof File) validatePdfSize(source.size);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const task = pdfjs.getDocument({ url });
  try {
    const pdf = await task.promise;
    const destroy = task.destroy.bind(task);
    task.destroy = async () => {
      await destroy();
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
    return pdf;
  } catch {
    void task.destroy();
    if (typeof source !== "string") URL.revokeObjectURL(url);
    throw new Error("Impossibile leggere il PDF. Verifica che non sia danneggiato o protetto da password.");
  }
}

export async function preparePdfPages(pdf: PDFDocumentProxy, range: PageRange, onPage?: (page: number) => void): Promise<PreparedUpload[]> {
  const files: PreparedUpload[] = [];
  for (let number = range.start; number <= range.end; number++) {
    onPage?.(number);
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
    const fileName = `Pagina ${number}`;
    // A page with only a page number still needs OCR of the visible scan.
    if (text.length >= 80) {
      for (let offset = 0; offset < text.length; offset += 59000) {
        files.push({ kind: "text", text: `[Pagina PDF ${number}]\n${text.slice(offset, offset + 59000)}`, fileName });
      }
    } else {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      files.push({ kind: "binary", base64: canvas.toDataURL("image/jpeg", 0.88).split(",")[1] ?? "", mimeType: "image/jpeg", fileName });
      canvas.width = 0;
      canvas.height = 0;
    }
    page.cleanup();
  }
  return files;
}

export async function uploadBookPdf(file: File, onProgress: (progress: number) => void, signal: AbortSignal): Promise<string> {
  validatePdfSize(file.size);
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sessione scaduta. Accedi di nuovo.");
  const session = data.session;
  let path = `${session.user.id}/${crypto.randomUUID()}.pdf`;
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/upload/resumable`,
      headers: { apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [1000, 3000, 5000],
      fingerprint: async () => `lexiflow-pdf/${session.user.id}/${file.name}/${file.size}/${file.lastModified}`,
      onShouldRetry: (failure) => {
        const status = failure.originalResponse?.getStatus();
        return !status || status === 429 || status >= 500;
      },
      onBeforeRequest: async request => {
        const { data: current } = await supabase.auth.getSession();
        if (!current.session) throw new Error("Sessione scaduta. Accedi di nuovo.");
        request.setHeader("authorization", `Bearer ${current.session.access_token}`);
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: "lesson-files", objectName: path, contentType: "application/pdf", cacheControl: "3600" },
      onProgress: (sent, total) => onProgress(Math.round(sent / total * 100)),
      onError: () => { signal.removeEventListener("abort", abort); reject(new Error("Caricamento interrotto. Controlla la rete e riprova.")); },
      onSuccess: () => { signal.removeEventListener("abort", abort); resolve(); },
    });
    const abort = () => { void upload.abort(); reject(new Error("Caricamento annullato.")); };
    signal.addEventListener("abort", abort, { once: true });
    void upload.findPreviousUploads().then(previous => {
      const match = previous.find(entry => entry.metadata['bucketName'] === "lesson-files" && entry.metadata['objectName']?.startsWith(`${session.user.id}/`));
      if (match) {
        path = match.metadata['objectName'] ?? path;
        upload.options.metadata = { ...upload.options.metadata, objectName: path };
        upload.resumeFromPreviousUpload(match);
      }
      if (signal.aborted) abort();
      else upload.start();
    }).catch(() => {
      if (signal.aborted) abort();
      else upload.start();
    });
  });
  return path;
}