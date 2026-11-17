// Exercise builder for the Ripasso section.
// Every exercise is built only from fields of the learner's own cards, which the
// AI extracted from uploaded lessons: no outside words, synonyms or collocations.

import { learningStatus } from "./srs";

export type Focus = "due" | "wrong" | "unlearned" | "mixed";

export type PracticeCategory = "Memorizzazione" | "Vocabolario" | "Produzione" | "Consolidamento";

export interface PracticeMethod {
  id: number;
  name: string;
  category: PracticeCategory;
  description: string;
  type: string;
}

export const PRACTICE_CATEGORIES: Record<PracticeCategory, { title: string; methods: PracticeMethod[] }> = {
  Memorizzazione: {
    title: "Memorizzazione",
    methods: [
      {
        id: 1,
        name: "Active Recall",
        category: "Memorizzazione",
        description: "Mostra la definizione in italiano o la parola inglese. Scrivi la risposta senza opzioni per testare il recupero attivo dalla memoria.",
        type: "active_recall",
      },
      {
        id: 2,
        name: "Spaced Repetition",
        category: "Memorizzazione",
        description: "Ripasso basato su livelli con intervalli di 1, 3, 7, 14 e 30 giorni. Se sbagli, la parola torna al livello 1. Vengono mostrate solo le parole in scadenza oggi.",
        type: "spaced_repetition",
      },
      {
        id: 7,
        name: "Retrieval Practice",
        category: "Retrieval",
        description: "Domande aperte senza suggerimenti e senza rileggere gli appunti. Alla fine vengono mostrate le risposte corrette per la verifica.",
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
        description: "Esercizi mirati a scelta tra abbinare parole, completare l'espressione mancante o rimettere in ordine parole mescolate.",
        type: "collocations",
      },
      {
        id: 8,
        name: "Contextual Learning",
        category: "Vocabolario",
        description: "Analizza la frase con la parola nuova: deduci il significato dal contesto, indica il registro (formale, informale, neutro) e riusa la parola in un nuovo contesto.",
        type: "contextual_learning",
      },
      {
        id: 10,
        name: "Translation Practice",
        category: "Vocabolario",
        description: "Frasi di traduzione IT→EN e EN→IT. Il sistema evidenza le traduzioni troppo letterali e propone la forma più naturale.",
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
        description: "Partendo da una parola, scrivi una frase originale in inglese. L'IA valuta grammatica, significato e naturalezza fornendo feedback.",
        type: "sentence_creation",
      },
      {
        id: 5,
        name: "Synonyms & Paraphrasing",
        category: "Produzione",
        description: "Esercitati a trovare sinonimi o a riscrivere una frase data utilizzando parole diverse mantenendo lo stesso significato.",
        type: "synonyms_paraphrasing",
      },
      {
        id: 6,
        name: "Speaking Challenge",
        category: "Produzione",
        description: "Mostra 3-5 parole e un argomento con un timer di 1-2 minuti. Alla fine effettui l'autovalutazione indicando quali parole hai usato correttamente.",
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
        description: "Raccoglie le risposte sbagliate da tutti i metodi precedenti e le ripropone con formati di esercizi differenti per verificarne il superamento.",
        type: "error_based_learning",
      },
    ],
  },
};

