import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeMaterialWithAI } from "./ai/material-analysis.server";
import { bookLessonTitle } from "./book-rules";

const MAX_BASE64 = 14_000_000; // ~10 MB file

const analyzeInput = z
  .object({
    sourceType: z.enum(["photo", "file", "text"]),
    title: z.string().trim().max(140).nullable().optional(),
    text: z.string().max(60_000).nullable().optional(),
    base64: z.string().max(MAX_BASE64).nullable().optional(),
    mimeType: z.string().max(120).nullable().optional(),
    fileName: z.string().max(200).nullable().optional(),
    bookLessonId: z.string().uuid().optional(),
    additionalFiles: z.array(z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("text"), text: z.string().min(3).max(60000), fileName: z.string().max(200) }),
      z.object({ kind: z.literal("binary"), base64: z.string().min(1).max(MAX_BASE64), mimeType: z.string().regex(/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/), fileName: z.string().max(200) }),
    ])).max(50).optional(),
  })
  .refine((d) => (d.text && d.text.trim().length >= 3) || (d.base64 && d.base64.length > 0), {
    message: "Nessun contenuto da analizzare",
  })
  .refine((d) => !d.base64 || /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(d.mimeType ?? ""), {
    message: "Formato file non supportato",
  });

export type AnalyzeMaterialResult =
  | { ok: true; materialId: string; title: string; cardCount: number; grammarCount: number }
  | { ok: false; message: string };

export const analyzeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data, context }): Promise<AnalyzeMaterialResult> => {
    const { supabase, userId } = context;
    let bookPart: { id: string; title: string; filePath: string } | undefined;
    let completed = false;
    if (data.bookLessonId) {
      const { data: part } = await supabase.from("book_lessons").select("*, books(*)").eq("id", data.bookLessonId).eq("user_id", userId).single();
      if (!part?.books) return { ok: false, message: "Parte del libro non trovata." };
      if (part.material_id) {
        const { data: saved } = await supabase.from("materials").select("id,title,card_count").eq("id", part.material_id).single();
        if (saved) return { ok: true, materialId: saved.id, title: saved.title, cardCount: saved.card_count, grammarCount: 0 };
      }
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: claimed, error: claimError } = await supabase.from("book_lessons")
        .update({ status: "processing", started_at: new Date().toISOString(), error_message: null })
        .eq("id", part.id).is("material_id", null)
        .or(`status.eq.pending,and(status.eq.processing,started_at.lt.${cutoff})`)
        .select("id").maybeSingle();
      if (claimError || !claimed) return { ok: false, message: "Questa parte è già in elaborazione. Attendi prima di riprovare." };
      bookPart = { id: part.id, title: bookLessonTitle(part.books.title, part.part_number, { start: part.page_start, end: part.page_end }), filePath: part.books.file_path };
    }
    try {

    const { data: profile } = await supabase
      .from("profiles")
      .select("cefr_level, goal, native_language")
      .eq("id", userId)
      .maybeSingle();

    const result = await analyzeMaterialWithAI(data, {
      cefr_level: profile?.cefr_level ?? "B1",
      goal: profile?.goal ?? "conversation",
      native_language: profile?.native_language ?? "it",
    });
    if (!result.ok) return result;

    const { analysis } = result;
    if (analysis.cards.length === 0 && analysis.grammar_rules.length === 0) {
      return {
        ok: false,
        message: analysis.summary || "Non ho trovato vocaboli da studiare in questo materiale.",
      };
    }

    const title = bookPart?.title || (data.title && data.title.trim()) || analysis.title || "Lezione senza titolo";
    const { data: material, error: matErr } = await supabase
      .from("materials")
      .insert({
        user_id: userId,
        title,
        source_type: data.sourceType,
        file_name: data.fileName ?? null,
        file_path: bookPart?.filePath ?? null,
        file_mime: bookPart ? "application/pdf" : null,
        summary: analysis.summary,
        topic: analysis.topic,
        extracted_text: (analysis.extracted_text || data.text || "").slice(0, 12000),
        card_count: analysis.cards.length,
        grammar_extracted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (matErr || !material) {
      console.error("material insert failed", matErr);
      return { ok: false, message: "Non è stato possibile salvare la lezione. Riprova." };
    }

    const cardsResult = analysis.cards.length ? await supabase.from("cards").insert(
      analysis.cards.map((c) => ({
        user_id: userId,
        material_id: material.id,
        kind: c.kind,
        term: c.term,
        meaning: c.meaning,
        definition: c.definition,
        example: c.example,
        cloze: c.cloze && c.cloze.includes("___") ? c.cloze : null,
        phonetic: c.phonetic,
      })),
    ) : { error: null };
    const cardsErr = cardsResult.error;
    if (cardsErr) {
      console.error("cards insert failed", cardsErr);
      await supabase.from("materials").delete().eq("id", material.id);
      return { ok: false, message: "Non è stato possibile salvare le schede. Riprova." };
    }

    if (analysis.grammar_rules.length) {
      const { error } = await supabase.from("grammar_rules").insert(analysis.grammar_rules.map((content) => ({
        user_id: userId, material_id: material.id, title: content.title, level: profile?.cefr_level ?? "B1", source: "lesson", content,
      })));
      if (error) {
        await supabase.from("cards").delete().eq("material_id", material.id);
        await supabase.from("materials").delete().eq("id", material.id);
        return { ok: false, message: "Non è stato possibile salvare la grammatica della lezione. Riprova." };
      }
    }
    if (bookPart) {
      const { error: linkError } = await supabase.from("book_lessons").update({ material_id: material.id, status: "ready", error_message: null }).eq("id", bookPart.id);
      if (linkError) {
        await supabase.from("cards").delete().eq("material_id", material.id);
        await supabase.from("grammar_rules").delete().eq("material_id", material.id);
        await supabase.from("materials").delete().eq("id", material.id);
        return { ok: false, message: "Impossibile collegare la lezione al libro. Riprova." };
      }
      completed = true;
    }
    return { ok: true, materialId: material.id, title, cardCount: analysis.cards.length, grammarCount: analysis.grammar_rules.length };
    } finally {
      if (bookPart && !completed) await supabase.from("book_lessons").update({ status: "pending", started_at: null }).eq("id", bookPart.id).is("material_id", null);
    }
  });
