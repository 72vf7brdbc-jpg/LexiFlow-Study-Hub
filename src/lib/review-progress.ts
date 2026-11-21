import { toLocalDateString } from "./streak";

export type StudyActivity = { created_at: string; correct: boolean; xp: number; kind: "vocabulary" | "grammar" };
export const PROGRESS_DAYS = 14;
export function progressStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (PROGRESS_DAYS - 1));
}
export function reviewProgress(activities: readonly StudyActivity[], now: Date = new Date()) {
  const start = progressStart(now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = Array.from({ length: PROGRESS_DAYS }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date: toLocalDateString(date), answers: 0, correct: 0, xp: 0, vocabulary: 0, grammar: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const activity of activities) {
    const date = new Date(activity.created_at);
    if (date < start || date >= end || !Number.isFinite(date.getTime())) continue;
    const day = byDate.get(toLocalDateString(date));
    if (!day) continue;
    day.answers++; day.correct += Number(activity.correct); day.xp += activity.xp;
    if (activity.kind === "grammar") day.grammar++;
    else day.vocabulary++;
  }
  const answers = days.reduce((sum, day) => sum + day.answers, 0);
  const correct = days.reduce((sum, day) => sum + day.correct, 0);
  return { days, answers, correct, xp: days.reduce((sum, day) => sum + day.xp, 0), activeDays: days.filter((day) => day.answers > 0).length, accuracy: answers ? Math.round(correct / answers * 100) : null };
}