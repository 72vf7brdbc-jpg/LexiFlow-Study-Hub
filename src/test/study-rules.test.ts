import { describe, expect, it } from "vitest";

import { gradeAnswer } from "@/lib/grading";
import { sessionSize } from "@/lib/plan";
import { scheduleCard } from "@/lib/srs";
import { displayedStreak, maxGapDays, nextStreak, xpForAnswer } from "@/lib/streak";

const NOW = new Date("2026-11-12T10:00:00Z");
const DAY = 86_400_000;

describe("spaced repetition", () => {
  it("first correct answer schedules the card for tomorrow", () => {
    const r = scheduleCard({ repetitions: 0, ease: 2.5, interval_days: 0 }, true, NOW);
    expect(r.interval_days).toBe(1);
    expect(r.due_at.getTime() - NOW.getTime()).toBe(DAY);
  });

  it("second correct answer schedules the card in 3 days", () => {
    const r = scheduleCard({ repetitions: 1, ease: 2.6, interval_days: 1 }, true, NOW);
    expect(r.interval_days).toBe(3);
  });

  it("later correct answers multiply the interval by the ease", () => {
    const r = scheduleCard({ repetitions: 2, ease: 2.5, interval_days: 3 }, true, NOW);
    expect(r.interval_days).toBeCloseTo(3 * 2.6, 2);
  });

  it("a wrong answer resets the card and brings it back in 10 minutes", () => {
    const r = scheduleCard({ repetitions: 4, ease: 2.5, interval_days: 20 }, false, NOW);
    expect(r.repetitions).toBe(0);
    expect(r.ease).toBe(2.3);
    expect(r.due_at.getTime() - NOW.getTime()).toBe(10 * 60 * 1000);
  });

  it("ease never drops below 1.3", () => {
    const r = scheduleCard({ repetitions: 0, ease: 1.35, interval_days: 0 }, false, NOW);
    expect(r.ease).toBe(1.3);
  });
});

describe("streak and XP", () => {
  it("awards 10 XP for a typed correct answer, 15 for spoken, 2 for a mistake", () => {
    expect(xpForAnswer(true, "typed")).toBe(10);
    expect(xpForAnswer(true, "voice")).toBe(15);
    expect(xpForAnswer(false, "voice")).toBe(2);
  });

  it("daily learners must study on consecutive days", () => {
    expect(maxGapDays(7)).toBe(1);
    expect(nextStreak({ streak: 5, lastStudyDate: "2026-11-11", daysPerWeek: 7 }, "2026-11-12")).toBe(6);
    expect(nextStreak({ streak: 5, lastStudyDate: "2026-11-10", daysPerWeek: 7 }, "2026-11-12")).toBe(1);
  });

  it("a 3-days-a-week learner keeps the streak across 2 rest days", () => {
    expect(maxGapDays(3)).toBe(3);
    expect(nextStreak({ streak: 4, lastStudyDate: "2026-11-09", daysPerWeek: 3 }, "2026-11-12")).toBe(5);
    expect(nextStreak({ streak: 4, lastStudyDate: "2026-11-08", daysPerWeek: 3 }, "2026-11-12")).toBe(1);
  });

  it("studying twice on the same day does not grow the streak", () => {
    expect(nextStreak({ streak: 3, lastStudyDate: "2026-11-12", daysPerWeek: 5 }, "2026-11-12")).toBe(3);
  });

  it("shows 0 once the allowed gap has passed", () => {
    expect(displayedStreak({ streak: 9, lastStudyDate: "2026-11-01", daysPerWeek: 7 }, "2026-11-12")).toBe(0);
  });
});

describe("study plan", () => {
  it("sizes the session by level and weekly frequency", () => {
    expect(sessionSize("A1", 7)).toBe(10);
    expect(sessionSize("B2", 7)).toBe(18);
    expect(sessionSize("A1", 3)).toBe(15);
    expect(sessionSize("B2", 1)).toBe(40);
  });
});

describe("answer grading", () => {
  it("accepts exact answers ignoring case and punctuation", () => {
    expect(gradeAnswer("Reluctant!", "reluctant").correct).toBe(true);
  });
  it("tolerates one typo on longer words", () => {
    expect(gradeAnswer("reluctnt", "reluctant").correct).toBe(true);
  });
  it("rejects a different word", () => {
    expect(gradeAnswer("happy", "reluctant").correct).toBe(false);
  });
  it("accepts a spoken sentence that contains the answer", () => {
    expect(gradeAnswer("I think it's give up", "give up", "voice").correct).toBe(true);
  });
});
