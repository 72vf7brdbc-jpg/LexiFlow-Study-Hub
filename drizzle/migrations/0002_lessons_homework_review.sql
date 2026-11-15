-- Lesson days on the profile (0 = Sunday … 6 = Saturday, like JavaScript getDay)
ALTER TABLE public.profiles ADD COLUMN lesson_days smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_lesson_days_check CHECK (lesson_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

-- Lesson log on each archive entry
ALTER TABLE public.materials ADD COLUMN lesson_date date;
ALTER TABLE public.materials ADD COLUMN topics text;
ALTER TABLE public.materials ADD COLUMN vocabulary_notes text;
ALTER TABLE public.materials ADD COLUMN activities text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.materials ADD COLUMN notes text;
ALTER TABLE public.materials ADD COLUMN file_path text;
ALTER TABLE public.materials ADD COLUMN file_mime text;
ALTER TABLE public.materials ADD COLUMN enriched_at timestamptz;
ALTER TABLE public.materials ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.materials SET lesson_date = (created_at AT TIME ZONE 'Europe/Rome')::date WHERE lesson_date IS NULL;
ALTER TABLE public.materials ALTER COLUMN lesson_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.materials ADD CONSTRAINT materials_activities_check
  CHECK (activities <@ ARRAY['speaking','listening','reading','writing','grammar']::text[]);
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_source_type_check;
ALTER TABLE public.materials ADD CONSTRAINT materials_source_type_check CHECK (source_type IN ('photo','file','text','log'));
CREATE INDEX materials_user_lesson_date_idx ON public.materials (user_id, lesson_date DESC);
CREATE TRIGGER materials_touch BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Lesson-only synonyms and collocations on study cards
ALTER TABLE public.cards ADD COLUMN synonyms text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.cards ADD COLUMN collocations text[] NOT NULL DEFAULT '{}';

-- Exercise type on the review log
ALTER TABLE public.reviews ADD COLUMN exercise text NOT NULL DEFAULT 'recall';

-- Homework ("Da fare")
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 400),
  exercise_ref text CHECK (exercise_ref IS NULL OR char_length(exercise_ref) <= 120),
  linked_file boolean NOT NULL DEFAULT false,
  source_text text,
  assigned_on date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tasks_no_duplicates_idx ON public.tasks (material_id, lower(btrim(description)));
CREATE INDEX tasks_user_status_idx ON public.tasks (user_id, status, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own tasks select" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own tasks update" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own tasks delete" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Original lesson files: each user reads and writes only inside their own folder
CREATE POLICY "Own lesson files select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own lesson files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own lesson files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-files' AND (storage.foldername(name))[1] = auth.uid()::text);