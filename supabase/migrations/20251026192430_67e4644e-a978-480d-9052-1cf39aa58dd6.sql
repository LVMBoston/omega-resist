-- Fix search_path for the new invalidation functions
DROP FUNCTION IF EXISTS public.invalidate_deck_tokens(TEXT);
DROP FUNCTION IF EXISTS public.is_token_valid(TEXT);

-- Recreate with proper search_path
CREATE OR REPLACE FUNCTION public.invalidate_deck_tokens(p_deck_slug TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE public.tokens
  SET 
    invalidated_at = NOW(),
    needs_regeneration = true
  WHERE 
    deck_slug = p_deck_slug 
    AND level = 0 
    AND invalidated_at IS NULL
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

COMMENT ON FUNCTION public.invalidate_deck_tokens IS 'Invalidates all L00 tokens for a deck when it is updated';

-- Function to check if a token is valid
CREATE OR REPLACE FUNCTION public.is_token_valid(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.tokens 
    WHERE token = p_token 
      AND invalidated_at IS NULL 
      AND deleted_at IS NULL
  );
END;
$$;