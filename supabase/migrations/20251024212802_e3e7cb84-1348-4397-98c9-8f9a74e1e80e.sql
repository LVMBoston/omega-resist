-- Update mint_l00 function to use 10 characters of utm_id instead of 6
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
BEGIN
  _user_id := auth.uid();
  
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or manager can mint tokens';
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
  
  -- Generate token based on mobilize_code AND utm_id (now using first 10 chars)
  _token := 'l00-' || _mobilize_code || '-' || substring(_utm_id from 1 for 10);
  
  SELECT EXISTS(SELECT 1 FROM public.tokens WHERE public.tokens.token = _token) INTO _token_exists;
  
  -- If token exists, delete ONLY the L00 token (preserve L01-L03 children)
  IF _token_exists THEN
    DELETE FROM public.tokens WHERE token = _token;
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