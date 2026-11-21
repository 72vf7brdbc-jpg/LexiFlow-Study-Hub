import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookRanges, MAX_PDF_BYTES } from "./book-rules";

export const registerBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    title: z.string().trim().min(1).max(140), filePath: z.string().max(500),
    fileName: z.string().min(1).max(200), fileSize: z.number().int().positive().max(MAX_PDF_BYTES),
    pageCount: z.number().int().positive(), mode: z.enum(["automatic", "pages"]),
    start: z.number().int().positive(), end: z.number().int().positive(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const ranges = bookRanges(data.pageCount, data.mode, data.start, data.end);
    if (!data.filePath.startsWith(`${context.userId}/`)) throw new Error("File non autorizzato.");
    const { data: files, error: fileError } = await context.supabase.storage.from("lesson-files").list(context.userId, { search: data.filePath.split("/")[1] ?? "" });
    const file = files?.find((entry) => `${context.userId}/${entry.name}` === data.filePath);
    if (fileError || !file) throw new Error("Completa il caricamento del PDF prima di continuare.");
    const { data: book, error } = await context.supabase.from("books").insert({
      user_id: context.userId, title: data.title, file_path: data.filePath, file_name: data.fileName,
      file_size: data.fileSize, page_count: data.pageCount, mode: data.mode,
    }).select("id").single();
    if (error || !book) throw new Error("Impossibile salvare il libro.");
    // Batch inserts keep large books below request-size limits.
    for (let offset = 0; offset < ranges.length; offset += 200) {
      const { error: partsError } = await context.supabase.from("book_lessons").insert(ranges.slice(offset, offset + 200).map((range, index) => ({
        user_id: context.userId, book_id: book.id, part_number: offset + index + 1, page_start: range.start, page_end: range.end,
      })));
      if (partsError) {
        await context.supabase.from("books").delete().eq("id", book.id);
        throw new Error("Impossibile salvare le parti del libro. Riprova.");
      }
    }
    const { data: first } = await context.supabase.from("book_lessons").select("id,page_start,page_end").eq("book_id", book.id).eq("part_number", 1).single();
    if (!first) throw new Error("Prima lezione non trovata.");
    return { bookId: book.id, firstLesson: first };
  });