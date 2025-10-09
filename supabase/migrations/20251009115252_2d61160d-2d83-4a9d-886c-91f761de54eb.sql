-- Remove unique constraint from utm_id column in events_actions table
ALTER TABLE public.events_actions DROP CONSTRAINT IF EXISTS events_actions_utm_id_key;