import { describe, expect, it } from "vitest";
import { progressStart, reviewProgress, type StudyActivity } from "@/lib/review-progress";
import { toLocalDateString } from "@/lib/streak";

const now = new Date(2026, 10, 21, 12);
const activity = (date: Date, correct = true, kind: StudyActivity["kind"] = "vocabulary", xp = 10): StudyActivity => ({ created_at: date.toISOString(), correct, kind, xp });
describe("14-day review progress", () => {
  it("includes today and the previous 13 local days, excludes older or future answers", () => {
    const start = progressStart(now);
    expect(toLocalDateString(start)).toBe("2026-11-08");
    const report = reviewProgress([activity(start), activity(new Date(2026, 10, 7, 23, 59)), activity(now), activity(new Date(2026, 10, 22))], now);
    expect(report.days).toHaveLength(14);
    expect(report.days[0]?.date).toBe("2026-11-08");
    expect(report.days[13]?.date).toBe("2026-11-21");
    expect(report.answers).toBe(2);
    expect(report.activeDays).toBe(2);
  });
  it("counts grammar and vocabulary results together but only adds actually earned XP", () => {
    const report = reviewProgress([activity(now, true, "vocabulary", 15), activity(now, false, "vocabulary", 2), activity(now, true, "grammar", 0)], now);
    expect(report.answers).toBe(3);
    expect(report.correct).toBe(2);
    expect(report.accuracy).toBe(67);
    expect(report.xp).toBe(17);
    expect(report.days[13]).toMatchObject({ vocabulary: 2, grammar: 1, answers: 3, correct: 2 });
  });
  it("does not invent accuracy or study days without saved answers", () => {
    const report = reviewProgress([], now);
    expect(report.accuracy).toBeNull();
    expect(report.activeDays).toBe(0);
    expect(report.xp).toBe(0);
  });
});