// Exercise builders for the methods that are not a simple typed drill.
// Everything is built from the learner's own cards (lesson content only).

import type { MethodId } from "./methods";
import { buildExercise, kindsFor, shuffle, splitAround, type Exercise, type ExerciseKind, type PracticeCard } from "./practice";

type Rng = () => number;

function pick<T>(arr: readonly T[], rng: Rng): T | undefined {
  return arr.length ? arr[Math.floor(rng() * arr.length)] : undefined;
}

/* ------------------------------ Collocations ------------------------------ */

export type MatchPair = { cardId: string; left: string; right: string; full: string };
export type CollocationRound =
  | { type: "match"; mode: "expression" | "meaning"; pairs: MatchPair[] }
  | { type: "gap"; cardId: string; before: string; after: string; answer: string; full: string; meaning: string }
  | { type: "order"; cardId: string; tokens: string[]; answer: string[]; full: string; meaning: string };

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** A collocation containing the word, otherwise the lesson example sentence. */
export function expressionFor(card: PracticeCard, rng: Rng = Math.random): string | null {
  const colls = card.collocations.filter((c) => c.trim().toLowerCase() !== card.term.trim().toLowerCase() && splitAround(c, card.term));
  const c = pick(colls, rng);
  if (c) return c.trim();
  if (card.example && splitAround(card.example, card.term)) return card.example.trim();
  return null;
}

