import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const booksQuery = queryOptions({
  queryKey: ["books"],
  queryFn: async () => {
    const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const bookQuery = (id: string) => queryOptions({
  queryKey: ["book", id],
  queryFn: async () => {
    const { data: book, error } = await supabase.from("books").select("*").eq("id", id).single();
    if (error) throw error;
    const lessons = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error: partsError } = await supabase.from("book_lessons").select("*").eq("book_id", id).order("part_number").range(offset, offset + 499);
      if (partsError) throw partsError;
      lessons.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return { book, lessons };
  },
});