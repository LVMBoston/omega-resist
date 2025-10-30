-- Add display_order column to decks table
ALTER TABLE public.decks 
ADD COLUMN display_order integer NOT NULL DEFAULT 999999;

-- Create index for better performance
CREATE INDEX idx_decks_display_order ON public.decks(display_order);