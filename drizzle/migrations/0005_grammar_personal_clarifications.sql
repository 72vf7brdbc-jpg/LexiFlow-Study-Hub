CREATE TABLE public.grammar_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 rule_id uuid NOT NULL REFERENCES public.grammar_rules(id) ON DELETE CASCADE,
 question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 1500),
 answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 6000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.grammar_notes TO authenticated;
GRANT ALL ON public.grammar_notes TO service_role;
ALTER TABLE public.grammar_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own grammar notes read" ON public.grammar_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own grammar notes add" ON public.grammar_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.grammar_rules r WHERE r.id = rule_id AND r.user_id = auth.uid()));
CREATE INDEX grammar_notes_by_rule ON public.grammar_notes(user_id, rule_id, created_at);
CREATE TABLE public.grammar_ai_blocks (
 user_id uuid PRIMARY KEY,
 message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.grammar_ai_blocks TO authenticated;
GRANT ALL ON public.grammar_ai_blocks TO service_role;
ALTER TABLE public.grammar_ai_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own grammar AI blocks read" ON public.grammar_ai_blocks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own grammar AI blocks add" ON public.grammar_ai_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own grammar AI blocks update" ON public.grammar_ai_blocks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);