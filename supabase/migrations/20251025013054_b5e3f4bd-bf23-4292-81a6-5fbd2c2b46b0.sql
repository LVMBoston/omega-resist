-- Update all existing slide positions from 0-based to 1-based
-- First, move all positions to negative to avoid conflicts
UPDATE public.slide_items
SET position = -(position + 1)
WHERE position >= 0;

-- Then, convert back to positive
UPDATE public.slide_items
SET position = -position
WHERE position < 0;