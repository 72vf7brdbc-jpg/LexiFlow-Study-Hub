// Spaced repetition scheduler.
// Every word has a level. Correct answers climb a fixed ladder of intervals
// (level 1 = 1 day, 2 = 3, 3 = 7, 4 = 14, 5 = 30 days), then keep growing with
// the card's ease. A wrong answer sends the word back to level 1 (1 day).

export type SrsState = {
  repetitions: number;
  ease: number;
  interval_days: number;
};

export type SrsResult = SrsState & { due_at: Date };

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const INTERVAL_LADDER = [1, 3, 7, 14, 30] as const;
export const MAX_INTERVAL_DAYS = 180;
/** Cards reviewed at least this many days apart count as learned ("Appreso"). */
export const MASTERED_INTERVAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleCard(state: SrsState, correct: boolean, now: Date = new Date()): SrsResult {
  if (!correct) {
    const ease = Math.max(MIN_EASE, round(state.ease - 0.2));
    return {
      repetitions: 1,
      ease,
      interval_days: INTERVAL_LADDER[0],
      due_at: new Date(now.getTime() + INTERVAL_LADDER[0] * DAY_MS),
    };
  }

  const repetitions = state.repetitions + 1;
  const ease = Math.min(MAX_EASE, round(state.ease + 0.1));
  const ladder = INTERVAL_LADDER[repetitions - 1];
  const interval = ladder ?? Math.min(MAX_INTERVAL_DAYS, round(Math.max(state.interval_days, 30) * ease));

  return {
    repetitions,
    ease,
    interval_days: interval,
    due_at: new Date(now.getTime() + interval * DAY_MS),
  };
}

/**
 * Schedule change after an answer in any review method.
 * A wrong answer always resets the word to level 1; a correct answer moves it up
 * only when the word was due, so extra practice never skips a level.
 * Returns null when the schedule stays as it is.
 */
export function reviewSchedule(state: SrsState, correct: boolean, isDue: boolean, now: Date = new Date()): SrsResult | null {
  if (!correct) return scheduleCard(state, false, now);
  if (!isDue) return null;
  return scheduleCard(state, true, now);
}

export const MAX_LEVEL = INTERVAL_LADDER.length;

/** Level 0 = new word, 1..5 = rung of the 1/3/7/14/30-day ladder. */
export function levelOf(card: { repetitions: number }): number {
  return Math.max(0, Math.min(MAX_LEVEL, card.repetitions));
}

/** Days until the next review if the answer at this level is correct. */
export function nextIntervalForLevel(level: number): number {
  return INTERVAL_LADDER[Math.min(MAX_LEVEL, Math.max(1, level + 1)) - 1] ?? 30;
}

export type LearningStatus = "learning" | "consolidating" | "mastered";

export const LEARNING_STATUS_LABEL: Record<LearningStatus, string> = {
  learning: "Da imparare",
  consolidating: "In consolidamento",
  mastered: "Appreso",
};

export function learningStatus(card: { repetitions: number; interval_days: number }): LearningStatus {
  if (card.interval_days >= MASTERED_INTERVAL_DAYS) return "mastered";
  if (card.repetitions <= 1) return "learning";
  return "consolidating";
}

/** Schedule produced when the learner marks a word by hand. */
export function applyManualStatus(status: LearningStatus, now: Date = new Date()): Omit<SrsResult, "ease"> {
  if (status === "learning") return { repetitions: 0, interval_days: 0, due_at: now };
  if (status === "consolidating") return { repetitions: 2, interval_days: 3, due_at: new Date(now.getTime() + 3 * DAY_MS) };
  return { repetitions: 5, interval_days: 30, due_at: new Date(now.getTime() + 30 * DAY_MS) };
}

export type MasteryLevel = "new" | "learning" | "review" | "mastered";

export function masteryOf(card: { repetitions: number; interval_days: number; correct_count: number; incorrect_count: number }): MasteryLevel {
  if (card.correct_count + card.incorrect_count === 0) return "new";
  if (card.interval_days >= 21) return "mastered";
  if (card.repetitions >= 2) return "review";
  return "learning";
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