export const FOCUS_OPTIONS: { id: Focus; label: string; hint: string }[] = [
  { id: "due", label: "Da ripassare oggi", hint: "Le schede in scadenza secondo il calendario (Intervalli SRS)" },
  { id: "wrong", label: "Solo gli errori", hint: "Le parole che hai sbagliato (Error-Based Learning)" },
  { id: "unlearned", label: "Non ancora apprese", hint: "Tutto ciò che non è ancora completato" },
  { id: "mixed", label: "Sessione mista", hint: "Un mix di esercizi da tutte le categorie" },
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

export const KIND_LABEL: Record<ExerciseKind, string> = {
  active_recall: "Active Recall",
  spaced_repetition: "Spaced Repetition (SRS)",
  collocations: "Collocations & Expressions",
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
  collocation_choice: "Scegli la parola giusta",
  synonym_of: "Scrivi un sinonimo",
  term_from_synonym: "Parola corrispondente al sinonimo",
  swap_in_sentence: "Sostituisci con espressione equivalente",
};

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

export function kindsFor(card: PracticeCard, methodType: string, pool: readonly PracticeCard[] = []): ExerciseKind[] {
  const out = new Set<ExerciseKind>();
  const hasColl = collocationsWithTerm(card).length > 0;

  switch (methodType) {
    case "active_recall":
      out.add("active_recall");
      if (card.definition) out.add("definition_to_term");
      out.add("meaning_to_term");
      break;
    case "spaced_repetition":
      out.add("spaced_repetition");
      out.add("term_to_meaning");
      break;
    case "collocations":
      if (hasColl) out.add("collocation_gap");
      if (hasColl && pool.filter((p) => p.id !== card.id).length >= 2) out.add("collocation_choice");
      out.add("collocations");
      break;
    case "sentence_creation":
      out.add("sentence_creation");
      break;
    case "synonyms_paraphrasing":
      if (card.synonyms.length > 0) {
        out.add("synonym_of");
        out.add("swap_in_sentence");
      }
      out.add("synonyms_paraphrasing");
      break;
    case "speaking_challenge":
      out.add("speaking_challenge");
      break;
    case "retrieval_practice":
      out.add("retrieval_practice");
      break;
    case "contextual_learning":
      out.add("contextual_learning");
      break;
    case "error_based_learning":
      out.add("error_based_learning");
      break;
    case "translation_practice":
      out.add("translation_practice");
      break;
    default:
      out.add("meaning_to_term");
      break;
  }

  return [...out];
}

export type Exercise = {
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
};

export function buildExercise(card: PracticeCard, kind: ExerciseKind, pool: readonly PracticeCard[] = [], rng: Rng = Math.random): Exercise {
  const base = { kind, cardId: card.id, instruction: KIND_LABEL[kind] || "Esercizio" };
  switch (kind) {
    case "active_recall":
      return {
        ...base,
        prompt: card.definition ?? card.meaning,
        note: "Scrivi la risposta corretta senza opzioni di supporto.",
        answers: [card.term],
        solution: card.term,
      };
    case "spaced_repetition": {
      const intervals = [1, 3, 7, 14, 30];
      const currentLevel = card.repetitions < intervals.length ? card.repetitions : intervals.length - 1;
      return {
        ...base,
        prompt: card.term,
        note: `Livello SRS attuale: ${currentLevel + 1} (Intervallo: ${intervals[currentLevel]} giorni). Se sbagli, tornerai al livello 1.`,
        answers: [card.meaning],
        solution: card.meaning,
        selfGraded: true,
      };
    }
    case "retrieval_practice":
      return {
        ...base,
        prompt: `Domanda aperta (Retrieval): Spiega o scrivi tutto ciò che ricordi associato a: "${card.term}" (${card.meaning}).`,
        note: "Nessun suggerimento disponibile. Alla fine potrai confrontare la tua risposta.",
        answers: [card.term, card.meaning],
        solution: `Termine: ${card.term} | Definizione: ${card.definition ?? card.meaning}`,
      };
    case "collocations": {
      const modes = ["gap", "match", "unscramble"] as const;
      const chosenMode = modes[Math.floor(rng() * modes.length)] ?? "gap";
      const coll = pick(collocationsWithTerm(card), rng) ?? card.term;
      const split = splitAround(coll, card.term);
      
      let scrambled: string[] | undefined = undefined;
      if (chosenMode === "unscramble") {
        scrambled = shuffle(coll.split(/\s+/), rng);
      }

      return {
        ...base,
        prompt: coll,
        subMode: chosenMode,
        gap: split ? { before: split.before, after: split.after } : undefined,
        scrambledWords: scrambled,
        note: chosenMode === "match" ? "Abbina la parola corretta all'espressione." : chosenMode === "unscramble" ? "Rimetti in ordine le parole mescolate." : "Completa l'espressione mancante.",
        answers: [card.term],
        solution: coll,
      };
    }
    case "contextual_learning":
      return {
        ...base,
        prompt: card.example ?? `Contesto con la parola chiave: ${card.term}`,
        registerOptions: ["Formale", Informale, "Neutro"],
        note: "Deduci il significato dal contesto, seleziona il registro corretto e prova a usare la parola in un nuovo contesto.",
        answers: [card.term],
        solution: `Parola: ${card.term} - Significato: ${card.meaning}`,
      };
    case "translation_practice": {
      const isItToEn = rng() > 0.5;
      return {
        ...base,
        prompt: isItToEn ? `Traduci in inglese: "${card.meaning}"` : `Traduci in italiano: "${card.term}"`,
        note: "Evita traduzioni troppo letterali; l'IA valuterà la forma più naturale.",
        answers: isItToEn ? [card.term] : [card.meaning],
        solution: isItToEn ? card.term : card.meaning,
      };
    }
    case "sentence_creation":
      return {
        ...base,
        prompt: `Parola assegnata: "${card.term}"`,
        note: `Significato: ${card.meaning}. Scrivi una frase originale in inglese. L'IA valuterà grammatica e naturalezza.`,
        answers: [card.term],
        solution: card.example ?? `Esempio con ${card.term}`,
      };
    case "synonyms_paraphrasing":
      return {
        ...base,
        prompt: `Trova sinonimi o parafrasa la frase per: "${card.term}"`,
        note: `Sinonimi registrati: ${card.synonyms.join(", ") || "Nessuno"}`,
        answers: card.synonyms.length > 0 ? [...card.synonyms] : [card.term],
        solution: card.synonyms.join(" · ") || card.term,
      };
    case "speaking_challenge": {
      const randomWords = shuffle(pool.map((p) => p.term), rng).slice(0, 4);
      return {
        ...base,
        prompt: `Argomento di discussione libera`,
        timerSeconds: 90, // 1 minuto e mezzo
        speakingWords: [card.term, ...randomWords.slice(0, 3)],
        note: "Parla ad alta voce usando le parole chiave fornite per 1-2 minuti. Alla fine fai l'autovalutazione.",
        answers: [card.term],
        solution: "Autovalutazione completata",
      };
    }
    case "error_based_learning":
      return {
        ...base,
        prompt: `Recupero errore passato: "${card.term}" (${card.meaning})`,
        note: "Questa parola è stata precedentemente sbagliata. Dimostra di averla superata.",
        answers: [card.term],
        solution: card.term,
      };
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

export function nextExercise(card: PracticeCard, methodType: string, pool: readonly PracticeCard[], attempt: number, rng: Rng = Math.random, previous?: ExerciseKind): Exercise {
  let kinds = kindsFor(card, methodType, pool);
  if (kinds.length === 0) kinds = ["meaning_to_term"];
  const options = kinds.length > 1 && previous ? kinds.filter((k) => k !== previous) : kinds;
  return buildExercise(card, pick(options, rng) ?? "meaning_to_term", pool, rng);
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
