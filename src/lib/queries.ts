
import { queryOptions } from "@tanstack/react-query";
import { startOfWeek } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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
