-- Drop triggers with CASCADE to remove dependencies
DROP TRIGGER IF EXISTS trigger_invalidate_on_slide_change ON public.slide_items CASCADE;
DROP TRIGGER IF EXISTS invalidate_deck_tokens_on_slide_change ON public.slide_items CASCADE;
DROP TRIGGER IF EXISTS invalidate_tokens_on_template_change ON public.viral_slide_configs CASCADE;

-- Now drop the functions
DROP FUNCTION IF EXISTS public.invalidate_deck_tokens_on_slide_change() CASCADE;
DROP FUNCTION IF EXISTS public.invalidate_deck_tokens(p_deck_slug text) CASCADE;

-- Remove invalidation columns from tokens table
ALTER TABLE public.tokens 
  DROP COLUMN IF EXISTS invalidated_at,
  DROP COLUMN IF EXISTS needs_regeneration;