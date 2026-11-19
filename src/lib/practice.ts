// Exercise builder for the Ripasso section.
// Exercises are generated exclusively from the learner's own cards.
// No external vocabulary, synonyms or collocations are introduced.

import { learningStatus } from "./srs";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Focus = "due" | "wrong" | "unlearned" | "mixed";

export type PracticeCategory =
  | "Memorizzazione"
  | "Vocabolario"
  | "Produzione"
  | "Consolidamento";

export interface PracticeMethod {
  id: number;
  name: string;
  category: PracticeCategory;
  description: string;
  type: string;
}

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

export type ExerciseKind =
  | "active_recall"
  | "spaced_repetition"
  | "collocations"
  | "sentence_creation"
  | "synonyms_paraphrasing"
  | "speaking_challenge"
  | "retrieval_practice"
  | "contextual_learning"
  | "error_based_learning"
  | "translation_practice"
  | "meaning_to_term"
  | "definition_to_term"
  | "term_to_meaning"
  | "cloze"
  | "collocation_gap"
  | "collocation_choice"
  | "synonym_of"
  | "term_from_synonym"
  | "swap_in_sentence";

export interface Exercise {
  kind: ExerciseKind;
  cardId: string;
  instruction: string;
  prompt: string;
  gap?: { before: string; after: string } | undefined;
  highlight?: { before: string; word: string; after: string } | undefined;
  note?: string | undefined;
  answers: string[];
  solution: string;
  choices?: string[] | undefined;
  selfGraded?: boolean | undefined;
  subMode?: "match" | "gap" | "unscramble" | undefined;
  scrambledWords?: string[] | undefined;
  registerOptions?: string[] | undefined;
  timerSeconds?: number | undefined;
  speakingWords?: string[] | undefined;
}

type Rng = () => number;

// -----------------------------------------------------------------------------
// Practice methods
// -----------------------------------------------------------------------------

export const PRACTICE_CATEGORIES: Record<
  PracticeCategory,
  { title: string; methods: PracticeMethod[] }
> = {
  Memorizzazione: {
    title: "Memorizzazione",
    methods: [
      {
        id: 1,
        name: "Active Recall",
        category: "Memorizzazione",
        description:
          "Recupera una parola dalla memoria partendo dalla definizione, dal significato o da un indizio.",
        type: "active_recall",
      },
      {
        id: 2,
        name: "Spaced Repetition",
        category: "Memorizzazione",
        description:
          "Ripassa le parole secondo intervalli progressivi di 1, 3, 7, 14 e 30 giorni. Una risposta errata riporta la parola al primo livello.",
        type: "spaced_repetition",
      },
      {
        id: 7,
        name: "Retrieval Practice",
        category: "Memorizzazione",
        description:
          "Rispondi a domande aperte senza suggerimenti. Le soluzioni vengono mostrate soltanto al termine della sessione.",
        type: "retrieval_practice",
      },
    ],
  },

  Vocabolario: {
    title: "Vocabolario",
    methods: [
      {
        id: 3,
        name: "Collocations",
        category: "Vocabolario",
        description:
          "Completa espressioni, abbina parole e ricostruisci collocations utilizzando quelle presenti nelle tue schede.",
        type: "collocations",
      },
      {
        id: 8,
        name: "Contextual Learning",
        category: "Vocabolario",
        description:
          "Deduce il significato di una parola dal contesto, identifica il registro linguistico e crea un nuovo esempio.",
        type: "contextual_learning",
      },
      {
        id: 10,
        name: "Translation Practice",
        category: "Vocabolario",
        description:
          "Traduci parole ed espressioni dall'italiano all'inglese e viceversa. La valutazione AI potrà analizzare naturalezza e correttezza.",
        type: "translation_practice",
      },
    ],
  },

  Produzione: {
    title: "Produzione",
    methods: [
      {
        id: 4,
        name: "Sentence Creation",
        category: "Produzione",
        description:
          "Crea una frase originale in inglese utilizzando la parola assegnata. La frase dovrà essere valutata per grammatica, significato e naturalezza.",
        type: "sentence_creation",
      },
      {
        id: 5,
        name: "Synonyms & Paraphrasing",
        category: "Produzione",
        description:
          "Trova sinonimi registrati nelle tue schede e riscrivi frasi mantenendone il significato.",
        type: "synonyms_paraphrasing",
      },
      {
        id: 6,
        name: "Speaking Challenge",
        category: "Produzione",
        description:
          "Parla per 90 secondi su un argomento utilizzando le parole assegnate. Alla fine indica quali hai effettivamente utilizzato.",
        type: "speaking_challenge",
      },
    ],
  },

  Consolidamento: {
    title: "Consolidamento",
    methods: [
      {
        id: 9,
        name: "Error-Based Learning",
        category: "Consolidamento",
        description:
          "Riprendi le parole associate a errori precedenti e verifica se hai consolidato il loro apprendimento.",
        type: "error_based_learning",
      },
    ],
  },
};

