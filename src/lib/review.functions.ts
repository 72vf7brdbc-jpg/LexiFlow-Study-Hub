import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { METHODS } from "./methods";
import { mistakeAfterAnswer, mistakePhase } from "./mistakes";
import { reviewSchedule } from "./srs";
import { nextStreak, xpForAnswer } from "./streak";

const METHOD_IDS = METHODS.map((m) => m.id) as [string, ...string[]];

const reviewInput = z.object({
  cardId: z.string().uuid(),
  correct: z.boolean(),
  mode: z.enum(["typed", "voice"]),
  answer: z.string().max(500),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(METHOD_IDS).default("active_recall"),
  /** End of the learner's local day: words due before it count as due today. */
  dueBefore: z.string().datetime().optional(),
});

export type RecordReviewResult =
  | {
      ok: true;
      xpEarned: number;
      totalXp: number;
      streak: number;
      level: number;
      nextDueAt: string;
      intervalDays: number;
      levelChanged: boolean;
      mistake: "opened" | "waiting" | "resolved" | null;
    }
  | { ok: false; message: string };

const MAX_AHEAD_MS = 36 * 60 * 60 * 1000;

export const recordReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reviewInput.parse(data))
  .handler(async ({ data, context }): Promise<RecordReviewResult> => {
    const { supabase, userId } = context;

    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("id, repetitions, ease, interval_days, correct_count, incorrect_count, due_at")
      .eq("id", data.cardId)
      .maybeSingle();
    if (cardErr || !card) return { ok: false, message: "Scheda non trovata." };

    const now = new Date();
    let limit = now.getTime();
    if (data.dueBefore) limit = Math.min(Math.max(limit, new Date(data.dueBefore).getTime()), now.getTime() + MAX_AHEAD_MS);
    const isDue = new Date(card.due_at).getTime() <= limit;
    const next = reviewSchedule({ repetitions: card.repetitions, ease: card.ease, interval_days: card.interval_days }, data.correct, isDue, now);

    const { error: updErr } = await supabase
      .from("cards")
      .update({
        ...(next
          ? { repetitions: next.repetitions, ease: next.ease, interval_days: next.interval_days, due_at: next.due_at.toISOString() }
          : {}),
        last_reviewed_at: now.toISOString(),
        correct_count: card.correct_count + (data.correct ? 1 : 0),
        incorrect_count: card.incorrect_count + (data.correct ? 0 : 1),
      })
      .eq("id", card.id);
    if (updErr) return { ok: false, message: "Non è stato possibile salvare la risposta." };

    // Error notebook
    let mistake: "opened" | "waiting" | "resolved" | null = null;
    const { data: open } = await supabase
      .from("mistakes")
      .select("id, method, wrong_count, check_after, resolved_at")
      .eq("card_id", card.id)
      .is("resolved_at", null)
      .maybeSingle();
    if (!data.correct) {
      if (open) {
        await supabase
          .from("mistakes")
          .update({
            wrong_count: open.wrong_count + 1,
            check_after: null,
            last_wrong_at: now.toISOString(),
            answer: data.answer.slice(0, 500) || null,
            // Keep the original method so the retest still uses a different exercise.
            method: data.method === "error_based" ? open.method : data.method,
            updated_at: now.toISOString(),
          })
          .eq("id", open.id);
      } else {
        await supabase.from("mistakes").insert({
          user_id: userId,
          card_id: card.id,
          method: data.method,
          answer: data.answer.slice(0, 500) || null,
        });
      }
      mistake = "opened";
    } else if (open && data.method === "error_based" && mistakePhase(open, now) !== "waiting") {
      const upd = mistakeAfterAnswer(open, true, now);
      await supabase
        .from("mistakes")
        .update({ check_after: upd.check_after, resolved_at: upd.resolved_at, updated_at: now.toISOString() })
        .eq("id", open.id);
      mistake = upd.resolved_at ? "resolved" : "waiting";
    }

    const xpEarned = xpForAnswer(data.correct, data.mode);
    await supabase.from("reviews").insert({
      user_id: userId,
      card_id: card.id,
      correct: data.correct,
      mode: data.mode,
      exercise: data.method,
      answer: data.answer.slice(0, 500),
      xp: xpEarned,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("xp, streak, longest_streak, last_study_date, days_per_week")
      .eq("id", userId)
      .maybeSingle();

    const streak = nextStreak(
      {
        streak: profile?.streak ?? 0,
        lastStudyDate: profile?.last_study_date ?? null,
        daysPerWeek: profile?.days_per_week ?? 7,
      },
      data.localDate,
    );
    const totalXp = (profile?.xp ?? 0) + xpEarned;
    await supabase
      .from("profiles")
      .update({
        xp: totalXp,
        streak,
        longest_streak: Math.max(profile?.longest_streak ?? 0, streak),
        last_study_date: data.localDate,
      })
      .eq("id", userId);

    const reps = next ? next.repetitions : card.repetitions;
    return {
      ok: true,
      xpEarned,
      totalXp,
      streak,
      level: Math.min(5, reps),
      nextDueAt: next ? next.due_at.toISOString() : card.due_at,
      intervalDays: next ? next.interval_days : card.interval_days,
      levelChanged: !!next,
      mistake,
    };
  });
