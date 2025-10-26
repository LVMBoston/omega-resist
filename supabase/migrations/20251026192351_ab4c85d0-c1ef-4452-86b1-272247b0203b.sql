-- Add invalidation tracking to tokens table
ALTER TABLE public.tokens 
ADD COLUMN invalidated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deck_version_at_mint TEXT,
ADD COLUMN needs_regeneration BOOLEAN DEFAULT false;

-- Create index for faster queries on invalidated tokens
CREATE INDEX idx_tokens_invalidated_at ON public.tokens(invalidated_at);
CREATE INDEX idx_tokens_needs_regeneration ON public.tokens(needs_regeneration) WHERE needs_regeneration = true;

-- Function to invalidate all L00 tokens for a specific deck
CREATE OR REPLACE FUNCTION public.invalidate_deck_tokens(p_deck_slug TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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