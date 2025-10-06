-- Add location and assignment fields to events_actions table
ALTER TABLE public.events_actions
ADD COLUMN IF NOT EXISTS site_name TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'TBD',
ADD COLUMN IF NOT EXISTS assigned_deck_slug TEXT REFERENCES public.decks(slug) ON DELETE SET NULL;