export function tokenize(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Shuffles tokens so that the order is never the original one (when possible). */
export function scrambled(tokens: readonly string[], rng: Rng = Math.random): string[] {
  if (tokens.length < 2) return [...tokens];
  for (let i = 0; i < 8; i++) {
    const s = shuffle(tokens, rng);
    if (s.join(" ") !== tokens.join(" ")) return s;
  }
  return [...tokens].reverse();
}

export function buildCollocationRounds(cards: readonly PracticeCard[], rng: Rng = Math.random): CollocationRound[] {
  const rounds: CollocationRound[] = [];

  // 1. Matching: lesson collocations first, otherwise word ↔ Italian meaning.
  const exprPairs: MatchPair[] = [];
  const meaningPairs: MatchPair[] = [];
  const seen = new Set<string>();
  for (const c of shuffle(cards, rng)) {
    const key = c.term.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const coll = c.collocations.find((x) => x.trim().toLowerCase() !== key && splitAround(x, c.term));
    const split = coll ? splitAround(coll, c.term) : null;
    if (coll && split && exprPairs.length < 4) {
      exprPairs.push({ cardId: c.id, left: `${split.before}___${split.after}`.trim(), right: split.match, full: coll });
    }
    if (meaningPairs.length < 4) meaningPairs.push({ cardId: c.id, left: c.meaning, right: c.term, full: c.term });
  }
  if (exprPairs.length >= 3) rounds.push({ type: "match", mode: "expression", pairs: exprPairs });
  else if (meaningPairs.length >= 3) rounds.push({ type: "match", mode: "meaning", pairs: meaningPairs });

  // 2. Alternate "complete" and "reorder" on every word.
  cards.forEach((c, i) => {
    const expr = expressionFor(c, rng);
    if (!expr) return;
    const tokens = tokenize(expr);
    const canOrder = tokens.length >= 3 && tokens.length <= 14;
    const wantOrder = i % 2 === 1;
    if (canOrder && (wantOrder || !splitAround(expr, c.term))) {
      rounds.push({ type: "order", cardId: c.id, tokens: scrambled(tokens, rng), answer: tokens, full: expr, meaning: c.meaning });
      return;
    }
    const split = splitAround(expr, c.term);
    if (split) rounds.push({ type: "gap", cardId: c.id, before: split.before, after: split.after, answer: split.match, full: expr, meaning: c.meaning });
  });
  return rounds;
}

const normTok = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");

/** Reordering is right when the words follow the original order (punctuation and case ignored). */
export function isOrderCorrect(answer: readonly string[], expected: readonly string[]): boolean {
  if (answer.length !== expected.length) return false;
  return answer.every((t, i) => normTok(t) === normTok(expected[i] ?? ""));
}

/* --------------------------- Retrieval Practice --------------------------- */

export type RetrievalQuestion = {
  cardId: string;
  label: string;
  prompt: string;
  gap?: { before: string; after: string } | undefined;
  answer: string;
};

export function buildRetrievalQuestions(cards: readonly PracticeCard[]): RetrievalQuestion[] {
  return cards.map((c, i) => {
    const options: ("definition" | "cloze" | "meaning")[] = ["meaning"];
    if (c.definition) options.push("definition");
    if (c.cloze && /_{3,}/.test(c.cloze)) options.push("cloze");
    const kind = options[i % options.length] ?? "meaning";
    if (kind === "definition") return { cardId: c.id, label: "Quale parola corrisponde a questa definizione?", prompt: c.definition ?? "", answer: c.term };
    if (kind === "cloze") {
      const parts = (c.cloze ?? "").split(/_{3,}/);
      return { cardId: c.id, label: "Completa la frase", prompt: c.cloze ?? "", gap: { before: parts[0] ?? "", after: parts.slice(1).join("_____") }, answer: c.term };
    }
    return { cardId: c.id, label: "Come si dice in inglese?", prompt: c.meaning, answer: c.term };
  });
}

/* --------------------------- Error-Based Learning ------------------------- */

/** Typed exercises with one checkable answer, used to re-test mistakes. */
export const ERROR_KINDS: ExerciseKind[] = ["cloze", "definition_to_term", "collocation_gap", "term_from_synonym", "meaning_to_term"];

/** The exercise type a method normally uses, to avoid repeating it. */
export const ORIGIN_KIND: Partial<Record<MethodId, ExerciseKind>> = {
  active_recall: "meaning_to_term",
  spaced_repetition: "meaning_to_term",
  retrieval_practice: "definition_to_term",
  collocations: "collocation_gap",
  synonyms_paraphrasing: "term_from_synonym",
};

/** Same card with a gap sentence built from its example when the lesson gave none. */
export function withCloze(card: PracticeCard): PracticeCard {
  if (card.cloze && /_{3,}/.test(card.cloze)) return card;
  const split = card.example ? splitAround(card.example, card.term) : null;
  return split ? { ...card, cloze: `${split.before}_____${split.after}` } : card;
}

export function errorKindsFor(card: PracticeCard, origin: string, pool: readonly PracticeCard[]): ExerciseKind[] {
  const c = withCloze(card);
  const available = kindsFor(c, "mixed", pool).filter((k) => ERROR_KINDS.includes(k));
  if (!available.includes("meaning_to_term")) available.push("meaning_to_term");
  const avoid = ORIGIN_KIND[origin as MethodId];
  const different = available.filter((k) => k !== avoid);
  return different.length ? different : available;
}

export function buildErrorExercise(card: PracticeCard, origin: string, pool: readonly PracticeCard[], attempt: number, rng: Rng = Math.random): Exercise {
  const kinds = errorKindsFor(card, origin, pool);
  const kind = kinds[(attempt + Math.floor(rng() * kinds.length)) % kinds.length] ?? "meaning_to_term";
  return buildExercise(withCloze(card), kind, pool, rng);
}

/* ---------------------------- Speaking Challenge -------------------------- */

export function speakingWordCount(poolSize: number, rng: Rng = Math.random): number {
  return Math.min(poolSize, 3 + Math.floor(rng() * 3));
}

/** Topic taken from the lesson most of the chosen words come from. */
export function speakingTopic(
  cards: readonly Pick<PracticeCard, "material_id">[],
  materials: readonly { id: string; title: string; topic: string | null }[],
): string {
  const counts = new Map<string, number>();
  for (const c of cards) if (c.material_id) counts.set(c.material_id, (counts.get(c.material_id) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const m = materials.find((x) => x.id === top);
  return m?.topic?.trim() || m?.title?.trim() || "Le tue ultime lezioni";
}

export { wordCount };
