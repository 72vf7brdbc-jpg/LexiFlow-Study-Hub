CREATE TABLE public.books (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
 file_path text NOT NULL, file_name text NOT NULL, file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 5368709120),
 page_count integer NOT NULL CHECK (page_count > 0), mode text NOT NULL CHECK (mode IN ('automatic','pages')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,file_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY books_own ON public.books FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND split_part(file_path,'/',1) = auth.uid()::text);
CREATE TABLE public.book_lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, part_number integer NOT NULL CHECK(part_number > 0),
 page_start integer NOT NULL CHECK(page_start > 0), page_end integer NOT NULL CHECK(page_end >= page_start AND page_end - page_start < 15),
 material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready')),
 started_at timestamptz, error_message text, UNIQUE(book_id,part_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_lessons TO authenticated;
GRANT ALL ON public.book_lessons TO service_role;
ALTER TABLE public.book_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY book_lessons_own ON public.book_lessons FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS(SELECT 1 FROM public.books b WHERE b.id = book_id AND b.user_id = auth.uid() AND page_end <= b.page_count) AND (material_id IS NULL OR EXISTS(SELECT 1 FROM public.materials m WHERE m.id = material_id AND m.user_id = auth.uid())));
CREATE INDEX books_owner_created_idx ON public.books(user_id,created_at DESC);
CREATE INDEX book_lessons_owner_idx ON public.book_lessons(user_id,book_id,part_number);