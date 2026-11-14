ALTER TABLE public.profiles DROP CONSTRAINT profiles_cefr_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_cefr_level_check CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));