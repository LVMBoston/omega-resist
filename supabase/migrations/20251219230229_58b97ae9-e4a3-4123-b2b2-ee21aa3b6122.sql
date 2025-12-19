-- Modify mint_share to cap at L03 instead of blocking
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
  
  -- Cap at L03 instead of blocking
  _new_level := LEAST(_parent_level + 1, 3);
  
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