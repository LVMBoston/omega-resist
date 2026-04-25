
-- 1. Add deployment tracking columns to decks
ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS last_deployed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz NULL;

-- 2. Trigger function: when slide_items change, touch the parent deck
CREATE OR REPLACE FUNCTION public.touch_deck_on_slide_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.decks
       SET last_modified_at = now()
     WHERE slug = OLD.deck_slug;
    RETURN OLD;
  ELSE
    UPDATE public.decks
       SET last_modified_at = now()
     WHERE slug = NEW.deck_slug;
    -- Also touch old deck if slug changed on update
    IF TG_OP = 'UPDATE' AND OLD.deck_slug IS DISTINCT FROM NEW.deck_slug THEN
      UPDATE public.decks
         SET last_modified_at = now()
       WHERE slug = OLD.deck_slug;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS slide_items_touch_deck ON public.slide_items;
CREATE TRIGGER slide_items_touch_deck
AFTER INSERT OR UPDATE OR DELETE ON public.slide_items
FOR EACH ROW
EXECUTE FUNCTION public.touch_deck_on_slide_change();

-- 4. Backfill last_deployed_at from most recent L00 mint per deck
UPDATE public.decks d
SET last_deployed_at = sub.max_minted
FROM (
  SELECT deck_slug, MAX(minted_at) AS max_minted
  FROM public.tokens
  WHERE level = 0 AND deleted_at IS NULL
  GROUP BY deck_slug
) sub
WHERE d.slug = sub.deck_slug
  AND d.last_deployed_at IS NULL;

-- 5. Backfill last_modified_at from updated_at as a sensible starting point
UPDATE public.decks
SET last_modified_at = COALESCE(updated_at, created_at)
WHERE last_modified_at IS NULL;
