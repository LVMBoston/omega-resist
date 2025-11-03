-- Update shorten_url function to use /r/ instead of /s/ to avoid browser share conflicts
CREATE OR REPLACE FUNCTION public.shorten_url(_full_url TEXT)
RETURNS TABLE(short_code TEXT, short_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _short_code TEXT;
  _short_url TEXT;
BEGIN
  -- Check if URL already exists
  SELECT shortened_urls.short_code INTO _short_code
  FROM shortened_urls
  WHERE shortened_urls.full_url = _full_url;
  
  -- If not found, generate new short code
  IF _short_code IS NULL THEN
    _short_code := generate_short_code();
    
    INSERT INTO shortened_urls (
      short_code,
      full_url,
      created_by
    ) VALUES (
      _short_code,
      _full_url,
      auth.uid()
    );
  END IF;
  
  _short_url := 'https://omega-resist.lovable.app/r/' || _short_code;
  
  RETURN QUERY SELECT _short_code, _short_url;
END;
$$;