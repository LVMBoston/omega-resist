-- Add l00_instance column to tokens table
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS l00_instance text;

-- Create index for fast filtering by l00_instance
CREATE INDEX IF NOT EXISTS idx_tokens_l00_instance ON public.tokens(l00_instance);

-- Backfill existing data using recursive CTE to find the L00 instance for each token
WITH RECURSIVE token_chain AS (
  -- Base case: L00 instance tokens (tokens with ':' that have a parent matching the base pattern)
  SELECT token, token as l00_instance
  FROM public.tokens
  WHERE token LIKE 'l00-%:%'
  
  UNION ALL
  
  -- Recursive case: inherit l00_instance from parent
  SELECT t.token, tc.l00_instance
  FROM public.tokens t
  JOIN token_chain tc ON t.parent_token = tc.token
)
UPDATE public.tokens t
SET l00_instance = tc.l00_instance
FROM token_chain tc
WHERE t.token = tc.token AND t.l00_instance IS NULL;

-- Update instantiate_l00_token to set l00_instance on new L00 instances
CREATE OR REPLACE FUNCTION public.instantiate_l00_token(_base_token text)
RETURNS TABLE(instance_token text, full_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _suffix TEXT;
  _instance_token TEXT;
  _full_url TEXT;
  _base_url TEXT;
  _token_data RECORD;
BEGIN
  -- Only process L00 tokens that haven't been instantiated yet
  IF NOT _base_token LIKE 'l00-%' OR _base_token LIKE '%:%' THEN
    RAISE EXCEPTION 'Token is not a base L00 or already instantiated: %', _base_token;
  END IF;

  -- Fetch the base token data
  SELECT * INTO _token_data
  FROM public.tokens
  WHERE token = _base_token;

  IF _token_data IS NULL THEN
    RAISE EXCEPTION 'Base token not found: %', _base_token;
  END IF;

  -- Generate 6-character random suffix
  _suffix := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  _instance_token := _base_token || ':' || _suffix;

  -- Build the new URL with instance token
  _full_url := regexp_replace(
    _token_data.full_url,
    't=[^&]+',
    't=' || _instance_token
  );

  -- Insert the instance token with l00_instance set to itself
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
    deck_version_at_mint,
    l00_instance
  ) VALUES (
    _instance_token,
    _base_token,
    _base_token,
    0,
    _token_data.eoa_id,
    _token_data.deck_slug,
    _token_data.utm_campaign,
    _token_data.utm_id,
    _token_data.utm_content,
    _token_data.utm_medium,
    _token_data.utm_source,
    _full_url,
    _token_data.deck_version_at_mint,
    _instance_token  -- L00 instance points to itself
  );

  RETURN QUERY SELECT _instance_token, _full_url;
END;
$$;

-- Update mint_share to inherit l00_instance from parent
CREATE OR REPLACE FUNCTION public.mint_share(_parent_token text, _utm_medium text)
RETURNS TABLE(token text, full_url text, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _token TEXT;
  _root_token TEXT;
  _l00_instance TEXT;
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
    utm_id,
    tokens.l00_instance
  INTO 
    _root_token,
    _parent_level,
    _eoa_id,
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _l00_instance
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
    created_by,
    l00_instance
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
    auth.uid(),
    _l00_instance  -- Inherit l00_instance from parent
  );
  
  RETURN QUERY SELECT _token, _full_url, _new_level;
END;
$function$;