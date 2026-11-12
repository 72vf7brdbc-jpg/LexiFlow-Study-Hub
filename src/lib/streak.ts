// Streak and XP rules.
// The streak is personalised to the weekly frequency chosen in onboarding:
// a learner who studies N days a week may skip up to ceil(7 / N) - 1 days
// between sessions without losing the streak.

export const XP_CORRECT = 10;
export const XP_VOICE_BONUS = 5;
export const XP_WRONG = 2;

export function xpForAnswer(correct: boolean, mode: "typed" | "voice"): number {
  if (!correct) return XP_WRONG;
  return XP_CORRECT + (mode === "voice" ? XP_VOICE_BONUS : 0);
}

/** Max number of calendar days allowed between two study days. */
export function maxGapDays(daysPerWeek: number): number {
  const d = Math.min(7, Math.max(1, Math.round(daysPerWeek || 7)));
  return Math.ceil(7 / d);
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86_400_000);
}

export type StreakInput = {
  streak: number;
  lastStudyDate: string | null;
  daysPerWeek: number;
};

/** Streak after studying on `today` (YYYY-MM-DD). */
export function nextStreak({ streak, lastStudyDate, daysPerWeek }: StreakInput, today: string): number {
  if (!lastStudyDate) return 1;
  const gap = daysBetween(lastStudyDate, today);
  if (gap <= 0) return Math.max(1, streak);
  if (gap <= maxGapDays(daysPerWeek)) return streak + 1;
  return 1;
}

/** Streak to display on `today` — 0 when the allowed gap has already passed. */
export function displayedStreak({ streak, lastStudyDate, daysPerWeek }: StreakInput, today: string): number {
  if (!lastStudyDate) return 0;
  const gap = daysBetween(lastStudyDate, today);
  return gap <= maxGapDays(daysPerWeek) ? streak : 0;
}

export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
