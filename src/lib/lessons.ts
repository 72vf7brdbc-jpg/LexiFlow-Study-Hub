// Lesson calendar and homework rules shared by Oggi, Ripasso and Archivio.

import { toLocalDateString, daysBetween } from "./streak";

/** Weekdays in Italian order (Monday first). `id` matches Date#getDay (0 = Sunday). */
export const WEEKDAYS = [
  { id: 1, short: "Lun", name: "lunedì" },
  { id: 2, short: "Mar", name: "martedì" },
  { id: 3, short: "Mer", name: "mercoledì" },
  { id: 4, short: "Gio", name: "giovedì" },
  { id: 5, short: "Ven", name: "venerdì" },
  { id: 6, short: "Sab", name: "sabato" },
  { id: 0, short: "Dom", name: "domenica" },
] as const;

export const ACTIVITIES = [
  { id: "speaking", label: "Speaking" },
  { id: "listening", label: "Listening" },
  { id: "reading", label: "Reading" },
  { id: "writing", label: "Writing" },
  { id: "grammar", label: "Grammar" },
] as const;
export type Activity = (typeof ACTIVITIES)[number]["id"];

export const TASK_STATUSES = [
  { id: "todo", label: "Da iniziare" },
  { id: "in_progress", label: "In corso" },
  { id: "done", label: "Completato" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];

export function taskStatusLabel(s: string): string {
  return TASK_STATUSES.find((t) => t.id === s)?.label ?? s;
}

export function isLessonDay(lessonDays: readonly number[] | null | undefined, date: Date = new Date()): boolean {
  return !!lessonDays?.includes(date.getDay());
}

/** Next scheduled lesson strictly after `from` (or including it when `includeToday`). */
export function nextLessonDate(
  lessonDays: readonly number[] | null | undefined,
  from: Date = new Date(),
  includeToday = false,
): Date | null {
  if (!lessonDays || lessonDays.length === 0) return null;
  for (let i = includeToday ? 0 : 1; i <= 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (lessonDays.includes(d.getDay())) return d;
  }
  return null;
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

/** Deadline state of a task on `today` (YYYY-MM-DD). "soon" = within 2 days. */
export function dueState(dueDate: string | null | undefined, today: string = toLocalDateString()): DueState {
  if (!dueDate) return "none";
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "later";
}

export function taskKey(description: string): string {
  return description.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Drops tasks whose description already exists in the lesson (or twice in the batch). */
export function withoutDuplicateTasks<T extends { description: string }>(existing: readonly string[], incoming: readonly T[]): T[] {
  const seen = new Set(existing.map(taskKey));
  const out: T[] = [];
  for (const t of incoming) {
    const k = taskKey(t.description);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Unfinished tasks first, by deadline (overdue first), then the most recently assigned. */
export function sortTasks<T extends { status: string; due_date: string | null; assigned_on: string; created_at: string }>(tasks: readonly T[]): T[] {
  const rank = (t: T) => (t.status === "done" ? 2 : t.status === "in_progress" ? 0 : 1);
  return [...tasks].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    const ad = a.due_date ?? "9999-12-31";
    const bd = b.due_date ?? "9999-12-31";
    if (ad !== bd) return ad.localeCompare(bd);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return b.created_at.localeCompare(a.created_at);
  });
}
