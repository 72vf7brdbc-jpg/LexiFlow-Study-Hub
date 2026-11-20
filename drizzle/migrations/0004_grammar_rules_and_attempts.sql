CREATE TABLE public.grammar_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 material_id uuid REFERENCES public.materials(id) ON DELETE CASCADE,
 title text NOT NULL,
 level text NOT NULL DEFAULT 'B1',
 source text NOT NULL DEFAULT 'lesson' CHECK (source IN ('lesson', 'request', 'manual')),
 content jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_rules TO authenticated;
GRANT ALL ON public.grammar_rules TO service_role;
ALTER TABLE public.grammar_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own grammar rules select" ON public.grammar_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own grammar rules insert" ON public.grammar_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (material_id IS NULL OR EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id AND m.user_id = auth.uid())));
CREATE POLICY "Own grammar rules update" ON public.grammar_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND (material_id IS NULL OR EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id AND m.user_id = auth.uid())));
CREATE POLICY "Own grammar rules delete" ON public.grammar_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX grammar_rules_lesson_topic ON public.grammar_rules (user_id, material_id, lower(title)) WHERE material_id IS NOT NULL;
CREATE TABLE public.grammar_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 rule_id uuid NOT NULL REFERENCES public.grammar_rules(id) ON DELETE CASCADE,
 exercise_index integer NOT NULL,
 answer text NOT NULL,
 correct boolean NOT NULL,
 feedback text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.grammar_attempts TO authenticated;
GRANT ALL ON public.grammar_attempts TO service_role;
ALTER TABLE public.grammar_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own grammar attempts select" ON public.grammar_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own grammar attempts insert" ON public.grammar_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.grammar_rules r WHERE r.id = rule_id AND r.user_id = auth.uid()));
CREATE INDEX grammar_attempts_rule ON public.grammar_attempts(user_id, rule_id, created_at);
ALTER TABLE public.materials ADD COLUMN grammar_extracted_at timestamptz;