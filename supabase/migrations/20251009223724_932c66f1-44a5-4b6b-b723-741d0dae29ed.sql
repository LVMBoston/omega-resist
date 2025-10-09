-- Fix ambiguous column reference in mint_l00 function
CREATE OR REPLACE FUNCTION public.mint_l00(_eoa_id uuid, _deck_slug text, _utm_medium text DEFAULT 'qr'::text, _utm_content text DEFAULT NULL::text)
 RETURNS TABLE(token text, full_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _token TEXT;
  _campaign_id UUID;
  _utm_campaign TEXT;
  _utm_id TEXT;
  _utm_source TEXT;
  _full_url TEXT;
  _user_id UUID;
  _event_utm_content TEXT;
  _mobilize_id TEXT;
  _token_exists BOOLEAN;
BEGIN
  _user_id := auth.uid();
  
  -- Check if user has permission (admin or manager)
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or manager can mint tokens';
  END IF;
  
  -- Get campaign details, utm_content, and mobilize_id from EoA
  SELECT ea.campaign_id, ea.utm_id, c.code, ea.utm_content, ea.mobilize_id
  INTO _campaign_id, _utm_id, _utm_campaign, _event_utm_content, _mobilize_id
  FROM public.events_actions ea
  JOIN public.campaigns c ON ea.campaign_id = c.id
  WHERE ea.id = _eoa_id;
  
  IF _campaign_id IS NULL THEN
    RAISE EXCEPTION 'EoA not found';
  END IF;
  
  IF _mobilize_id IS NULL THEN
    RAISE EXCEPTION 'EoA must have a mobilize_id to mint L00 token';
  END IF;
  
  -- Generate token using format l00-{mobilize_id}
  _token := 'l00-' || _mobilize_id;
  
  -- Check if token already exists
  SELECT EXISTS(SELECT 1 FROM public.tokens WHERE public.tokens.token = _token) INTO _token_exists;
  
  IF _token_exists THEN
    RAISE EXCEPTION 'L00 token already exists for this mobilize_id';
  END IF;
  
  -- Use provided utm_content or fall back to event's utm_content
  _utm_content := COALESCE(_utm_content, _event_utm_content);
  
  -- Set UTM parameters
  _utm_source := 'L00';
  
  -- Build full URL
  _full_url := format(
    'https://app.democracyforge.org/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&utm_content=%s&t=%s&v_lvl=00',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    COALESCE(_utm_content, ''),
    _token
  );
  
  -- Insert token record
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
  
  -- Fix: Explicitly alias the columns to avoid ambiguity
  RETURN QUERY SELECT _token AS token, _full_url AS full_url;
END;
$$;