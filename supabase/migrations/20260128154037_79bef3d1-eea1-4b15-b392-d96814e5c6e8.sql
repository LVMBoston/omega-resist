-- Create batch URL shortening function to reduce N+1 queries
CREATE OR REPLACE FUNCTION shorten_urls_batch(_full_urls text[])
RETURNS TABLE(full_url text, short_code text, short_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _code text;
  _base_url text := 'https://omega-resist.lovable.app/r/';
BEGIN
  -- Process each URL
  FOREACH _url IN ARRAY _full_urls
  LOOP
    -- Check if URL already exists
    SELECT su.short_code INTO _code
    FROM shortened_urls su
    WHERE su.full_url = _url;
    
    IF _code IS NULL THEN
      -- Generate new short code
      _code := generate_short_code();
      
      -- Insert new record
      INSERT INTO shortened_urls (full_url, short_code, created_by)
      VALUES (_url, _code, auth.uid());
    END IF;
    
    full_url := _url;
    short_code := _code;
    short_url := _base_url || _code;
    RETURN NEXT;
  END LOOP;
END;
$$;