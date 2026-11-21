import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { grammarContentSchema, grammarQuestionSchema, withGrammarTeaching, type GrammarRule } from "./grammar";
import { clarifyGrammar, evaluateGrammar, explainGrammar, generateGrammar } from "./ai/grammar.server";

export const getGrammar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [rules, attempts, lessons, notes] = await Promise.all([
    context.supabase.from("grammar_rules").select("*").order("created_at", { ascending: false }),
    context.supabase.from("grammar_attempts").select("rule_id, correct").order("created_at", { ascending: false }).limit(3000),
    context.supabase.from("materials").select("id, title, grammar_extracted_at").order("created_at", { ascending: false }).limit(500),
    context.supabase.from("grammar_notes").select("id, rule_id, question, answer, created_at").order("created_at", { ascending: false }),
  ]);
  if (rules.error || attempts.error || lessons.error || notes.error) throw new Error("Non è stato possibile caricare la grammatica.");
  const parsed: GrammarRule[] = [];
  for (const row of rules.data ?? []) {
    const content = grammarContentSchema.safeParse(row.content);
    if (content.success && (row.source === "lesson" || row.source === "request" || row.source === "manual")) parsed.push({ ...row, source: row.source, content: content.data });
  }
  return { rules: parsed, attempts: attempts.data ?? [], lessons: lessons.data ?? [], notes: notes.data ?? [] };
});
export const addGrammar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ source: z.enum(["lesson", "request", "manual"]), text: z.string().trim().max(12000).optional(), materialId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    let text = data.text ?? "";
    if (data.source === "lesson") {
      if (!data.materialId) return { ok: false as const, message: "Scegli una lezione." };
      const { data: lesson, error } = await context.supabase.from("materials").select("extracted_text, grammar_extracted_at").eq("id", data.materialId).single();
      if (error || !lesson) return { ok: false as const, message: "Lezione non trovata." };
      if (lesson.grammar_extracted_at) return { ok: false as const, message: "La grammatica di questa lezione è già stata analizzata." };
      text = lesson.extracted_text ?? "";
      if (text.trim().length < 10) return { ok: false as const, message: "Questa lezione non contiene testo leggibile: carica nuovamente il file o aggiungi la regola manualmente." };
    }
    if (text.trim().length < 3) return { ok: false as const, message: "Scrivi un argomento o la tua regola." };
    const { data: profile } = await context.supabase.from("profiles").select("cefr_level").eq("id", context.userId).maybeSingle();
    const level = profile?.cefr_level ?? "B1";
    const generated = await generateGrammar(text, level, data.source);
    if (!generated.ok) return generated;
    if (generated.rules.length) {
      const { error } = await context.supabase.from("grammar_rules").upsert(generated.rules.map((content) => ({ user_id: context.userId, material_id: data.source === "lesson" ? data.materialId ?? null : null, title: content.title, level, source: data.source, content })), { ignoreDuplicates: true });
      if (error) return { ok: false as const, message: "Non è stato possibile salvare le regole." };
    }
    if (data.source === "lesson" && data.materialId) {
      const { error } = await context.supabase.from("materials").update({ grammar_extracted_at: new Date().toISOString() }).eq("id", data.materialId);
      if (error) return { ok: false as const, message: "Regole salvate, ma non è stato possibile aggiornare lo stato della lezione." };
    }
    return { ok: true as const, count: generated.rules.length };
  });
export const checkGrammar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ruleId: z.string().uuid(), index: z.number().int().min(0).max(7), answer: z.string().trim().min(1).max(600) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("grammar_rules").select("content").eq("id", data.ruleId).maybeSingle();
    const content = grammarContentSchema.safeParse(row?.content);
    if (!content.success) return { ok: false as const, message: "Regola non trovata." };
    const exercise = content.data.exercises[data.index];
    if (!exercise) return { ok: false as const, message: "Esercizio non trovato." };
    const evaluated = exercise.kind === "choice"
      ? { ok: true as const, result: { correct: data.answer === exercise.answer, feedback: exercise.explanation, natural_answer: exercise.answer } }
      : await evaluateGrammar(content.data, exercise, data.answer);
    if (!evaluated.ok) return evaluated;
    const { error } = await context.supabase.from("grammar_attempts").insert({ user_id: context.userId, rule_id: data.ruleId, exercise_index: data.index, answer: data.answer, correct: evaluated.result.correct, feedback: evaluated.result.feedback });
    if (error) return { ok: false as const, message: "La correzione è pronta, ma il risultato non è stato salvato. Riprova." };
    return evaluated;
  });
export const deleteGrammar = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ruleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("grammar_rules").delete().eq("id", data.ruleId);
    if (error) throw new Error("Non è stato possibile eliminare la regola.");
    return { ok: true };
  });

export const improveGrammarTheory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ruleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("grammar_rules").select("content, level").eq("id", data.ruleId).eq("user_id", context.userId).maybeSingle();
    const parsed = grammarContentSchema.safeParse(row?.content);
    if (!parsed.success || !row) return { ok: false as const, message: "Regola non trovata." };
    if (parsed.data.teaching) return { ok: true as const, content: parsed.data };
    const block = await context.supabase.from("grammar_ai_blocks").select("message").eq("user_id", context.userId).maybeSingle();
    if (block.error) return { ok: false as const, message: "Non è stato possibile verificare la disponibilità dell’AI." };
    if (block.data) return { ok: false as const, message: block.data.message };
    const result = await explainGrammar(parsed.data, row.level);
    if (!result.ok) {
      if (result.blocked) await context.supabase.from("grammar_ai_blocks").upsert({ user_id: context.userId, message: result.message });
      return result;
    }
    const content = withGrammarTeaching(parsed.data, result.teaching);
    const { error } = await context.supabase.from("grammar_rules").update({ content }).eq("id", data.ruleId).eq("user_id", context.userId);
    if (error) return { ok: false as const, message: "Non è stato possibile salvare la spiegazione aggiornata." };
    return { ok: true as const, content };
  });

export const askGrammarClarification = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => grammarQuestionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("grammar_rules").select("content, level").eq("id", data.ruleId).eq("user_id", context.userId).maybeSingle();
    const parsed = grammarContentSchema.safeParse(row?.content);
    if (!parsed.success || !row) return { ok: false as const, message: "Regola non trovata." };
    const block = await context.supabase.from("grammar_ai_blocks").select("message").eq("user_id", context.userId).maybeSingle();
    if (block.error) return { ok: false as const, message: "Non è stato possibile verificare la disponibilità dell’AI." };
    if (block.data) return { ok: false as const, message: block.data.message };
    const result = await clarifyGrammar(parsed.data, row.level, data.question);
    if (!result.ok) {
      if (result.blocked) await context.supabase.from("grammar_ai_blocks").upsert({ user_id: context.userId, message: result.message });
      return result;
    }
    const { data: note, error } = await context.supabase.from("grammar_notes").insert({ user_id: context.userId, rule_id: data.ruleId, question: data.question, answer: result.answer }).select("id, rule_id, question, answer, created_at").single();
    if (error || !note) return { ok: false as const, message: "Il chiarimento non è stato salvato. La tua domanda è rimasta qui." };
    return { ok: true as const, note };
  });
