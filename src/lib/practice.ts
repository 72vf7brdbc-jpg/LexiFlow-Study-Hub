// Exercise builder for the Ripasso section.
// Every exercise is built only from fields of the learner's own cards, which the
// AI extracted from uploaded lessons: no outside words, synonyms or collocations.

import { learningStatus } from "./srs";

export type Focus = "due" | "wrong" | "unlearned" | "mixed";
export type Family = "recall" | "collocations" | "synonyms" | "mixed";

export const FOCUS_OPTIONS: { id: Focus; label: string; hint: string }[] = [
  { id: "due", label: "Da ripassare oggi", hint: "Le schede in scadenza secondo il calendario" },
  { id: "wrong", label: "Solo gli errori", hint: "Le parole che hai sbagliato almeno una volta" },
  { id: "unlearned", label: "Non ancora apprese", hint: "Tutto ciò che non è ancora «Appreso»" },
  { id: "mixed", label: "Sessione mista", hint: "Un po' di tutto, in ordine sempre diverso" },
];

export const FAMILY_OPTIONS: { id: Family; label: string; hint: string }[] = [
  { id: "mixed", label: "Mix di esercizi", hint: "Alterna tutte le tipologie disponibili" },
  { id: "recall", label: "Active Recall", hint: "Definizione → parola, parola → significato, frasi da completare" },
  { id: "collocations", label: "Collocations & Expressions", hint: "Abbina, completa e ricostruisci le espressioni" },
  { id: "synonyms", label: "Synonyms & Paraphrasing", hint: "Sinonimi e sostituzioni presenti nelle lezioni" },
];

export type PracticeCard = {
  id: string;
  term: string;
  meaning: string;
  definition: string | null;
  example: string | null;
  cloze: string | null;
  kind: string;
  synonyms: string[];
  collocations: string[];
  due_at: string;
  repetitions: number;
  interval_days: number;
  correct_count: number;
  incorrect_count: number;
  material_id: string | null;
};

type Rng = () => number;

export function filterByFocus<T extends PracticeCard>(cards: readonly T[], focus: Focus, now: Date = new Date()): T[] {
  const t = now.getTime();
  if (focus === "due") return cards.filter((c) => new Date(c.due_at).getTime() <= t);
  if (focus === "wrong") return cards.filter((c) => c.incorrect_count > 0);
  if (focus === "unlearned") return cards.filter((c) => learningStatus(c) !== "mastered");
  return [...cards];
}

/** Picks the session: urgent and difficult cards first, with jitter so the order changes every time. */
export function selectSessionCards<T extends PracticeCard>(
  cards: readonly T[],
  focus: Focus,
  size: number,
  now: Date = new Date(),
  rng: Rng = Math.random,
): T[] {
  const pool = filterByFocus(cards, focus, now);
  const t = now.getTime();
  const scored = pool.map((c) => {
    const due = new Date(c.due_at).getTime() <= t ? 2 : 0;
    const errors = Math.min(3, c.incorrect_count) * 0.6;
    const relearn = c.repetitions === 0 && c.incorrect_count > 0 ? 1.5 : 0;
    return { c, s: due + errors + relearn + rng() * 1.5 };
  });
  scored.sort((a, b) => b.s - a.s);
  return shuffle(
    scored.slice(0, size).map((x) => x.c),
    rng,
  );
}

export type ExerciseKind =
  | "meaning_to_term"
  | "definition_to_term"
  | "term_to_meaning"
  | "cloze"
  | "collocation_gap"
  | "collocation_choice"
  | "synonym_of"
  | "term_from_synonym"
  | "swap_in_sentence";

export const KIND_LABEL: Record<ExerciseKind, string> = {
  meaning_to_term: "Come si dice in inglese?",
  definition_to_term: "Quale parola corrisponde alla definizione?",
  term_to_meaning: "Che cosa significa?",
  cloze: "Completa la frase",
  collocation_gap: "Completa l'espressione",
  collocation_choice: "Scegli la parola giusta",
  synonym_of: "Scrivi un sinonimo visto a lezione",
  term_from_synonym: "Quale parola della lezione ha lo stesso significato?",
  swap_in_sentence: "Sostituisci con un'espressione equivalente",
};

