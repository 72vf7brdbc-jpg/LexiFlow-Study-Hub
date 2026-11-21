import { z } from "zod";

export const GRAMMAR_KINDS = ["gap", "choice", "correction", "transformation"] as const;
export const grammarTeachingSchema = z.object({
  overview: z.string().trim().min(1).max(2000),
  recognition: z.string().trim().min(1).max(1000),
  markers: z.array(z.object({ term: z.string().trim().min(1).max(80), explanation: z.string().trim().min(1).max(400) })).max(8),
  forms: z.array(z.object({ label: z.string().trim().min(1).max(80), pattern: z.string().trim().min(1).max(400), example: z.string().trim().min(1).max(400), translation: z.string().trim().min(1).max(400) })).min(1).max(6),
  formation_notes: z.array(z.string().trim().min(1).max(600)).min(1).max(5),
});
export const grammarQuestionSchema = z.object({ ruleId: z.string().uuid(), question: z.string().trim().min(3).max(1500) });
export type GrammarTeaching = z.infer<typeof grammarTeachingSchema>;
export type GrammarNote = { id: string; rule_id: string; question: string; answer: string; created_at: string };
export const grammarExerciseSchema = z.object({
  kind: z.enum(GRAMMAR_KINDS),
  prompt: z.string().trim().min(1).max(800),
  options: z.array(z.string().trim().min(1).max(300)).max(4),
  answer: z.string().trim().min(1).max(600),
  explanation: z.string().trim().min(1).max(800),
});
export const grammarContentSchema = z.object({
  title: z.string().trim().min(1).max(140),
  overview: z.string().trim().min(1).max(1200),
  formation: z.string().trim().min(1).max(1000),
  teaching: grammarTeachingSchema.optional(),
  uses: z.array(z.string().trim().min(1).max(600)).min(1).max(6),
  examples: z.array(z.object({ en: z.string().min(1).max(500), it: z.string().min(1).max(500) })).min(1).max(5),
  pitfalls: z.array(z.string().trim().min(1).max(600)).max(5),
  source_quote: z.string().max(1000).nullable(),
  exercises: z.array(grammarExerciseSchema).min(4).max(8).superRefine((exercises, ctx) => {
    for (const kind of GRAMMAR_KINDS) if (!exercises.some((e) => e.kind === kind)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing ${kind} exercise` });
    exercises.forEach((e, i) => {
      if (e.kind === "choice" && (e.options.length < 3 || new Set(e.options).size !== e.options.length || !e.options.includes(e.answer))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i], message: "Choice must have distinct options including the answer" });
      if (e.kind === "gap" && !e.prompt.includes("___")) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i], message: "Gap must have a blank" });
    });
  }),
});
export type GrammarContent = z.infer<typeof grammarContentSchema>;
export type GrammarExercise = z.infer<typeof grammarExerciseSchema>;
export type GrammarRule = { id: string; material_id: string | null; title: string; level: string; source: "lesson" | "request" | "manual"; content: GrammarContent; created_at: string };
export type GrammarAttempt = { rule_id: string; correct: boolean };

/** A clearer explanation never replaces exercise history or the evidence from the lesson. */
export function withGrammarTeaching(content: GrammarContent, teaching: GrammarTeaching): GrammarContent {
  return grammarContentSchema.parse({ ...content, teaching: grammarTeachingSchema.parse(teaching) });
}

export function notesForGrammarRule(notes: GrammarNote[], ruleId: string): GrammarNote[] {
  return notes.filter((note) => note.rule_id === ruleId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Literal evidence only: never infer a taught topic from incidental verb forms. */
export function supportedGrammarRules(rules: GrammarContent[], sourceText: string): GrammarContent[] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const source = normalize(sourceText);
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const title = normalize(rule.title);
    const quote = normalize(rule.source_quote ?? "");
    if (!quote || !source.includes(quote) || seen.has(title)) return false;
    seen.add(title);
    return true;
  });
}

export function grammarProgress(attempts: GrammarAttempt[], ruleId: string) {
  const rows = attempts.filter((a) => a.rule_id === ruleId);
  return { answered: rows.length, correct: rows.filter((a) => a.correct).length, accuracy: rows.length ? Math.round(rows.filter((a) => a.correct).length / rows.length * 100) : null };
}