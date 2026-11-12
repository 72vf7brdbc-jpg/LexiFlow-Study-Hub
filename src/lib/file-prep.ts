// Browser-side preparation of uploads before AI analysis.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type PreparedUpload =
  | { kind: "binary"; base64: string; mimeType: string; fileName: string; previewUrl?: string }
  | { kind: "text"; text: string; fileName: string };

const TEXT_EXT = /\.(txt|md|markdown|csv|rtf|text)$/i;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Impossibile leggere il file"));
    r.readAsDataURL(blob);
  });
}

async function compressImage(file: File, maxSide = 1800, quality = 0.86): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Immagine non leggibile. Prova con JPG o PNG."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossibile elaborare l'immagine");
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg", previewUrl: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.size === 0) throw new Error("Il file è vuoto.");
  if (file.size > MAX_FILE_BYTES * 2) throw new Error("Il file supera i 10 MB.");

  if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) {
    const img = await compressImage(file);
    return { kind: "binary", ...img, fileName: file.name };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_FILE_BYTES) throw new Error("Il PDF supera i 10 MB. Prova a dividerlo.");
    const dataUrl = await readAsDataUrl(file);
    return { kind: "binary", base64: dataUrl.split(",")[1] ?? "", mimeType: "application/pdf", fileName: file.name };
  }
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) {
    const text = (await file.text()).trim();
    if (text.length < 3) throw new Error("Il file di testo è vuoto.");
    return { kind: "text", text: text.slice(0, 60000), fileName: file.name };
  }
  throw new Error("Formato non supportato. Usa una foto, un PDF o un file di testo (.txt, .md).");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
