-- Update mint_l00 function to use correct domain
CREATE OR REPLACE FUNCTION public.mint_l00(_eoa_id uuid, _deck_slug text, _utm_medium text DEFAULT 'qr'::text, _utm_content text DEFAULT NULL::text)
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
  _event_utm_content TEXT;
  _mobilize_id TEXT;
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
  
  _token := 'l00-' || _mobilize_id;
  
  SELECT EXISTS(SELECT 1 FROM public.tokens WHERE public.tokens.token = _token) INTO _token_exists;
  
  IF _token_exists THEN
    RAISE EXCEPTION 'L00 token already exists for this mobilize_id';
  END IF;
  
  _utm_content := COALESCE(_utm_content, _event_utm_content);
  _utm_source := 'L00';
  
  _full_url := format(
    'https://omega-resist.lovable.app/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&utm_content=%s&t=%s&v_lvl=00',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    COALESCE(_utm_content, ''),
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

-- Update mint_share function to use correct domain
CREATE OR REPLACE FUNCTION public.mint_share(_parent_token text, _utm_medium text)
 RETURNS TABLE(token text, full_url text, level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token TEXT;
  _root_token TEXT;
  _parent_level INTEGER;
  _new_level INTEGER;
  _eoa_id UUID;
  _deck_slug TEXT;
  _utm_campaign TEXT;
  _utm_id TEXT;
  _utm_source TEXT;
  _full_url TEXT;
BEGIN
  SELECT 
    root_token,
    tokens.level,
    eoa_id,
    deck_slug,
    utm_campaign,
    utm_id
  INTO 
    _root_token,
    _parent_level,
    _eoa_id,
    _deck_slug,
    _utm_campaign,
    _utm_id
  FROM public.tokens
  WHERE tokens.token = _parent_token;
  
  IF _parent_level IS NULL THEN
    RAISE EXCEPTION 'Parent token not found';
  END IF;
  
  _new_level := _parent_level + 1;
  
  IF _new_level > 3 THEN
    RAISE EXCEPTION 'Maximum share level (L03) reached';
  END IF;
  
  _token := public.generate_token();
  _utm_source := format('L%s', lpad(_new_level::TEXT, 2, '0'));
  
  _full_url := format(
    'https://omega-resist.lovable.app/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&t=%s&p=%s&v_lvl=%s',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    _token,
    _parent_token,
    lpad(_new_level::TEXT, 2, '0')
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
    _parent_token,
    _root_token,
    _new_level,
    _eoa_id,
    _deck_slug,
    _utm_campaign,
    _utm_id,
    NULL,
    _utm_medium,
    _utm_source,
    _full_url,
    auth.uid()
  );
  
  RETURN QUERY SELECT _token, _full_url, _new_level;
END;
$function$;