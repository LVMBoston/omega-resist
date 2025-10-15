-- Update unique constraint on events_actions to use mobilize_code + utm_id combination
-- This allows the same mobilize_code to be used with different utm_ids (e.g., poster vs handout)

-- First, drop the existing unique constraint on mobilize_code if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_actions_mobilize_code_key'
  ) THEN
    ALTER TABLE public.events_actions DROP CONSTRAINT events_actions_mobilize_code_key;
  END IF;
END $$;

-- Add new unique constraint on the combination of mobilize_code and utm_id
-- This ensures each mobilize_code + utm_id combination is unique
ALTER TABLE public.events_actions 
ADD CONSTRAINT events_actions_mobilize_code_utm_id_key 
UNIQUE (mobilize_code, utm_id);

-- Update the mint_l00 function to generate tokens based on mobilize_code + utm_id
CREATE OR REPLACE FUNCTION public.mint_l00(_eoa_id uuid, _deck_slug text, _utm_medium text DEFAULT 'qr'::text)
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
  
  -- Generate token based on mobilize_code AND utm_id to ensure uniqueness
  _token := 'l00-' || _mobilize_code || '-' || substring(_utm_id from 1 for 6);
  
  SELECT EXISTS(SELECT 1 FROM public.tokens WHERE public.tokens.token = _token) INTO _token_exists;
  
  IF _token_exists THEN
    RAISE EXCEPTION 'L00 token already exists for this mobilize_code + utm_id combination';
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