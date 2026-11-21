
import { queryOptions } from "@tanstack/react-query";
import { startOfWeek } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { progressStart, type StudyActivity } from "./review-progress";

export type Profile = Tables<"profiles">;
export type Material = Tables<"materials">;
export type Card = Tables<"cards">;
export type Task = Tables<"tasks">;

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sessione scaduta. Accedi di nuovo.");
  }
  return data.user.id;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile> => {
    const userId = await requireUserId();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({ id: userId })
      .select("*")
      .single();

    if (insErr) throw insErr;
    return created;
  },
  staleTime: 30_000,
});

export type MaterialListItem = Pick<
  Material,
  "id" | "title" | "source_type" | "file_name" | "summary" | "topic" | "card_count" | "created_at"
>;

export const materialsQuery = queryOptions({
  queryKey: ["materials"],
  queryFn: async (): Promise<MaterialListItem[]> => {
    const { data, error } = await supabase
      .from("materials")
      .select("id, title, source_type, file_name, summary, topic, card_count, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data ?? [];
  },
});

export const materialQuery = (id: string) =>
  queryOptions({
    queryKey: ["material", id],
    queryFn: async (): Promise<{
      material: Material | null;
      cards: Card[];
      tasks: Task[];
    }> => {
      const [
        { data: material, error },
        { data: cards, error: cErr },
        { data: tasks, error: tErr },
      ] = await Promise.all([
        supabase
          .from("materials")
          .select("*")
          .eq("id", id)
          .maybeSingle(),

        supabase
          .from("cards")
          .select("*")
          .eq("material_id", id)
          .order("created_at", { ascending: true }),

        supabase
          .from("tasks")
          .select("*")
          .eq("material_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (error) throw error;
      if (cErr) throw cErr;
      if (tErr) throw tErr;

      return {
        material,
        cards: cards ?? [],
        tasks: tasks ?? [],
      };
    },
  });

export type DashboardStats = {
  dueCount: number;
  totalCards: number;
  masteredCards: number;
  todayXp: number;
  todayReviews: number;
  weekStudyDates: string[];
  weekAccuracy: number | null;
};

export const statsQuery = queryOptions({
  queryKey: ["stats"],
  queryFn: async (): Promise<DashboardStats> => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const [due, total, mastered, reviews] = await Promise.all([
      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .lte("due_at", now.toISOString()),

      supabase
        .from("cards")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .gte("interval_days", 21),

      supabase
        .from("reviews")
        .select("xp, correct, created_at")
        .gte("created_at", weekStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (due.error) throw due.error;
    if (total.error) throw total.error;
    if (mastered.error) throw mastered.error;
    if (reviews.error) throw reviews.error;

    const rows = reviews.data ?? [];
    const dates = new Set<string>();

    let todayXp = 0;
    let todayReviews = 0;
    let correct = 0;

    for (const r of rows) {
      const d = new Date(r.created_at);

      dates.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );

      if (d >= todayStart) {
        todayXp += r.xp;
        todayReviews += 1;
      }

      if (r.correct) correct += 1;
    }

    return {
      dueCount: due.count ?? 0,
      totalCards: total.count ?? 0,
      masteredCards: mastered.count ?? 0,
      todayXp,
      todayReviews,
      weekStudyDates: [...dates],
      weekAccuracy: rows.length ? correct / rows.length : null,
    };
  },
});

export type ReviewCard = Pick<
  Card,
  | "id"
  | "term"
  | "meaning"
  | "definition"
  | "example"
  | "cloze"
  | "kind"
  | "synonyms"
  | "collocations"
  | "phonetic"
  | "due_at"
  | "repetitions"
  | "ease"
  | "interval_days"
  | "correct_count"
  | "incorrect_count"
  | "material_id"
>;

export type ReviewMistake = Pick<
  Tables<"mistakes">,
  "id" | "card_id" | "method" | "answer" | "wrong_count" | "check_after" | "resolved_at" | "last_wrong_at"
>;

export type ReviewData = {
  cards: ReviewCard[];
  materials: Pick<Material, "id" | "title" | "topic" | "lesson_date">[];
  mistakes: ReviewMistake[];
  tasks: Task[];
};

/** Everything the Ripasso section needs: the learner's words, lessons and open mistakes. */
export const reviewDataQuery = queryOptions({
  queryKey: ["review-data"],
  queryFn: async (): Promise<ReviewData> => {
    const [cards, materials, mistakes, tasks] = await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, term, meaning, definition, example, cloze, kind, synonyms, collocations, phonetic, due_at, repetitions, ease, interval_days, correct_count, incorrect_count, material_id",
        )
        .order("due_at", { ascending: true })
        .limit(2000),
      supabase.from("materials").select("id, title, topic, lesson_date").order("lesson_date", { ascending: false }).limit(500),
      supabase
        .from("mistakes")
        .select("id, card_id, method, answer, wrong_count, check_after, resolved_at, last_wrong_at")
        .is("resolved_at", null)
        .limit(2000),
      supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(2000),
    ]);
    if (cards.error) throw cards.error;
    if (materials.error) throw materials.error;
    if (mistakes.error) throw mistakes.error;
    if (tasks.error) throw tasks.error;
    return { cards: cards.data ?? [], materials: materials.data ?? [], mistakes: mistakes.data ?? [], tasks: tasks.data ?? [] };
  },
  staleTime: 15_000,
});

/** Read every persisted answer in the window, not a truncated preview of activity. */
export const reviewProgressQuery = queryOptions({
  queryKey: ["review-progress"],
  queryFn: async (): Promise<StudyActivity[]> => {
    await requireUserId();
    const since = progressStart(new Date()).toISOString();
    const vocabulary: StudyActivity[] = [];
    const grammar: StudyActivity[] = [];
    await Promise.all([
      (async () => {
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from("reviews").select("id, created_at, correct, xp").gte("created_at", since).order("created_at").order("id").range(offset, offset + 499);
          if (error) throw error;
          vocabulary.push(...(data ?? []).map((row) => ({ created_at: row.created_at, correct: row.correct, xp: row.xp, kind: "vocabulary" as const })));
          if (!data || data.length < 500) break;
        }
      })(),
      (async () => {
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from("grammar_attempts").select("id, created_at, correct").gte("created_at", since).order("created_at").order("id").range(offset, offset + 499);
          if (error) throw error;
          grammar.push(...(data ?? []).map((row) => ({ created_at: row.created_at, correct: row.correct, xp: 0, kind: "grammar" as const })));
          if (!data || data.length < 500) break;
        }
      })(),
    ]);
    return [...vocabulary, ...grammar];
  },
  staleTime: 15_000,
});
