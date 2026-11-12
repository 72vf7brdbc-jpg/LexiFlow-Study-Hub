import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeMaterialWithAI } from "./ai/material-analysis.server";

const MAX_BASE64 = 14_000_000; // ~10 MB file

const analyzeInput = z
  .object({
    sourceType: z.enum(["photo", "file", "text"]),
    title: z.string().trim().max(140).nullable().optional(),
    text: z.string().max(60_000).nullable().optional(),
    base64: z.string().max(MAX_BASE64).nullable().optional(),
    mimeType: z.string().max(120).nullable().optional(),
    fileName: z.string().max(200).nullable().optional(),
  })
  .refine((d) => (d.text && d.text.trim().length >= 3) || (d.base64 && d.base64.length > 0), {
    message: "Nessun contenuto da analizzare",
  })
  .refine((d) => !d.base64 || /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(d.mimeType ?? ""), {
    message: "Formato file non supportato",
  });

export type AnalyzeMaterialResult =
  | { ok: true; materialId: string; title: string; cardCount: number }
  | { ok: false; message: string };

export const analyzeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data, context }): Promise<AnalyzeMaterialResult> => {
    const { supabase, userId } = context;

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
    if (analysis.cards.length === 0) {
      return {
        ok: false,
        message: analysis.summary || "Non ho trovato vocaboli da studiare in questo materiale.",
      };
    }

    const title = (data.title && data.title.trim()) || analysis.title || "Lezione senza titolo";
    const { data: material, error: matErr } = await supabase
      .from("materials")
      .insert({
        user_id: userId,
        title,
        source_type: data.sourceType,
        file_name: data.fileName ?? null,
        summary: analysis.summary,
        topic: analysis.topic,
        extracted_text: (analysis.extracted_text || data.text || "").slice(0, 12000),
        card_count: analysis.cards.length,
      })
      .select("id")
      .single();
    if (matErr || !material) {
      console.error("material insert failed", matErr);
      return { ok: false, message: "Non è stato possibile salvare la lezione. Riprova." };
    }

    const { error: cardsErr } = await supabase.from("cards").insert(
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
    );
    if (cardsErr) {
      console.error("cards insert failed", cardsErr);
      await supabase.from("materials").delete().eq("id", material.id);
      return { ok: false, message: "Non è stato possibile salvare le schede. Riprova." };
    }

    return { ok: true, materialId: material.id, title, cardCount: analysis.cards.length };
  });
