-- Add import_source column to slide_items table
ALTER TABLE public.slide_items 
ADD COLUMN import_source text DEFAULT 'zip' 
CHECK (import_source IN ('zip', 'google_slides', 'manual', 'other'));