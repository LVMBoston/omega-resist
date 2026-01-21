-- Create function to re-instantiate L00 token when accessed from a different zip code
-- This distinguishes between different persons who received the same URL via direct share

CREATE OR REPLACE FUNCTION public.maybe_reinstantiate_l00(
  _instance_token text,
  _current_zip_code text
)
RETURNS TABLE(new_instance_token text, was_reinstantiated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _original_zip TEXT;
  _base_token TEXT;
  _suffix TEXT;
  _new_token TEXT;
  _token_data RECORD;
  _new_full_url TEXT;
BEGIN
  -- Only process L00 instance tokens (contains colon)
  IF NOT _instance_token LIKE 'l00-%:%' THEN
    RETURN QUERY SELECT _instance_token, false;
    RETURN;
  END IF;
  
  -- Skip if no zip code provided (can't determine location difference)
  IF _current_zip_code IS NULL OR _current_zip_code = '' THEN
    RETURN QUERY SELECT _instance_token, false;
    RETURN;
  END IF;

  -- Get the original zip code from the first event logged for this instance
  SELECT zip_code INTO _original_zip
  FROM public.url_events
  WHERE token = _instance_token
    AND zip_code IS NOT NULL
    AND zip_code != ''
  ORDER BY occurred_at ASC
  LIMIT 1;

  -- If no prior events exist (this is the first view), keep the current token
  IF _original_zip IS NULL THEN
    RETURN QUERY SELECT _instance_token, false;
    RETURN;
  END IF;

  -- If zip codes match, keep the current token (same person or same location)
  IF _original_zip = _current_zip_code THEN
    RETURN QUERY SELECT _instance_token, false;
    RETURN;
  END IF;

  -- Different zip code detected! Create a new instance token
  -- Extract base token (everything before the colon)
  _base_token := split_part(_instance_token, ':', 1);
  
  -- Fetch the original instance token data
  SELECT * INTO _token_data
  FROM public.tokens
  WHERE token = _instance_token;

  IF _token_data IS NULL THEN
    -- Token not found, return original
    RETURN QUERY SELECT _instance_token, false;
    RETURN;
  END IF;

  -- Generate new 6-character random suffix
  _suffix := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  _new_token := _base_token || ':' || _suffix;

  -- Build the new URL with the new instance token
  _new_full_url := regexp_replace(
    _token_data.full_url,
    't=[^&]+',
    't=' || _new_token
  );

  -- Insert the new instance token
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
    _new_token,
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
    _new_full_url,
    _token_data.deck_version_at_mint,
    _new_token  -- New instance points to itself
  );

  RAISE NOTICE 'Re-instantiated L00 token: % -> % (zip changed from % to %)',
    _instance_token, _new_token, _original_zip, _current_zip_code;

  RETURN QUERY SELECT _new_token, true;
END;
$$;