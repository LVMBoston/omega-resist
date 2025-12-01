-- Set default value for location_source column
ALTER TABLE public.url_events 
ALTER COLUMN location_source SET DEFAULT 'unknown';