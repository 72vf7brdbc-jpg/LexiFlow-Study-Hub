// The ten review methods of the Ripasso section, grouped in four categories.
// Each method has its own exercise type; this file holds their descriptions
// and the rules that decide which of the learner's words each method can use.

import { isMistakeActive, type MistakeState } from "./mistakes";
import { shuffle, splitAround, type PracticeCard } from "./practice";

export type MethodId =
  | "active_recall"
  | "spaced_repetition"
  | "retrieval_practice"
  | "collocations"
  | "contextual_learning"
  | "translation_practice"
  | "sentence_creation"
  | "synonyms_paraphrasing"
  | "speaking_challenge"
  | "error_based";

export type CategoryId = "memorizzazione" | "vocabolario" | "produzione" | "consolidamento";

export const CATEGORIES: { id: CategoryId; label: string; hint: string }[] = [
  { id: "memorizzazione", label: "Memorizzazione", hint: "Fissa le parole nella memoria a lungo termine" },
  { id: "vocabolario", label: "Vocabolario", hint: "Usa le parole nel modo in cui le userebbe un madrelingua" },
  { id: "produzione", label: "Produzione", hint: "Scrivi e parla con parole tue" },
  { id: "consolidamento", label: "Consolidamento", hint: "Trasforma gli errori in punti di forza" },
];

export type MethodInfo = {
  id: MethodId;
  category: CategoryId;
  name: string;
  tagline: string;
  /** Short explanation shown before starting. */
  intro: string;
  steps: string[];
  /** Words used in one session. */
  size: number;
  /** Fewest words needed to start. */
  min: number;
  needs: string;
  ai?: boolean;
};

export const METHODS: MethodInfo[] = [
  {
    id: "active_recall",
    category: "memorizzazione",
    name: "Active Recall",
    tagline: "Scrivi la risposta a memoria, senza opzioni",
    intro:
      "Richiamare un'informazione dalla memoria la rafforza molto più che rileggerla. Vedi il significato in italiano oppure la parola inglese e scrivi tu la risposta: nessuna scelta multipla, nessun aiuto.",
    steps: ["Leggi il significato o la parola", "Scrivi la risposta (anche a voce)", "Ricevi subito la correzione"],
    size: 10,
    min: 1,
    needs: "Carica almeno una lezione.",
  },
  {
    id: "spaced_repetition",
    category: "memorizzazione",
    name: "Spaced Repetition",
    tagline: "Solo le parole in scadenza oggi, livello per livello",
    intro:
      "Ogni parola ha un livello da 1 a 5: se la ricordi sale e torna dopo 1, 3, 7, 14 e poi 30 giorni. Se sbagli, riparte dal livello 1. Oggi vedi solo le parole che scadono oggi.",
    steps: ["Pensa alla risposta", "Gira la scheda", "Dì onestamente se la sapevi"],
    size: 40,
    min: 1,
    needs: "Nessuna parola scade oggi: torna domani.",
  },
  {
    id: "retrieval_practice",
    category: "memorizzazione",
    name: "Retrieval Practice",
    tagline: "Domande aperte, le risposte solo alla fine",
    intro:
      "Una piccola verifica come a scuola: domande aperte una dopo l'altra, senza suggerimenti e senza poter rileggere gli appunti. Le risposte corrette compaiono solo alla fine.",
    steps: ["Rispondi a tutte le domande", "Nessun aiuto durante la prova", "Alla fine confronta con le soluzioni"],
    size: 8,
    min: 3,
    needs: "Servono almeno 3 parole salvate.",
  },
  {
    id: "collocations",
    category: "vocabolario",
    name: "Collocations",
    tagline: "Abbina, completa, rimetti in ordine",
    intro:
      "Le parole vivono in combinazioni fisse (make a decision, heavy rain). Allenati su tre esercizi: abbinare le parti di un'espressione, completare la parola mancante e rimettere in ordine parole mescolate.",
    steps: ["Abbina le coppie", "Completa l'espressione", "Riordina le parole"],
    size: 8,
    min: 2,
    needs: "Servono almeno 2 parole con un'espressione o una frase d'esempio.",
  },
  {
    id: "contextual_learning",
    category: "vocabolario",
    name: "Contextual Learning",
    tagline: "Deduci il significato dalla frase",
    intro:
      "Leggi una frase con la parola, deduci che cosa significa dal contesto e indica se è formale, informale o neutra. Poi usala tu in un contesto diverso. L'AI controlla le tue deduzioni.",
    steps: ["Leggi la frase", "Scrivi il significato e scegli il registro", "Usa la parola in un'altra frase"],
    size: 4,
    min: 1,
    needs: "Servono parole con una frase d'esempio.",
    ai: true,
  },
  {
    id: "translation_practice",
    category: "vocabolario",
    name: "Translation Practice",
    tagline: "Italiano ↔ inglese, senza calchi",
    intro:
      "Traduci frasi delle tue lezioni dall'italiano all'inglese e viceversa. L'AI ti segnala quando la traduzione è troppo letterale e ti propone la forma più naturale.",
    steps: ["Leggi la frase", "Traducila", "Confronta con la versione naturale"],
    size: 6,
    min: 1,
    needs: "Servono parole con una frase d'esempio.",
    ai: true,
  },
  {
    id: "sentence_creation",
    category: "produzione",
    name: "Sentence Creation",
    tagline: "Una parola, una frase tutta tua",
    intro:
      "Ti mostro una parola e scrivi una frase originale in inglese che la contenga. L'AI valuta grammatica, significato e naturalezza: una frase corretta va bene anche se è diversa dagli esempi.",
    steps: ["Leggi la parola", "Scrivi la tua frase", "Leggi il feedback dell'AI"],
    size: 5,
    min: 1,
    needs: "Carica almeno una lezione.",
    ai: true,
  },
  {
    id: "synonyms_paraphrasing",
    category: "produzione",
    name: "Synonyms & Paraphrasing",
    tagline: "Dillo con altre parole",
    intro:
      "Esprimi lo stesso concetto in modo diverso: a volte ti chiedo un sinonimo, a volte di riscrivere una frase cambiando le parole ma non il significato. L'AI valuta la tua proposta.",
    steps: ["Leggi la richiesta", "Scrivi il sinonimo o la frase riscritta", "Leggi il feedback dell'AI"],
    size: 6,
    min: 1,
    needs: "Carica almeno una lezione.",
    ai: true,
  },
  {
    id: "speaking_challenge",
    category: "produzione",
    name: "Speaking Challenge",
    tagline: "Parla 1–2 minuti usando le parole chiave",
    intro:
      "Ricevi da 3 a 5 parole e un argomento preso dalle tue lezioni. Avvia il timer e parla ad alta voce per 1 o 2 minuti cercando di usarle tutte. Alla fine segni tu quali hai usato bene.",
    steps: ["Leggi parole e argomento", "Parla finché il timer scorre", "Segna le parole usate bene"],
    size: 5,
    min: 3,
    needs: "Servono almeno 3 parole salvate.",
  },
  {
    id: "error_based",
    category: "consolidamento",
    name: "Error-Based Learning",
    tagline: "I tuoi errori, con esercizi diversi",
    intro:
      "Ogni risposta sbagliata, in qualsiasi metodo, finisce qui. Te la ripropongo con un esercizio diverso da quello in cui hai sbagliato; quando rispondi bene, dopo 3 giorni la verifico di nuovo per capire se l'errore è davvero superato.",
    steps: ["Riprova le parole sbagliate", "Con un tipo di esercizio diverso", "Dopo qualche giorno, la verifica finale"],
    size: 12,
    min: 1,
    needs: "Nessun errore da ripassare: ottimo lavoro!",
  },
];

