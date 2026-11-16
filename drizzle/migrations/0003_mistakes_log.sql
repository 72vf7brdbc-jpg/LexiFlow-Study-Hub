CREATE TABLE public.mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (char_length(method) BETWEEN 1 AND 40),
  answer text CHECK (answer IS NULL OR char_length(answer) <= 500),
  wrong_count integer NOT NULL DEFAULT 1 CHECK (wrong_count >= 1),
  last_wrong_at timestamptz NOT NULL DEFAULT now(),
  check_after timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mistakes TO authenticated;
GRANT ALL ON public.mistakes TO service_role;

ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own mistakes are readable" ON public.mistakes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own mistakes can be added" ON public.mistakes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own mistakes can be changed" ON public.mistakes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own mistakes can be deleted" ON public.mistakes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX mistakes_one_open_per_card ON public.mistakes (card_id) WHERE resolved_at IS NULL;
CREATE INDEX mistakes_user_open_idx ON public.mistakes (user_id, resolved_at, check_after);