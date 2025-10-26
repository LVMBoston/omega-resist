-- Create trigger to auto-invalidate tokens when deck slides change
CREATE OR REPLACE FUNCTION public.invalidate_deck_tokens_on_slide_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invalidate all L00 tokens for this deck when slides are modified
  UPDATE public.tokens
  SET 
    invalidated_at = NOW(),
    needs_regeneration = true
  WHERE 
    deck_slug = COALESCE(NEW.deck_slug, OLD.deck_slug)
    AND level = 0 
    AND invalidated_at IS NULL
    AND deleted_at IS NULL;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_invalidate_on_slide_change ON public.slide_items;

-- Create trigger on slide_items table
CREATE TRIGGER trigger_invalidate_on_slide_change
  AFTER INSERT OR UPDATE OR DELETE ON public.slide_items
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_deck_tokens_on_slide_change();

COMMENT ON FUNCTION public.invalidate_deck_tokens_on_slide_change IS 'Auto-invalidates L00 tokens when deck slides are modified';