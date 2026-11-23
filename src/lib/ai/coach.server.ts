// Server-only: AI checks for the open-answer review methods
// (Sentence Creation, Synonyms & Paraphrasing, Contextual Learning, Translation Practice).
import { APICallError, NoObjectGeneratedError, Output, jsonSchema, streamText } from "ai";
import { z } from "zod";

import { COACH_MODEL, createResponsesProvider, friendlyAiError, getPersonalApiKey } from "./provider.server";

export type CoachCard = { term: string; meaning: string; definition: string | null; example: string | null };

export type CoachTask =
  | { method: "sentence_creation"; answer: string }
  | { method: "synonyms_paraphrasing"; task: "synonym" | "paraphrase"; answer: string }
  | { method: "contextual_learning"; meaning: string; register: "formale" | "informale" | "neutro"; sentence: string }
  | { method: "translation_practice"; direction: "it_en" | "en_it"; source: string; answer: string };

const verdicts = ["correct", "almost", "wrong"] as const;
const registers = ["formale", "informale", "neutro"] as const;

const coachSchema = z.object({
  verdict: z.enum(verdicts),
  feedback: z.string().max(600),
  checks: z.array(z.object({ label: z.string().max(40), ok: z.boolean(), note: z.string().max(300) })).max(4),
  suggestion: z.string().max(500).nullable(),
  literal: z.boolean().nullable(),
  actual_register: z.enum(registers).nullable(),
});
export type CoachVerdict = z.infer<typeof coachSchema>;

const coachWire = jsonSchema<CoachVerdict>({
  type: "object",
  additionalProperties: false,
  required: ["verdict", "feedback", "checks", "suggestion", "literal", "actual_register"],
  properties: {
    verdict: { type: "string", enum: [...verdicts] },
    feedback: { type: "string" },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "ok", "note"],
        properties: { label: { type: "string" }, ok: { type: "boolean" }, note: { type: "string" } },
      },
    },
    suggestion: { type: ["string", "null"] },
    literal: { type: ["boolean", "null"] },
    actual_register: { type: ["string", "null"], enum: [...registers, null] },
  },
});

const BASE = [
  "You are a warm but precise English teacher checking one answer of an Italian-speaking learner.",
  "Write feedback, check labels and notes in Italian. Keep feedback to 1-3 short sentences, encouraging and concrete.",
  "verdict: correct = no real problems; almost = right idea with small slips (spelling, an article, a preposition); wrong = wrong meaning, word missing or misused, or serious grammar errors.",
  "Never penalise a correct answer just because it differs from the lesson example.",
  "Do not teach new vocabulary: the suggestion may only correct or polish the learner's own words, unless the task below says otherwise.",
  "Set literal and actual_register to null unless the task below asks for them.",
].join("\n");

function taskInstructions(task: CoachTask): string {
  switch (task.method) {
    case "sentence_creation":
      return [
        "Task: the learner wrote an original English sentence that must contain the lesson word.",
        'checks (exactly these labels): "Grammatica", "Significato" (the word is used with the right meaning), "Naturalezza" (would a native speaker say it?).',
        "verdict is wrong if the lesson word (or a correct inflected form) is missing or misused.",
        "suggestion: the learner's sentence with minimal corrections, or null if it is already perfect.",
      ].join("\n");
    case "synonyms_paraphrasing":
      return task.task === "synonym"
        ? [
            "Task: the learner proposed a synonym or equivalent expression for the lesson word, as used in the lesson example.",
            'checks (exactly these labels): "Significato" (same meaning), "Uso nella frase" (it fits the example sentence in place of the word).',
            "suggestion: the lesson example rewritten with the learner's word (adjusting grammar if needed) when the synonym works, otherwise null. Never propose a different synonym.",
          ].join("\n")
        : [
            "Task: the learner rewrote the lesson example sentence with different words, keeping the same meaning.",
            'checks (exactly these labels): "Stesso significato", "Parole diverse" (not just a copy of the original), "Grammatica".',
            "suggestion: the learner's paraphrase with minimal corrections, or null if it is already perfect.",
          ].join("\n");
    case "contextual_learning":
      return [
        "Task: the learner read the lesson example, deduced the meaning of the lesson word from context (answer in Italian or English), chose its register, then used the word in a new sentence with a different context.",
        'checks (exactly these labels): "Significato dedotto", "Registro", "Nuovo contesto" (correct use, in a context clearly different from the example).',
        "actual_register: the register of the lesson word as used in the example (formale, informale or neutro).",
        "verdict: correct if meaning and new sentence are right and the register matches; almost if only the register or small slips are off; wrong if the meaning is wrong or the word is misused.",
        "suggestion: the learner's new sentence with minimal corrections, or null if it is already perfect.",
      ].join("\n");
    case "translation_practice":
      return [
        task.direction === "it_en"
          ? "Task: the learner translated an Italian sentence into English. The lesson's English sentence is one natural reference translation, not the only correct one."
          : "Task: the learner translated an English sentence from the lesson into Italian.",
        'checks (exactly these labels): "Significato", "Naturalezza", "Grammatica".',
        "literal: true when the translation is a word-for-word calque that sounds unnatural in the target language, otherwise false.",
        "suggestion: ALWAYS give the most natural translation in the target language; when literal is true, explain in feedback which part sounds like a calque.",
      ].join("\n");
  }
}

