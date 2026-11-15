// Dynamic study plan: session size depends on the CEFR level and on how many
// days a week the learner studies (fewer days → bigger sessions).

const BASE_BY_LEVEL: Record<string, number> = { A1: 10, A2: 12, B1: 15, B2: 18, C1: 20, C2: 22 };

export function sessionSize(level: string | null | undefined, daysPerWeek: number | null | undefined): number {
  const base = BASE_BY_LEVEL[level ?? "B1"] ?? 15;
  const days = Math.min(7, Math.max(1, daysPerWeek ?? 5));
  const size = Math.round(base * Math.sqrt(7 / days));
  return Math.min(40, Math.max(8, size));
}

export function dailyXpGoal(level: string | null | undefined, daysPerWeek: number | null | undefined): number {
  return sessionSize(level, daysPerWeek) * 10;
}

export function weeklyMinutes(level: string | null | undefined, daysPerWeek: number | null | undefined): number {
  // ~40 seconds per card
  const days = Math.min(7, Math.max(1, daysPerWeek ?? 5));
  return Math.round((sessionSize(level, days) * 40 * days) / 60);
}
