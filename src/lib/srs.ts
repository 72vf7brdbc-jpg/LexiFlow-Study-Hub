// Spaced repetition scheduler (SM-2 inspired).
// Correct answers grow the interval (1 day, 3 days, then interval × ease);
// wrong answers reset the card, lower its ease and bring it back in 10 minutes.

export type SrsState = {
  repetitions: number;
  ease: number;
  interval_days: number;
};

export type SrsResult = SrsState & { due_at: Date };

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const RELEARN_MINUTES = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduleCard(state: SrsState, correct: boolean, now: Date = new Date()): SrsResult {
  if (!correct) {
    const ease = Math.max(MIN_EASE, round(state.ease - 0.2));
    return {
      repetitions: 0,
      ease,
      interval_days: 0,
      due_at: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000),
    };
  }

  const repetitions = state.repetitions + 1;
  const ease = Math.min(MAX_EASE, round(state.ease + 0.1));
  let interval: number;
  if (repetitions === 1) interval = 1;
  else if (repetitions === 2) interval = 3;
  else interval = round(Math.max(state.interval_days, 1) * ease);

  return {
    repetitions,
    ease,
    interval_days: interval,
    due_at: new Date(now.getTime() + interval * DAY_MS),
  };
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