export function methodInfo(id: MethodId): MethodInfo {
  return METHODS.find((m) => m.id === id) ?? METHODS[0]!;
}

export function isMethodId(v: unknown): v is MethodId {
  return typeof v === "string" && METHODS.some((m) => m.id === v);
}

export function hasExampleWithTerm(c: Pick<PracticeCard, "example" | "term">): boolean {
  return !!c.example && !!splitAround(c.example, c.term);
}

export function hasCollocationMaterial(c: Pick<PracticeCard, "example" | "term" | "collocations">): boolean {
  return c.collocations.some((x) => splitAround(x, c.term)) || hasExampleWithTerm(c);
}

export type OpenMistake = MistakeState & { id: string; card_id: string; method: string; answer: string | null; last_wrong_at: string };

/** Words a method can use right now. */
export function poolFor<T extends PracticeCard>(
  method: MethodId,
  cards: readonly T[],
  opts: { now?: Date; dayEnd?: Date; mistakes?: readonly OpenMistake[] } = {},
): T[] {
  const now = opts.now ?? new Date();
  const dayEnd = opts.dayEnd ?? endOfLocalDay(now);
  switch (method) {
    case "spaced_repetition":
      return cards.filter((c) => new Date(c.due_at).getTime() <= dayEnd.getTime());
    case "contextual_learning":
    case "translation_practice":
      return cards.filter(hasExampleWithTerm);
    case "collocations":
      return cards.filter(hasCollocationMaterial);
    case "error_based": {
      const active = new Set((opts.mistakes ?? []).filter((m) => isMistakeActive(m, now)).map((m) => m.card_id));
      return cards.filter((c) => active.has(c.id));
    }
    default:
      return [...cards];
  }
}

/** Picks the words for a session: due and difficult first, then a fresh order. */
export function pickSession<T extends PracticeCard>(method: MethodId, pool: readonly T[], rng: () => number = Math.random): T[] {
  const info = methodInfo(method);
  const now = Date.now();
  const scored = pool.map((c) => ({
    c,
    s: (new Date(c.due_at).getTime() <= now ? 2 : 0) + Math.min(3, c.incorrect_count) * 0.6 + rng() * 1.5,
  }));
  if (method === "spaced_repetition") scored.sort((a, b) => new Date(a.c.due_at).getTime() - new Date(b.c.due_at).getTime());
  else scored.sort((a, b) => b.s - a.s);
  const chosen = scored.slice(0, info.size).map((x) => x.c);
  return method === "spaced_repetition" ? chosen : shuffle(chosen, rng);
}

export function endOfLocalDay(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/** AI verdicts that count as a correct answer for the schedule: small slips still count. */
export function coachCountsAsCorrect(verdict: "correct" | "almost" | "wrong"): boolean {
  return verdict !== "wrong";
}

/** Speaking Challenge length options, in seconds. */
export const SPEAKING_DURATIONS = [60, 120] as const;