const FAMILY_KINDS: Record<Exclude<Family, "mixed">, ExerciseKind[]> = {
  recall: ["meaning_to_term", "definition_to_term", "term_to_meaning", "cloze"],
  collocations: ["collocation_gap", "collocation_choice", "definition_to_term"],
  synonyms: ["synonym_of", "term_from_synonym", "swap_in_sentence"],
};

/** Finds `term` inside `text` (case-insensitive, whole words) and splits around it. */
export function splitAround(text: string, term: string): { before: string; match: string; after: string } | null {
  const t = term.trim();
  if (!t) return null;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}'])(${escaped})(?=$|[^\\p{L}\\p{N}'])`, "iu");
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + (m[1]?.length ?? 0);
  const match = m[2] ?? t;
  return { before: text.slice(0, start), match, after: text.slice(start + match.length) };
}

function collocationsWithTerm(card: PracticeCard): string[] {
  return card.collocations.filter((c) => c.trim().toLowerCase() !== card.term.trim().toLowerCase() && splitAround(c, card.term));
}

export function kindsFor(card: PracticeCard, family: Family, pool: readonly PracticeCard[] = []): ExerciseKind[] {
  const families = family === "mixed" ? (["recall", "collocations", "synonyms"] as const) : ([family] as const);
  const out = new Set<ExerciseKind>();
  const hasColl = collocationsWithTerm(card).length > 0;
  const isExpression = card.kind === "phrase" || /\s/.test(card.term.trim());
  for (const f of families) {
    for (const k of FAMILY_KINDS[f]) {
      if (k === "definition_to_term" && !card.definition) continue;
      if (k === "definition_to_term" && f === "collocations" && !isExpression) continue;
      if (k === "cloze" && !(card.cloze && /_{3,}/.test(card.cloze))) continue;
      if (k === "collocation_gap" && !hasColl) continue;
      if (k === "collocation_choice" && (!hasColl || pool.filter((p) => p.id !== card.id).length < 2)) continue;
      if ((k === "synonym_of" || k === "term_from_synonym") && card.synonyms.length === 0) continue;
      if (k === "swap_in_sentence" && !(card.synonyms.length > 0 && card.example && splitAround(card.example, card.term))) continue;
      out.add(k);
    }
  }
  return [...out];
}

export function hasFamilyContent(card: PracticeCard, family: Family, pool: readonly PracticeCard[] = []): boolean {
  return kindsFor(card, family, pool).length > 0;
}

export type Exercise = {
  kind: ExerciseKind;
  cardId: string;
  instruction: string;
  /** Main text shown on the card. */
  prompt: string;
  /** Sentence with a gap: before ___ after. */
  gap?: { before: string; after: string } | undefined;
  /** Sentence with a highlighted expression to replace. */
  highlight?: { before: string; word: string; after: string } | undefined;
  /** Secondary line under the prompt. */
  note?: string | undefined;
  /** Accepted answers, all taken from the card. */
  answers: string[];
  /** Solution shown after answering. */
  solution: string;
  choices?: string[] | undefined;
  /** The learner judges their own recall (no typing). */
  selfGraded?: boolean | undefined;
};

export function buildExercise(card: PracticeCard, kind: ExerciseKind, pool: readonly PracticeCard[] = [], rng: Rng = Math.random): Exercise {
  const base = { kind, cardId: card.id, instruction: KIND_LABEL[kind] };
  switch (kind) {
    case "definition_to_term":
      return { ...base, prompt: card.definition ?? card.meaning, answers: [card.term], solution: card.term };
    case "term_to_meaning":
      return { ...base, prompt: card.term, note: card.example ?? undefined, answers: [card.meaning], solution: card.meaning, selfGraded: true };
    case "cloze": {
      const parts = (card.cloze ?? "").split(/_{3,}/);
      return {
        ...base,
        prompt: card.cloze ?? "",
        gap: { before: parts[0] ?? "", after: parts.slice(1).join("_____") },
        note: `Significato: ${card.meaning}`,
        answers: [card.term],
        solution: card.term,
      };
    }
    case "collocation_gap":
    case "collocation_choice": {
      const coll = pick(collocationsWithTerm(card), rng) ?? card.term;
      const split = splitAround(coll, card.term);
      const ex: Exercise = {
        ...base,
        prompt: coll,
        gap: { before: split?.before ?? "", after: split?.after ?? "" },
        note: `Significato: ${card.meaning}`,
        answers: [card.term],
        solution: coll,
      };
      if (kind === "collocation_choice") {
        const distractors = shuffle(
          pool.filter((p) => p.id !== card.id && p.term.toLowerCase() !== card.term.toLowerCase()).map((p) => p.term),
          rng,
        ).slice(0, 3);
        ex.choices = shuffle([card.term, ...distractors], rng);
      }
      return ex;
    }
    case "synonym_of":
      return {
        ...base,
        prompt: card.term,
        note: `Significato: ${card.meaning}`,
        answers: [...card.synonyms],
        solution: card.synonyms.join(" · "),
      };
    case "term_from_synonym": {
      const syn = pick(card.synonyms, rng) ?? card.synonyms[0] ?? "";
      return { ...base, prompt: syn, note: `Significato: ${card.meaning}`, answers: [card.term], solution: card.term };
    }
    case "swap_in_sentence": {
      const split = splitAround(card.example ?? "", card.term);
      return {
        ...base,
        prompt: card.example ?? "",
        highlight: split ? { before: split.before, word: split.match, after: split.after } : undefined,
        note: "Scrivi solo l'espressione che sostituisce quella evidenziata.",
        answers: [...card.synonyms],
        solution: card.synonyms.join(" · "),
      };
    }
    case "meaning_to_term":
    default:
      return {
        ...base,
        kind: "meaning_to_term",
        instruction: KIND_LABEL.meaning_to_term,
        prompt: card.meaning,
        note: card.definition ?? undefined,
        answers: [card.term],
        solution: card.term,
      };
  }
}

/** Chooses an exercise type for a card, avoiding the type it just had. */
export function nextExercise(card: PracticeCard, family: Family, pool: readonly PracticeCard[], attempt: number, rng: Rng = Math.random, previous?: ExerciseKind): Exercise {
  let kinds = kindsFor(card, family, pool);
  if (kinds.length === 0) kinds = ["meaning_to_term"];
  // A retry after a mistake uses a typed exercise so the learner actively produces the answer.
  if (attempt > 0) kinds = kinds.filter((k) => k !== "term_to_meaning" && k !== "collocation_choice").concat();
  if (kinds.length === 0) kinds = ["meaning_to_term"];
  const options = kinds.length > 1 && previous ? kinds.filter((k) => k !== previous) : kinds;
  return buildExercise(card, pick(options, rng) ?? "meaning_to_term", pool, rng);
}

export type MatchPair = { cardId: string; left: { before: string; after: string }; right: string; full: string };

/** "Abbina" round: up to 4 collocations with the lesson word removed, to pair with the words. */
export function buildMatchRound(cards: readonly PracticeCard[], rng: Rng = Math.random): MatchPair[] {
  const pairs: MatchPair[] = [];
  const used = new Set<string>();
  for (const c of shuffle([...cards], rng)) {
    const key = c.term.toLowerCase();
    if (used.has(key)) continue;
    const coll = pick(collocationsWithTerm(c), rng);
    if (!coll) continue;
    const split = splitAround(coll, c.term);
    if (!split) continue;
    used.add(key);
    pairs.push({ cardId: c.id, left: { before: split.before, after: split.after }, right: c.term, full: coll });
    if (pairs.length === 4) break;
  }
  return pairs.length >= 3 ? pairs : [];
}

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pick<T>(arr: readonly T[], rng: Rng): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}
