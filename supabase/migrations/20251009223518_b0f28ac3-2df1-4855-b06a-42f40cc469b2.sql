-- Drop the old mint_l00 function that references the non-existent placements table
DROP FUNCTION IF EXISTS public.mint_l00(_eoa_id uuid, _placement_id uuid, _deck_slug text, _utm_medium text);