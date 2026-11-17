import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateWithCoach, italianVersions, type CoachResult, type TranslateResult } from "./ai/coach.server";

const text = (max: number) => z.string().trim().min(1).max(max);

const coachInput = z.discriminatedUnion("method", [
  z.object({ method: z.literal("sentence_creation"), cardId: z.string().uuid(), answer: text(400) }),
  z.object({ method: z.literal("synonyms_paraphrasing"), cardId: z.string().uuid(), task: z.enum(["synonym", "paraphrase"]), answer: text(400) }),
  z.object({
    method: z.literal("contextual_learning"),
    cardId: z.string().uuid(),
    meaning: text(300),
    register: z.enum(["formale", "informale", "neutro"]),
    sentence: text(400),
  }),
  z.object({
    method: z.literal("translation_practice"),
    cardId: z.string().uuid(),
    direction: z.enum(["it_en", "en_it"]),
    source: text(500),
    answer: text(500),
  }),
]);

export type { CoachVerdict } from "./ai/coach.server";

export const coachEvaluate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => coachInput.parse(data))
  .handler(async ({ data, context }): Promise<CoachResult> => {
    const { supabase, userId } = context;
    const [{ data: card }, { data: profile }] = await Promise.all([
      supabase.from("cards").select("term, meaning, definition, example").eq("id", data.cardId).maybeSingle(),
      supabase.from("profiles").select("cefr_level").eq("id", userId).maybeSingle(),
    ]);
    if (!card) return { ok: false, message: "Parola non trovata." };
    const { cardId: _id, ...task } = data;
    return evaluateWithCoach(task, card, profile?.cefr_level ?? null);
  });

export const prepareItalianSentences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cardIds: z.array(z.string().uuid()).min(1).max(12) }).parse(data))
  .handler(async ({ data, context }): Promise<TranslateResult> => {
    const { data: cards } = await context.supabase.from("cards").select("id, example").in("id", data.cardIds);
    const sentences = (cards ?? []).filter((c) => c.example).map((c) => ({ id: c.id, en: c.example as string }));
    if (sentences.length === 0) return { ok: true, items: [] };
    return italianVersions(sentences);
  });
