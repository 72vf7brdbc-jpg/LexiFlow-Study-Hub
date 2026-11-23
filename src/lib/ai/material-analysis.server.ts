// Server-only: turns an uploaded lesson (photo, PDF or text) into study cards.
import { APICallError, NoObjectGeneratedError, Output, jsonSchema, streamText, type ModelMessage } from "ai";
import { z } from "zod";

import { ANALYSIS_MODEL, createPersonalProvider, friendlyAiError, getPersonalApiKey } from "./provider.server";
import { goalName, languageName } from "../study-config";
import { grammarContentSchema, supportedGrammarRules } from "../grammar";
import { GRAMMAR_INSTRUCTIONS, grammarWireShape } from "./grammar.server";

export type AnalysisInput = {
  sourceType: "photo" | "file" | "text";
  text?: string | null | undefined;
  base64?: string | null | undefined;
  mimeType?: string | null | undefined;
  fileName?: string | null | undefined;
  additionalFiles?: ({ kind: "text"; text: string; fileName: string } | { kind: "binary"; base64: string; mimeType: string; fileName: string })[] | undefined;
};

export type LearnerProfile = {
  cefr_level: string | null;
  goal: string | null;
  native_language: string | null;
};

const cardSchema = z.object({
  kind: z.enum(["vocabulary", "grammar", "phrase"]),
  term: z.string().trim().min(1).max(120),
  meaning: z.string().trim().min(1).max(300),
  definition: z.string().trim().max(400).nullable(),
  example: z.string().trim().max(400).nullable(),
  cloze: z.string().trim().max(400).nullable(),
  phonetic: z.string().trim().max(80).nullable(),
});

const analysisSchema = z.object({
  title: z.string().trim().max(140),
  topic: z.string().trim().max(80),
  summary: z.string().trim().max(800),
  extracted_text: z.string().max(12000),
  cards: z.array(cardSchema),
  grammar_rules: z.array(grammarContentSchema).max(6),
});

export type MaterialAnalysis = z.infer<typeof analysisSchema>;

const nullableString: { type: ("string" | "null")[] } = { type: ["string", "null"] };

const wireSchema = jsonSchema<MaterialAnalysis>({
  type: "object",
  additionalProperties: false,
  required: ["title", "topic", "summary", "extracted_text", "cards", "grammar_rules"],
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    summary: { type: "string" },
    extracted_text: { type: "string" },
    grammar_rules: { type: "array", items: grammarWireShape },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "term", "meaning", "definition", "example", "cloze", "phonetic"],
        properties: {
          kind: { type: "string", enum: ["vocabulary", "grammar", "phrase"] },
          term: { type: "string" },
          meaning: { type: "string" },
          definition: nullableString,
          example: nullableString,
          cloze: nullableString,
          phonetic: nullableString,
        },
      },
    },
  },
});

const LEVEL_GUIDANCE: Record<string, string> = {
  A1: "A1: very high-frequency everyday words, simple present, basic phrases. Keep definitions extremely simple.",
  A2: "A2: common everyday vocabulary, simple past, routine expressions, basic collocations.",
  B1: "B1: wider vocabulary for work, travel and opinions, common phrasal verbs, present perfect, conditionals.",
  B2: "B2: precise vocabulary, idiomatic collocations, phrasal verbs, linking words, passive and reported speech.",
};

const GOAL_GUIDANCE: Record<string, string> = {
  cambridge: "Cambridge FCE/CAE: prioritise Use of English items — collocations, phrasal verbs, word formation, dependent prepositions.",
  ielts: "IELTS: prioritise academic word list items, paraphrasing vocabulary and linking devices useful in Writing Task 1/2 and Speaking.",
  toefl: "TOEFL: prioritise campus/lecture academic vocabulary and synonyms useful in Reading and Integrated tasks.",
  conversation: "Conversation/Business: prioritise natural spoken expressions, polite functional phrases and workplace vocabulary.",
};

