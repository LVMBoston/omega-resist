-- Step 1: Add mobilize_code column to events_actions
ALTER TABLE public.events_actions
ADD COLUMN mobilize_code text;

COMMENT ON COLUMN public.events_actions.mobilize_code IS 
  'Either the Mobilize event/action ID or a 6-character unique code for non-Mobilize events. Required for L00 token minting.';

-- Step 2: Migrate existing mobilize_id values to mobilize_code
UPDATE public.events_actions
SET mobilize_code = mobilize_id
WHERE mobilize_id IS NOT NULL;

-- Step 3: Drop old mint_l00() function
DROP FUNCTION IF EXISTS public.mint_l00(uuid, text, text, text);

-- Step 4: Create new mint_l00() function with updated signature
CREATE OR REPLACE FUNCTION public.mint_l00(
  _eoa_id uuid, 
  _deck_slug text, 
  _utm_medium text DEFAULT 'qr'::text
)
RETURNS TABLE(token text, full_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _token TEXT;
  _campaign_id UUID;
  _utm_campaign TEXT;
  _utm_id TEXT;
  _utm_source TEXT;
  _full_url TEXT;
  _user_id UUID;
  _mobilize_code TEXT;
  _utm_content TEXT;
  _token_exists BOOLEAN;
  _existing_l00_token TEXT;
BEGIN
  _user_id := auth.uid();
  
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or manager can mint tokens';
  END IF;
  
  SELECT tokens.token INTO _existing_l00_token
  FROM public.tokens
  WHERE eoa_id = _eoa_id AND level = 0
  LIMIT 1;
  
  IF _existing_l00_token IS NOT NULL THEN
    RAISE EXCEPTION 'This event/action already has an L00 token: %', _existing_l00_token;
  END IF;
  
  SELECT ea.campaign_id, ea.utm_id, c.code, ea.mobilize_code
  INTO _campaign_id, _utm_id, _utm_campaign, _mobilize_code
  FROM public.events_actions ea
  JOIN public.campaigns c ON ea.campaign_id = c.id
  WHERE ea.id = _eoa_id;
  
  IF _campaign_id IS NULL THEN
    RAISE EXCEPTION 'EoA not found';
  END IF;
  
  IF _mobilize_code IS NULL OR _mobilize_code = '' THEN
    RAISE EXCEPTION 'mobilize_code is required to mint L00 token. Provide either Mobilize ID or 6-character unique code.';
  END IF;
  
  _utm_content := _mobilize_code || '-' || _utm_id;
  
  _token := 'l00-' || _mobilize_code;
  
  SELECT EXISTS(SELECT 1 FROM public.tokens WHERE public.tokens.token = _token) INTO _token_exists;
  
  IF _token_exists THEN
    RAISE EXCEPTION 'L00 token already exists for this mobilize_code';
  END IF;
  
  _utm_source := 'L00';
  
  _full_url := format(
    'https://omega-resist.lovable.app/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&utm_content=%s&t=%s&v_lvl=00',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    _utm_content,
    _token
  );
  
  INSERT INTO public.tokens (
    token,
    parent_token,
    root_token,
    level,
    eoa_id,
    deck_slug,
    utm_campaign,
    utm_id,
    utm_content,
    utm_medium,
    utm_source,
    full_url,
    created_by
  ) VALUES (
    _token,
    NULL,
    _token,
    0,
    _eoa_id,
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_content,
    _utm_medium,
    _utm_source,
    _full_url,
    _user_id
  );
  
  RETURN QUERY SELECT _token AS token, _full_url AS full_url;
END;
$function$;

COMMENT ON FUNCTION public.mint_l00 IS 
  'Mints L00 root token. Constructs utm_content as {mobilize_code}-{utm_id} for full traceability. mobilize_code is required.';

-- Step 5: Update column comment on tokens.utm_content
COMMENT ON COLUMN public.tokens.utm_content IS 
  'Combines the Mobilize event/action code with the system utm_id (e.g., 908742-nkd25-02) for full traceability of origin and campaign variant.';

-- Step 6: Update invalidate_tokens_on_critical_change trigger
CREATE OR REPLACE FUNCTION public.invalidate_tokens_on_critical_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.mobilize_code IS DISTINCT FROM NEW.mobilize_code) OR
     (OLD.assigned_deck_slug IS DISTINCT FROM NEW.assigned_deck_slug) OR
     (OLD.utm_id IS DISTINCT FROM NEW.utm_id) THEN
    
    DELETE FROM public.tokens WHERE eoa_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 7: Clean up existing data
DELETE FROM public.url_events;
DELETE FROM public.tokens;
DELETE FROM public.daily_aggregates;
DELETE FROM public.shortened_urls;