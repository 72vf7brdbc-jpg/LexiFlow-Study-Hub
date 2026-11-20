import { describe, expect, it } from "vitest";

import { gradeAnswer } from "@/lib/grading";
import { sessionSize } from "@/lib/plan";
import { CEFR_LEVELS } from "@/lib/study-config";
import { scheduleCard } from "@/lib/srs";
import { displayedStreak, maxGapDays, nextStreak, xpForAnswer } from "@/lib/streak";

const NOW = new Date("2026-11-12T10:00:00Z");
const DAY = 86_400_000;

describe("available study levels", () => {
  it("includes C1 among selectable levels", () => {
    expect(CEFR_LEVELS.some((level) => level.id === "C1")).toBe(true);
  });
  it("includes C2 among selectable levels", () => {
    expect(CEFR_LEVELS.some((level) => level.id === "C2")).toBe(true);
  });
});

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

  it("third, fourth and fifth correct answers schedule 7, 14 and 30 days", () => {
    expect(scheduleCard({ repetitions: 2, ease: 2.5, interval_days: 3 }, true, NOW).interval_days).toBe(7);
    expect(scheduleCard({ repetitions: 3, ease: 2.5, interval_days: 7 }, true, NOW).interval_days).toBe(14);
    expect(scheduleCard({ repetitions: 4, ease: 2.5, interval_days: 14 }, true, NOW).interval_days).toBe(30);
  });

  it("a wrong answer sends the word back to level 1, due again in 1 day", () => {
    const r = scheduleCard({ repetitions: 4, ease: 2.5, interval_days: 20 }, false, NOW);
    expect(r.repetitions).toBe(1);
    expect(r.interval_days).toBe(1);
    expect(r.ease).toBe(2.3);
    expect(r.due_at.getTime() - NOW.getTime()).toBe(DAY);
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

import { CATEGORIES, METHODS, poolFor, SPEAKING_DURATIONS } from "@/lib/methods";
import { buildCollocationRounds, buildRecallItems, buildRetrievalQuestions, buildSynonymItems, buildTranslationItems, errorKindsFor, speakingWordCount } from "@/lib/method-exercises";
import { mistakeAfterAnswer, mistakePhase } from "@/lib/mistakes";
import { reviewSchedule } from "@/lib/srs";
import type { PracticeCard } from "@/lib/practice";

const WORD: PracticeCard = { id: "word-1", term: "decision", meaning: "decisione", definition: "A choice made after consideration", example: "I made a decision today.", cloze: "I made a _____ today.", kind: "word", synonyms: [], collocations: ["make a decision"], due_at: NOW.toISOString(), repetitions: 2, interval_days: 3, correct_count: 2, incorrect_count: 1, material_id: "lesson-1" };

describe("distinct review methods", () => {
  it("groups all ten methods in the four requested categories", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(["memorizzazione", "vocabolario", "produzione", "consolidamento"]);
    expect(METHODS.filter((m) => m.category === "memorizzazione").map((m) => m.id)).toEqual(["active_recall", "spaced_repetition", "retrieval_practice"]);
    expect(METHODS.filter((m) => m.category === "vocabolario").map((m) => m.id)).toEqual(["collocations", "contextual_learning", "translation_practice"]);
    expect(METHODS.filter((m) => m.category === "produzione").map((m) => m.id)).toEqual(["sentence_creation", "synonyms_paraphrasing", "speaking_challenge"]);
    expect(METHODS.filter((m) => m.category === "consolidamento").map((m) => m.id)).toEqual(["error_based"]);
    expect(new Set(METHODS.map((m) => m.id)).size).toBe(10);
  });
  it("active recall alternates Italian meanings and English words with no answer options", () => {
    const items = buildRecallItems([WORD, WORD, WORD]);
    expect(items.map((i) => i.direction)).toEqual(["it_en", "it_en", "en_it"]);
    expect(items.map((i) => i.expected)).toEqual(["decision", "decision", "decisione"]);
  });
  it("spaced repetition excludes tomorrow while extra practice keeps all saved words", () => {
    const tomorrow = { ...WORD, id: "tomorrow", due_at: new Date(NOW.getTime() + DAY).toISOString() };
    const dayEnd = new Date("2026-11-12T23:59:59.999Z");
    expect(poolFor("spaced_repetition", [WORD, tomorrow], { now: NOW, dayEnd }).map((c) => c.id)).toEqual(["word-1"]);
    expect(poolFor("sentence_creation", [WORD, tomorrow], { now: NOW, dayEnd })).toHaveLength(2);
  });
  it("correct extra practice does not advance an already scheduled word", () => {
    expect(reviewSchedule(WORD, true, false, NOW)).toBeNull();
  });
  it("collocations build match, gap and order using only lesson expressions", () => {
    const cards = [WORD, { ...WORD, id: "w2", term: "choice", meaning: "scelta", collocations: ["make a choice"], example: "I made a choice today." }, { ...WORD, id: "w3", term: "effort", meaning: "sforzo", collocations: ["make an effort"], example: "I made an effort today." }];
    const rounds = buildCollocationRounds(cards, () => 0);
    expect(new Set(rounds.map((r) => r.type))).toEqual(new Set(["match", "gap", "order"]));
    for (const round of rounds) {
      if (round.type === "match") expect(round.pairs.map((p) => p.right).sort()).toEqual(["choice", "decision", "effort"]);
      else expect(cards.some((c) => c.collocations.includes(round.full) || c.example === round.full)).toBe(true);
    }
  });
  it("retrieval questions have concrete saved answers for the final comparison", () => {
    expect(buildRetrievalQuestions([WORD, WORD, WORD]).map((q) => q.answer)).toEqual(["decision", "decision", "decision"]);
  });
  it("synonyms and paraphrases alternate and paraphrases require a saved example", () => {
    expect(buildSynonymItems([WORD, WORD]).map((i) => i.task)).toEqual(["synonym", "paraphrase"]);
    expect(buildSynonymItems([WORD, { ...WORD, example: null }])[1]?.task).toBe("synonym");
  });
  it("speaking uses three to five saved words and one or two minutes", () => {
    expect(SPEAKING_DURATIONS).toEqual([60, 120]);
    expect(speakingWordCount(20, () => 0)).toBe(3);
    expect(speakingWordCount(20, () => 0.99)).toBe(5);
    expect(speakingWordCount(3, () => 0.99)).toBe(3);
  });
  it("context and translation require lesson examples containing the word", () => {
    const absent = { ...WORD, id: "missing", example: "Hello." };
    expect(poolFor("contextual_learning", [WORD, absent]).map((c) => c.id)).toEqual(["word-1"]);
    expect(poolFor("translation_practice", [WORD, absent]).map((c) => c.id)).toEqual(["word-1"]);
  });
  it("translations alternate IT to EN and EN to IT using the lesson sentences", () => {
    const items = buildTranslationItems([WORD, WORD]);
    expect(items.map((i) => i.direction)).toEqual(["it_en", "en_it"]);
    expect(items.map((i) => i.english)).toEqual(["I made a decision today.", "I made a decision today."]);
  });
  it("error training uses a different exercise from active recall", () => {
    const kinds = errorKindsFor(WORD, "active_recall", [WORD]);
    expect(kinds).not.toContain("meaning_to_term");
    expect(kinds).toContain("cloze");
  });
  it("a corrected error waits three days before its final check", () => {
    const corrected = mistakeAfterAnswer({ wrong_count: 1, check_after: null, resolved_at: null }, true, NOW);
    expect(corrected.check_after).toBe("2026-11-15T10:00:00.000Z");
    expect(mistakePhase(corrected, NOW)).toBe("waiting");
    expect(mistakePhase(corrected, new Date(NOW.getTime() + 3 * DAY))).toBe("check");
    const resolved = mistakeAfterAnswer(corrected, true, new Date(NOW.getTime() + 3 * DAY));
    expect(resolved.resolved_at).toBe("2026-11-15T10:00:00.000Z");
  });
  it("error sessions exclude waiting errors and resolved errors", () => {
    const mistakes = [{ id: "m1", card_id: WORD.id, method: "active_recall", answer: "wrong", last_wrong_at: NOW.toISOString(), wrong_count: 1, check_after: new Date(NOW.getTime() + 3 * DAY).toISOString(), resolved_at: null }];
    expect(poolFor("error_based", [WORD], { now: NOW, mistakes })).toEqual([]);
    expect(poolFor("error_based", [WORD], { now: new Date(NOW.getTime() + 3 * DAY), mistakes })).toHaveLength(1);
    expect(poolFor("error_based", [WORD], { now: NOW, mistakes: mistakes.map((m) => ({ ...m, resolved_at: NOW.toISOString() })) })).toEqual([]);
  });
});