// -----------------------------------------------------------------------------
// Focus options
// -----------------------------------------------------------------------------

export const FOCUS_OPTIONS: {
  id: Focus;
  label: string;
  hint: string;
}[] = [
  {
    id: "due",
    label: "Da ripassare oggi",
    hint: "Le schede in scadenza secondo il calendario SRS.",
  },
  {
    id: "wrong",
    label: "Solo gli errori",
    hint: "Le parole con almeno un errore registrato.",
  },
  {
    id: "unlearned",
    label: "Non ancora apprese",
    hint: "Le schede che non hanno ancora raggiunto lo stato mastered.",
  },
  {
    id: "mixed",
    label: "Sessione mista",
    hint: "Un insieme di schede appartenenti a tutte le categorie.",
  },
];

// -----------------------------------------------------------------------------
// Exercise labels
// -----------------------------------------------------------------------------

export const KIND_LABEL: Record<ExerciseKind, string> = {
  active_recall: "Active Recall",
  spaced_repetition: "Spaced Repetition",
  collocations: "Collocations",
  sentence_creation: "Sentence Creation",
  synonyms_paraphrasing: "Synonyms & Paraphrasing",
  speaking_challenge: "Speaking Challenge",
  retrieval_practice: "Retrieval Practice",
  contextual_learning: "Contextual Learning",
  error_based_learning: "Error-Based Learning",
  translation_practice: "Translation Practice",
  meaning_to_term: "Come si dice in inglese?",
  definition_to_term: "Quale parola corrisponde alla definizione?",
  term_to_meaning: "Che cosa significa?",
  cloze: "Completa la frase",
  collocation_gap: "Completa l'espressione",
  collocation_choice: "Scegli la parola corretta",
  synonym_of: "Scrivi un sinonimo",
  term_from_synonym: "Trova la parola corrispondente",
  swap_in_sentence: "Sostituisci con un'espressione equivalente",
};

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

function randomIndex(length: number, rng: Rng): number {
  if (length <= 0) return 0;

  return Math.min(
    length - 1,
    Math.max(0, Math.floor(rng() * length)),
  );
}

function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[randomIndex(items.length, rng)];
}

export function shuffle<T>(
  items: readonly T[],
  rng: Rng = Math.random,
): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rng);

    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = value.trim().toLowerCase();

    if (!normalized || seen.has(normalized)) return false;

    seen.add(normalized);
    return true;
  });
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

// -----------------------------------------------------------------------------
// Focus filtering
// -----------------------------------------------------------------------------

export function filterByFocus<T extends PracticeCard>(
  cards: readonly T[],
  focus: Focus,
  now: Date = new Date(),
): T[] {
  const timestamp = now.getTime();

  switch (focus) {
    case "due":
      return cards.filter((card) => {
        const dueTimestamp = new Date(card.due_at).getTime();

        return (
          Number.isFinite(dueTimestamp) &&
          dueTimestamp <= timestamp
        );
      });

    case "wrong":
      return cards.filter((card) => card.incorrect_count > 0);

    case "unlearned":
      return cards.filter(
        (card) => learningStatus(card) !== "mastered",
      );

    case "mixed":
    default:
      return [...cards];
  }
}

// -----------------------------------------------------------------------------
// Session card selection
// -----------------------------------------------------------------------------