function taskPrompt(task: CoachTask, card: CoachCard): string {
  const lines = [
    `Lesson word: ${card.term}`,
    `Meaning (Italian): ${card.meaning}`,
    card.definition ? `Definition: ${card.definition}` : null,
    card.example ? `Lesson example: ${card.example}` : null,
    "",
  ];
  switch (task.method) {
    case "sentence_creation":
      lines.push(`Learner's sentence: ${task.answer}`);
      break;
    case "synonyms_paraphrasing":
      lines.push(task.task === "synonym" ? `Learner's synonym: ${task.answer}` : `Learner's paraphrase of the example: ${task.answer}`);
      break;
    case "contextual_learning":
      lines.push(`Learner's deduced meaning: ${task.meaning}`, `Learner's register choice: ${task.register}`, `Learner's new sentence: ${task.sentence}`);
      break;
    case "translation_practice":
      lines.push(
        `Direction: ${task.direction === "it_en" ? "Italian → English" : "English → Italian"}`,
        `Sentence to translate: ${task.source}`,
        `Learner's translation: ${task.answer}`,
      );
      break;
  }
  return lines.filter((l) => l !== null).join("\n");
}

export type CoachResult = { ok: true; result: CoachVerdict } | { ok: false; message: string };

function failure(error: unknown, fallback: string): { ok: false; message: string } {
  if (NoObjectGeneratedError.isInstance(error)) {
    console.error("coach: no object", error.message);
    return { ok: false, message: fallback };
  }
  const api = APICallError.isInstance(error) ? error : APICallError.isInstance((error as { cause?: unknown })?.cause) ? ((error as { cause: APICallError }).cause) : null;
  if (api) {
    console.error("coach: gateway error", api.statusCode, api.responseBody?.slice(0, 300));
    if (api.statusCode === 402) return { ok: false, message: "Il servizio AI personale richiede credito sul tuo account OpenAI, non crediti Lovable." };
    return { ok: false, message: friendlyAiError(api.statusCode, fallback) };
  }
  console.error("coach failed", error);
  return { ok: false, message: error instanceof Error ? error.message : fallback };
}

export async function evaluateWithCoach(task: CoachTask, card: CoachCard, level: string | null): Promise<CoachResult> {
  try {
    const provider = createResponsesProvider(getPersonalApiKey());
    const result = streamText({
      model: provider.responses(COACH_MODEL),
      instructions: `${BASE}\nLearner CEFR level: ${level ?? "B1"}.\n${taskInstructions(task)}`,
      prompt: taskPrompt(task, card),
      output: Output.object({ schema: coachWire }),
      maxRetries: 0,
    });
    const parsed = coachSchema.safeParse(await result.output);
    if (!parsed.success) {
      console.error("coach schema mismatch", parsed.error.issues.slice(0, 3));
      return { ok: false, message: "La correzione non è arrivata completa. Riprova." };
    }
    return { ok: true, result: parsed.data };
  } catch (error) {
    return failure(error, "Non è stato possibile correggere la risposta. Riprova.");
  }
}

/* ------------------------- Italian versions of lesson sentences ------------------------- */

const translationSchema = z.object({ items: z.array(z.object({ id: z.string(), it: z.string().max(500) })) });
const translationWire = jsonSchema<z.infer<typeof translationSchema>>({
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "it"],
        properties: { id: { type: "string" }, it: { type: "string" } },
      },
    },
  },
});

export type TranslateResult = { ok: true; items: { id: string; it: string }[] } | { ok: false; message: string };

/** Natural Italian versions of the learner's lesson sentences, for Italian → English practice. */
export async function italianVersions(sentences: { id: string; en: string }[]): Promise<TranslateResult> {
  try {
    const provider = createResponsesProvider(getPersonalApiKey());
    const result = streamText({
      model: provider.responses(COACH_MODEL),
      instructions:
        "Translate each English sentence into natural, idiomatic Italian, as a native speaker would say it (not word for word). Return one item per input id, keeping the same id.",
      prompt: JSON.stringify(sentences),
      output: Output.object({ schema: translationWire }),
      maxRetries: 0,
    });
    const parsed = translationSchema.safeParse(await result.output);
    if (!parsed.success) return { ok: false, message: "Non sono riuscito a preparare le frasi. Riprova." };
    return { ok: true, items: parsed.data.items };
  } catch (error) {
    return failure(error, "Non sono riuscito a preparare le frasi. Riprova.");
  }
}
