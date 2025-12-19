-- Create RPC function to instantiate L00 tokens
-- This function is SECURITY DEFINER so it can access tokens table regardless of user auth
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
  -- Replace the token parameter in the existing full_url
  _full_url := regexp_replace(
    _token_data.full_url,
    't=[^&]+',
    't=' || _instance_token
  );

  -- Insert the instance token
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
    deck_version_at_mint
  ) VALUES (
    _instance_token,
    _base_token,
    _base_token,
    0,  -- Still L00 semantically
    _token_data.eoa_id,
    _token_data.deck_slug,
    _token_data.utm_campaign,
    _token_data.utm_id,
    _token_data.utm_content,
    _token_data.utm_medium,
    _token_data.utm_source,
    _full_url,
    _token_data.deck_version_at_mint
  );

  RETURN QUERY SELECT _instance_token, _full_url;
END;
$$;