export function selectSessionCards<T extends PracticeCard>(
  cards: readonly T[],
  focus: Focus,
  size: number,
  now: Date = new Date(),
  rng: Rng = Math.random,
): T[] {
  if (size <= 0) return [];

  const pool = filterByFocus(cards, focus, now);

  const timestamp = now.getTime();

  const scored = pool.map((card) => {
    const dueTimestamp = new Date(card.due_at).getTime();

    const isDue =
      Number.isFinite(dueTimestamp) &&
      dueTimestamp <= timestamp;

    const dueScore = isDue ? 2 : 0;
    const errorScore = Math.min(3, card.incorrect_count) * 0.6;

    const relearnScore =
      card.repetitions === 0 && card.incorrect_count > 0
        ? 1.5
        : 0;

    return {
      card,
      score:
        dueScore +
        errorScore +
        relearnScore +
        rng() * 1.5,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return shuffle(
    scored.slice(0, size).map((item) => item.card),
    rng,
  );
}

// -----------------------------------------------------------------------------
// Text matching and collocations
// -----------------------------------------------------------------------------

export function splitAround(
  text: string,
  term: string,
): { before: string; match: string; after: string } | null {
  const normalizedTerm = term.trim();

  if (!normalizedTerm) return null;

  const escaped = normalizedTerm
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

  const expression = new RegExp(
    `(^|[^\\p{L}\\p{N}'])(${escaped})(?=$|[^\\p{L}\\p{N}'])`,
    "iu",
  );

  const match = expression.exec(text);

  if (!match) return null;

  const prefixLength = match[1]?.length ?? 0;
  const start = match.index + prefixLength;
  const matchedText = match[2] ?? normalizedTerm;

  return {
    before: text.slice(0, start),
    match: matchedText,
    after: text.slice(start + matchedText.length),
  };
}

function collocationsWithTerm(card: PracticeCard): string[] {
  return uniqueStrings(card.collocations).filter(
    (collocation) =>
      normalizeText(collocation) !== normalizeText(card.term) &&
      splitAround(collocation, card.term) !== null,
  );
}

function getDistractors(
  card: PracticeCard,
  pool: readonly PracticeCard[],
  rng: Rng,
): string[] {
  const candidates = uniqueStrings(
    pool
      .filter((item) => item.id !== card.id)
      .map((item) => item.term),
  ).filter(
    (term) => normalizeText(term) !== normalizeText(card.term),
  );

  return shuffle(candidates, rng).slice(0, 3);
}

// -----------------------------------------------------------------------------
// Exercise kinds by method
// -----------------------------------------------------------------------------

export function kindsFor(
  card: PracticeCard,
  methodType: string,
  pool: readonly PracticeCard[] = [],
): ExerciseKind[] {
  const kinds = new Set<ExerciseKind>();

  const hasCollocations = collocationsWithTerm(card).length > 0;
  const hasSynonyms = card.synonyms.length > 0;
  const hasExample = Boolean(card.example);
  const hasDefinition = Boolean(card.definition);

  switch (methodType) {
    case "active_recall":
      kinds.add("meaning_to_term");

      if (hasDefinition) {
        kinds.add("definition_to_term");
      }

      kinds.add("term_to_meaning");
      break;

    case "spaced_repetition":
      kinds.add("spaced_repetition");
      break;

    case "collocations":
      if (hasCollocations) {
        kinds.add("collocation_gap");
        kinds.add("collocations");

        if (pool.some((item) => item.id !== card.id)) {
          kinds.add("collocation_choice");
        }
      }
      break;

    case "sentence_creation":
      kinds.add("sentence_creation");
      break;

    case "synonyms_paraphrasing":
      if (hasSynonyms) {
        kinds.add("synonym_of");
        kinds.add("term_from_synonym");

        if (hasExample) {
          kinds.add("swap_in_sentence");
        }
      }

      kinds.add("synonyms_paraphrasing");
      break;

    case "speaking_challenge":
      kinds.add("speaking_challenge");
      break;

    case "retrieval_practice":
      kinds.add("retrieval_practice");
      break;

    case "contextual_learning":
      kinds.add("contextual_learning");
      break;

    case "error_based_learning":
      kinds.add("error_based_learning");
      break;

    case "translation_practice":
      kinds.add("translation_practice");
      break;

    default:
      kinds.add("meaning_to_term");
      break;
  }

  return [...kinds];
}

// -----------------------------------------------------------------------------
// Exercise builder
// -----------------------------------------------------------------------------

export function buildExercise(
  card: PracticeCard,
  kind: ExerciseKind,
  pool: readonly PracticeCard[] = [],
  rng: Rng = Math.random,
): Exercise {
  const base = {
    kind,
    cardId: card.id,
    instruction: KIND_LABEL[kind],
  };

  switch (kind) {
    // -------------------------------------------------------------------------
    // Active Recall
    // -------------------------------------------------------------------------

    case "active_recall":
    case "meaning_to_term":
      return {
        ...base,
        prompt: card.meaning,
        note: "Recupera dalla memoria la parola inglese corrispondente.",
        answers: [card.term],
        solution: card.term,
      };

    case "definition_to_term":
      return {
        ...base,
        prompt: card.definition ?? card.meaning,
        note: "Leggi la definizione e identifica il termine inglese.",
        answers: [card.term],
        solution: card.term,
      };

    case "term_to_meaning":
      return {
        ...base,
        prompt: card.term,
        note: "Scrivi il significato italiano della parola.",
        answers: [card.meaning],
        solution: card.meaning,
      };

    // -------------------------------------------------------------------------
    // Spaced Repetition
    // -------------------------------------------------------------------------

    case "spaced_repetition": {
      const intervals = [1, 3, 7, 14, 30];

      const currentLevel = Math.min(
        Math.max(0, card.repetitions),
        intervals.length - 1,
      );

      return {
        ...base,
        prompt: card.term,
        note:
          `Livello SRS: ${currentLevel + 1} di ${intervals.length}. ` +
          `Intervallo previsto: ${intervals[currentLevel]} giorni. ` +
          "Dopo aver risposto, valuta autonomamente quanto ricordavi.",
        answers: [card.meaning],
        solution: card.meaning,
        selfGraded: true,
      };
    }

    // -------------------------------------------------------------------------
    // Retrieval Practice
    // -------------------------------------------------------------------------

    case "retrieval_practice":
      return {
        ...base,
        prompt:
          `Scrivi tutto ciò che ricordi sulla parola "${card.term}".`,
        note:
          "Non consultare gli appunti e non cercare suggerimenti. " +
          "La soluzione verrà mostrata al termine della sessione.",
        answers: [card.term, card.meaning],
        solution:
          `Termine: ${card.term}\n` +
          `Significato: ${card.meaning}\n` +
          `Definizione: ${card.definition ?? card.meaning}`,
      };

    // -------------------------------------------------------------------------
    // Collocations
    // -------------------------------------------------------------------------

    case "collocations":
    case "collocation_gap":
    case "collocation_choice": {
      const available = collocationsWithTerm(card);
      const collocation = pick(available, rng);

      if (!collocation) {
        return {
          ...base,
          prompt: card.term,
          note:
            "Questa scheda non contiene collocations utilizzabili. " +
            "Passa a un'altra scheda.",
          answers: [],
          solution: "",
        };
      }

      const split = splitAround(collocation, card.term);

      if (!split) {
        return {
          ...base,
          prompt: collocation,
          answers: [collocation],
          solution: collocation,
        };
      }

      if (kind === "collocation_choice") {
        const choices = shuffle(
          uniqueStrings([
            card.term,
            ...getDistractors(card, pool, rng),
          ]),
          rng,
        );

        return {
          ...base,
          prompt: `${split.before}_____ ${split.after}`.trim(),
          gap: {
            before: split.before,
            after: split.after,
          },
          choices,
          subMode: "match",
          answers: [card.term],
          solution: collocation,
          note: "Scegli la parola che completa correttamente l'espressione.",
        };
      }

      return {
        ...base,
        prompt: collocation,
        gap: {
          before: split.before,
          after: split.after,
        },
        subMode: "gap",
        answers: [card.term],
        solution: collocation,
        note: "Completa l'espressione con la parola mancante.",
      };
    }

    // -------------------------------------------------------------------------
    // Contextual Learning
    // -------------------------------------------------------------------------

    case "contextual_learning": {
      const example = card.example ?? card.term;

      const highlighted = splitAround(example, card.term);

      return {
        ...base,
        prompt: example,
        highlight: highlighted
          ? {
              before: highlighted.before,
              word: highlighted.match,
              after: highlighted.after,
            }
          : undefined,
        registerOptions: ["Formale", "Informale", "Neutro"],
        note:
          "1. Deduce il significato dal contesto.\n" +
          "2. Identifica il registro linguistico.\n" +
          "3. Scrivi una nuova frase utilizzando la parola.",
        answers: [card.term, card.meaning],
        solution:
          `Parola: ${card.term}\n` +
          `Significato: ${card.meaning}`,
        selfGraded: true,
      };
    }

    // -------------------------------------------------------------------------
    // Translation Practice
    // -------------------------------------------------------------------------

    case "translation_practice": {
      const isItalianToEnglish = rng() >= 0.5;

      return {
        ...base,
        prompt: isItalianToEnglish
          ? `Traduci in inglese: "${card.meaning}"`
          : `Traduci in italiano: "${card.term}"`,
        note:
          "Presta attenzione al significato e alla naturalezza " +
          "della traduzione, non soltanto alla corrispondenza letterale.",
        answers: isItalianToEnglish
          ? [card.term]
          : [card.meaning],
        solution: isItalianToEnglish
          ? card.term
          : card.meaning,
      };
    }

    // -------------------------------------------------------------------------
    // Sentence Creation
    // -------------------------------------------------------------------------

    case "sentence_creation":
      return {
        ...base,
        prompt: `Utilizza la parola "${card.term}" in una frase originale.`,
        note:
          `Significato: ${card.meaning}\n` +
          "Scrivi una frase completa in inglese. " +
          "La valutazione deve considerare grammatica, significato " +
          "e naturalezza, non la semplice corrispondenza letterale.",
        answers: [card.term],
        solution:
          card.example ?? `Esempio con la parola ${card.term}.`,
        selfGraded: true,
      };

    // -------------------------------------------------------------------------
    // Synonyms & Paraphrasing
    // -------------------------------------------------------------------------

    case "synonyms_paraphrasing":
    case "synonym_of":
      return {
        ...base,
        prompt: `Trova un sinonimo di "${card.term}".`,
        note:
          "Utilizza esclusivamente i sinonimi presenti nella tua scheda.",
        answers: [...card.synonyms],
        solution:
          card.synonyms.join(" · ") || "Nessun sinonimo registrato.",
      };

    case "term_from_synonym": {
      const synonym = pick(card.synonyms, rng);

      return {
        ...base,
        prompt: synonym
          ? `Quale parola della tua scheda corrisponde a "${synonym}"?`
          : card.term,
        answers: [card.term],
        solution: card.term,
      };
    }

    case "swap_in_sentence": {
      const example = card.example ?? "";
      const highlighted = splitAround(example, card.term);

      return {
        ...base,
        prompt: example || `Utilizza "${card.term}" in una frase.`,
        highlight: highlighted
          ? {
              before: highlighted.before,
              word: highlighted.match,
              after: highlighted.after,
            }
          : undefined,
        note:
          "Riscrivi la frase sostituendo la parola evidenziata " +
          "con uno dei sinonimi registrati nella scheda.",
        answers: [...card.synonyms],
        solution:
          card.synonyms.join(" · ") || card.term,
        selfGraded: true,
      };
    }

    // -------------------------------------------------------------------------
    // Cloze
    // -------------------------------------------------------------------------

    case "cloze": {
      const clozeText = card.cloze ?? card.example ?? "";

      const highlighted = splitAround(clozeText, card.term);

      return {
        ...base,
        prompt: clozeText,
        gap: highlighted
          ? {
              before: highlighted.before,
              after: highlighted.after,
            }
          : undefined,
        answers: [card.term],
        solution: clozeText || card.term,
      };
    }

    // -------------------------------------------------------------------------
    // Speaking Challenge
    // -------------------------------------------------------------------------

    case "speaking_challenge": {
      const additionalWords = uniqueStrings(
        pool
          .filter((item) => item.id !== card.id)
          .map((item) => item.term),
      );

      const speakingWords = [
        card.term,
        ...shuffle(additionalWords, rng).slice(0, 3),
      ];

      return {
        ...base,
        prompt: "Parla liberamente utilizzando le parole assegnate.",
        timerSeconds: 90,
        speakingWords,
        note:
          "Parla per 90 secondi. Cerca di utilizzare tutte le parole " +
          "in modo corretto e naturale. Al termine indica quali hai usato.",
        answers: speakingWords,
        solution: speakingWords.join(", "),
        selfGraded: true,
      };
    }

    // -------------------------------------------------------------------------
    // Error-Based Learning
    // -------------------------------------------------------------------------

    case "error_based_learning":
      return {
        ...base,
        prompt: `Recupera dalla memoria il significato di "${card.term}".`,
        note:
          `Questa scheda presenta ${card.incorrect_count} errori registrati. ` +
          "Rispondi senza suggerimenti e verifica se hai superato la difficoltà.",
        answers: [card.term],
        solution:
          `${card.term}: ${card.meaning}\n` +
          `${card.definition ?? ""}`,
      };

    // -------------------------------------------------------------------------
    // Default
    // -------------------------------------------------------------------------

    default:
      return {
        ...base,
        kind: "meaning_to_term",
        instruction: KIND_LABEL.meaning_to_term,
        prompt: card.meaning,
        answers: [card.term],
        solution: card.term,
      };
  }
}

// -----------------------------------------------------------------------------
// Next exercise
// -----------------------------------------------------------------------------

export function nextExercise(
  card: PracticeCard,
  methodType: string,
  pool: readonly PracticeCard[],
  _attempt: number,
  rng: Rng = Math.random,
  previous?: ExerciseKind,
): Exercise {
  let availableKinds = kindsFor(card, methodType, pool);

  if (availableKinds.length === 0) {
    availableKinds = ["meaning_to_term"];
  }

  const alternatives =
    availableKinds.length > 1 && previous
      ? availableKinds.filter((kind) => kind !== previous)
      : availableKinds;

  const selectedKind =
    pick(alternatives, rng) ?? "meaning_to_term";

  return buildExercise(card, selectedKind, pool, rng);
}
