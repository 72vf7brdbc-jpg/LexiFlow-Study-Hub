export const MAX_PDF_BYTES = 5 * 1024 * 1024 * 1024;
export const BOOK_PAGES_PER_LESSON = 15;
export type BookMode = "automatic" | "pages";
export type PageRange = { start: number; end: number };

export function bookRanges(total: number, mode: BookMode, start = 1, end = total): PageRange[] {
  if (!Number.isSafeInteger(total) || total < 1) throw new Error("Il PDF non contiene pagine leggibili.");
  const first = mode === "automatic" ? 1 : start;
  const last = mode === "automatic" ? total : end;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last > total || first > last) {
    throw new Error(`Scegli un intervallo valido tra pagina 1 e ${total}.`);
  }
  const ranges: PageRange[] = [];
  for (let page = first; page <= last; page += BOOK_PAGES_PER_LESSON) {
    ranges.push({ start: page, end: Math.min(last, page + BOOK_PAGES_PER_LESSON - 1) });
  }
  return ranges;
}

export function validatePdfSize(size: number) {
  if (size <= 0) throw new Error("Il PDF è vuoto.");
  if (size > MAX_PDF_BYTES) throw new Error("Il PDF supera il limite di archiviazione di 5 GB.");
}

export function bookLessonTitle(title: string, part: number, range: PageRange) {
  return `${title.slice(0, 95)} — Parte ${part} (pag. ${range.start}–${range.end})`;
}