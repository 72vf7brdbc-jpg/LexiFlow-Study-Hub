import { describe, expect, it } from "vitest";
import { GRAMMAR_KINDS, grammarContentSchema, grammarProgress, grammarQuestionSchema, notesForGrammarRule, supportedGrammarRules, withGrammarTeaching, type GrammarContent } from "@/lib/grammar";

const rule: GrammarContent = {
  title: "Present perfect", overview: "Un evento passato con un legame con il presente.", formation: "have/has + past participle", uses: ["Esperienze"],
  examples: [{ en: "I have visited Rome.", it: "Ho visitato Roma." }], pitfalls: ["Non usarlo con yesterday."], source_quote: "Present perfect: have/has + past participle.",
  exercises: [
    { kind: "gap", prompt: "I _____ (visit) Rome.", options: [], answer: "have visited", explanation: "Esperienza." },
    { kind: "choice", prompt: "She ___ arrived.", options: ["has", "have", "is"], answer: "has", explanation: "Terza persona." },
    { kind: "correction", prompt: "She have arrived.", options: [], answer: "She has arrived.", explanation: "Terza persona." },
    { kind: "transformation", prompt: "Riscrivi al present perfect: I visit Rome.", options: [], answer: "I have visited Rome.", explanation: "have + participio." },
  ],
};
describe("grammar learning rules", () => {
  it("supports gap, choice, correction and transformation as distinct exercises", () => {
    expect(GRAMMAR_KINDS).toEqual(["gap", "choice", "correction", "transformation"]);
    expect(grammarContentSchema.safeParse(rule).success).toBe(true);
    expect(grammarContentSchema.safeParse({ ...rule, exercises: rule.exercises.map((e) => ({ ...e, kind: "gap" })) }).success).toBe(false);
  });
  it("extracts only rules backed by a literal quote from the saved lesson", () => {
    expect(supportedGrammarRules([rule], "Lesson: Present perfect: have/has + past participle.")).toHaveLength(1);
    expect(supportedGrammarRules([rule], "Only vocabulary: apple, decision.")).toHaveLength(0);
    expect(supportedGrammarRules([{ ...rule, source_quote: null }], "Present perfect")).toHaveLength(0);
  });
  it("does not duplicate the same grammar topic in one lesson", () => {
    expect(supportedGrammarRules([rule, { ...rule, title: " PRESENT PERFECT " }], rule.source_quote ?? "")).toHaveLength(1);
  });
  it("allows manually requested rules without claiming a lesson source", () => {
    expect(grammarContentSchema.safeParse({ ...rule, source_quote: null }).success).toBe(true);
  });
  it("requires unambiguous multiple-choice options with a valid solution", () => {
    expect(grammarContentSchema.safeParse({ ...rule, exercises: rule.exercises.map((e) => e.kind === "choice" ? { ...e, options: ["have", "have", "is"] } : e) }).success).toBe(false);
  });
  it("shows grammar progress only for the chosen rule", () => {
    expect(grammarProgress([{ rule_id: "one", correct: true }, { rule_id: "one", correct: false }, { rule_id: "other", correct: true }], "one")).toEqual({ answered: 2, correct: 1, accuracy: 50 });
    expect(grammarProgress([], "one").accuracy).toBeNull();
  });
  it("keeps lesson evidence and existing exercises when making theory clearer", () => {
    const updated = withGrammarTeaching(rule, { overview: "Un’esperienza passata senza indicare quando.", recognition: "Guarda il legame con il presente.", markers: [{ term: "ever", explanation: "Nelle domande sulle esperienze." }], forms: [{ label: "Affermativa", pattern: "Soggetto + have/has + participio passato", example: "She has visited Rome.", translation: "Ha visitato Roma." }], formation_notes: ["Il participio di visit è visited."] });
    expect(updated.source_quote).toBe(rule.source_quote);
    expect(updated.exercises).toEqual(rule.exercises);
    expect(updated.teaching?.forms[0]?.pattern).toBe("Soggetto + have/has + participio passato");
    expect(grammarContentSchema.safeParse(rule).success).toBe(true);
  });
  it("returns personal clarifications only for their own rule in newest-first order", () => {
    const base = { question: "Quando usarlo?", answer: "Quando c’è un legame con il presente." };
    expect(notesForGrammarRule([{ ...base, id: "old", rule_id: "one", created_at: "2026-11-20" }, { ...base, id: "other", rule_id: "two", created_at: "2026-11-22" }, { ...base, id: "new", rule_id: "one", created_at: "2026-11-21" }], "one").map((note) => note.id)).toEqual(["new", "old"]);
  });
  it("requires a real question and a valid rule reference", () => {
    const ruleId = "12345678-1234-4234-8234-123456789abc";
    expect(grammarQuestionSchema.safeParse({ ruleId, question: "Perché si usa has?" }).success).toBe(true);
    expect(grammarQuestionSchema.safeParse({ ruleId, question: "  " }).success).toBe(false);
    expect(grammarQuestionSchema.safeParse({ ruleId: "missing", question: "Perché has?" }).success).toBe(false);
  });
});