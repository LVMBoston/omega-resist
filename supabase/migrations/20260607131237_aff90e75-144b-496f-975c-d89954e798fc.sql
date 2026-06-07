ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS aspect_ratio numeric,
  ADD COLUMN IF NOT EXISTS orientation text;

ALTER TABLE public.decks
  DROP CONSTRAINT IF EXISTS decks_orientation_check;
ALTER TABLE public.decks
  ADD CONSTRAINT decks_orientation_check
  CHECK (orientation IS NULL OR orientation IN ('landscape','portrait','square'));