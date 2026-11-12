import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scheduleCard } from "./srs";
import { nextStreak, xpForAnswer } from "./streak";

const reviewInput = z.object({
  cardId: z.string().uuid(),
  correct: z.boolean(),
  mode: z.enum(["typed", "voice"]),
  answer: z.string().max(500),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type RecordReviewResult =
  | { ok: true; xpEarned: number; totalXp: number; streak: number; nextDueAt: string; intervalDays: number }
  | { ok: false; message: string };

export const recordReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reviewInput.parse(data))
  .handler(async ({ data, context }): Promise<RecordReviewResult> => {
    const { supabase, userId } = context;

    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("id, repetitions, ease, interval_days, correct_count, incorrect_count")
      .eq("id", data.cardId)
      .maybeSingle();
    if (cardErr || !card) return { ok: false, message: "Scheda non trovata." };

    const now = new Date();
    const next = scheduleCard(
      { repetitions: card.repetitions, ease: card.ease, interval_days: card.interval_days },
      data.correct,
      now,
    );

    const { error: updErr } = await supabase
      .from("cards")
      .update({
        repetitions: next.repetitions,
        ease: next.ease,
        interval_days: next.interval_days,
        due_at: next.due_at.toISOString(),
        last_reviewed_at: now.toISOString(),
        correct_count: card.correct_count + (data.correct ? 1 : 0),
        incorrect_count: card.incorrect_count + (data.correct ? 0 : 1),
      })
      .eq("id", card.id);
    if (updErr) return { ok: false, message: "Non è stato possibile salvare la risposta." };

    const xpEarned = xpForAnswer(data.correct, data.mode);
    await supabase.from("reviews").insert({
      user_id: userId,
      card_id: card.id,
      correct: data.correct,
      mode: data.mode,
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

    return {
      ok: true,
      xpEarned,
      totalXp,
      streak,
      nextDueAt: next.due_at.toISOString(),
      intervalDays: next.interval_days,
    };
  });