function buildInstructions(profile: LearnerProfile) {
  const level = profile.cefr_level ?? "B1";
  const nativeLanguage = languageName(profile.native_language);
  return [
    "You are an expert English teacher who turns a student's lesson material into spaced-repetition study cards.",
    `Learner CEFR level: ${level}. ${LEVEL_GUIDANCE[level] ?? ""}`,
    `Learner goal: ${goalName(profile.goal)}. ${GOAL_GUIDANCE[profile.goal ?? ""] ?? ""}`,
    `Learner native language: ${nativeLanguage}. Write "meaning" (a concise translation) in ${nativeLanguage}. Write "title", "topic" and "summary" in Italian.`,
    "Steps:",
    "1. Read the material carefully. If it is a photo of a handout, notebook or whiteboard, transcribe the readable text faithfully into extracted_text (keep line breaks, max ~6000 characters).",
    "2. Select the 8 to 20 most useful items for this learner, calibrated to the level and goal. Include grammar points from the material when present.",
    "3. For each card:",
    "   - term: the English answer the learner must recall — a word, phrasal verb, collocation or short grammatical form (1-6 words). For grammar cards, term is the correct form to produce (e.g. 'have been living').",
    "   - meaning: short translation/explanation in the learner's native language.",
    "   - definition: a short English definition or grammar rule at the learner's level.",
    "   - example: a natural English example sentence containing the term exactly.",
    "   - cloze: the same example sentence with the term replaced by '_____'.",
    "   - phonetic: IPA for single words or short phrases, otherwise null.",
    "Avoid duplicates and trivial words below the learner's level. Never invent content unrelated to the material.",
    "If the material is unreadable or contains no English to learn, return an empty cards array and explain why in summary.",
    GRAMMAR_INSTRUCTIONS,
  ].join("\n");
}

function buildSingleMessages(input: AnalysisInput): ModelMessage[] {
  const intro = "Here is my lesson material. Create study cards from it.";
  if (input.sourceType === "text" || !input.base64) {
    return [{ role: "user", content: [{ type: "text", text: `${intro}\n\n---\n${(input.text ?? "").slice(0, 60000)}` }] }];
  }
  const mime = (input.mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") {
    return [
      {
        role: "user",
        content: [
          { type: "text", text: intro },
          { type: "file", data: input.base64, mediaType: "application/pdf", filename: input.fileName ?? "lesson.pdf" },
        ],
      },
    ];
  }
  const dataUrl = `data:${mime || "image/jpeg"};base64,${input.base64}`;
  return [
    {
      role: "user",
      content: [
        { type: "text", text: `${intro} It is a photo or scan — read all visible text, including handwriting.` },
        { type: "image", image: new URL(dataUrl) },
      ],
    },
  ];
}

function buildMessages(input: AnalysisInput): ModelMessage[] {
  const messages = buildSingleMessages(input);
  for (const file of input.additionalFiles ?? []) {
    messages.push(...buildSingleMessages(file.kind === "text"
      ? { sourceType: "text", text: file.text, fileName: file.fileName }
      : { sourceType: "file", base64: file.base64, mimeType: file.mimeType, fileName: file.fileName }));
  }
  return messages;
}

export type AnalysisResult =
  | { ok: true; analysis: MaterialAnalysis }
  | { ok: false; message: string };

export async function analyzeMaterialWithAI(input: AnalysisInput, profile: LearnerProfile): Promise<AnalysisResult> {
  try {
    const provider = createPersonalProvider(getPersonalApiKey());
    const result = streamText({
      model: provider(ANALYSIS_MODEL),
      system: buildInstructions(profile),
      messages: buildMessages(input),
      output: Output.object({ schema: wireSchema }),
      maxRetries: 0,

    });

    const raw = await result.output;
    const parsed = analysisSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("analysis schema mismatch", parsed.error.issues.slice(0, 3));
      return { ok: false, message: "L'AI ha restituito un risultato incompleto. Riprova." };
    }
    const seen = new Set<string>();
    const cards = parsed.data.cards
      .filter((c) => {
        const k = c.term.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 25);
    const grammar_rules = supportedGrammarRules(parsed.data.grammar_rules, parsed.data.extracted_text);
    return { ok: true, analysis: { ...parsed.data, cards, grammar_rules } };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("no object generated", error.message);
      return { ok: false, message: "L'AI non è riuscita a leggere il materiale. Prova con un'immagine più nitida o un testo." };
    }
    if (APICallError.isInstance(error)) {
      console.error("ai gateway error", error.statusCode, error.responseBody?.slice(0, 300));
      return { ok: false, message: friendlyAiError(error.statusCode) };
    }
    const cause = (error as { cause?: unknown })?.cause;
    if (APICallError.isInstance(cause)) {
      console.error("ai gateway error", cause.statusCode, cause.responseBody?.slice(0, 300));
      return { ok: false, message: friendlyAiError(cause.statusCode) };
    }
    console.error("analysis failed", error);
    return { ok: false, message: error instanceof Error ? error.message : friendlyAiError(undefined) };
  }
}
