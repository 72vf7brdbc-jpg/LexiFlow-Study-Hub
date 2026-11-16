// Error-Based Learning: the notebook of wrong answers.
// A wrong answer in any method opens (or reopens) an entry for the word.
// In Error-Based sessions the word is asked again with a different exercise;
// once answered correctly it waits a few days, then a final check decides
// whether the error is overcome.

export const MISTAKE_CHECK_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MistakeState = {
  wrong_count: number;
  check_after: string | null;
  resolved_at: string | null;
};

/** practice = da riallenare, waiting = in attesa di verifica, check = da verificare oggi, resolved = superato */
export type MistakePhase = "practice" | "waiting" | "check" | "resolved";

export function mistakePhase(m: Pick<MistakeState, "check_after" | "resolved_at">, now: Date = new Date()): MistakePhase {
  if (m.resolved_at) return "resolved";
  if (!m.check_after) return "practice";
  return new Date(m.check_after).getTime() <= now.getTime() ? "check" : "waiting";
}

export type MistakeUpdate = { wrong_count: number; check_after: string | null; resolved_at: string | null };

/** New state of an entry after an Error-Based answer. */
export function mistakeAfterAnswer(m: MistakeState, correct: boolean, now: Date = new Date()): MistakeUpdate {
  if (!correct) return { wrong_count: m.wrong_count + 1, check_after: null, resolved_at: null };
  const phase = mistakePhase(m, now);
  if (phase === "check") return { wrong_count: m.wrong_count, check_after: m.check_after, resolved_at: now.toISOString() };
  if (phase === "practice") {
    return { wrong_count: m.wrong_count, check_after: new Date(now.getTime() + MISTAKE_CHECK_DAYS * DAY_MS).toISOString(), resolved_at: null };
  }
  return { wrong_count: m.wrong_count, check_after: m.check_after, resolved_at: m.resolved_at };
}

/** Entries that belong in an Error-Based session right now. */
export function isMistakeActive(m: Pick<MistakeState, "check_after" | "resolved_at">, now: Date = new Date()): boolean {
  const p = mistakePhase(m, now);
  return p === "practice" || p === "check";
}
