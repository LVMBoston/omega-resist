-- Update track_redirect to log events before redirecting
CREATE OR REPLACE FUNCTION public.track_redirect(_short_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _full_url TEXT;
  _token TEXT;
  _query_params TEXT;
BEGIN
  -- Get full URL and increment clicks
  UPDATE public.shortened_urls
  SET clicks = clicks + 1
  WHERE short_code = _short_code
  RETURNING full_url INTO _full_url;
  
  IF _full_url IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Extract token from URL (after t= parameter)
  _query_params := split_part(_full_url, '?', 2);
  
  IF _query_params IS NOT NULL AND _query_params LIKE '%t=%' THEN
    -- Extract token value (everything between t= and next & or end of string)
    _token := split_part(
      split_part(_query_params || '&', 't=', 2),
      '&',
      1
    );
    
    -- Log a 'view' event for this token
    IF _token IS NOT NULL AND _token != '' THEN
      INSERT INTO public.url_events (
        token,
        event_type,
        occurred_at
      ) VALUES (
        _token,
        'view',
        now()
      );
    END IF;
  END IF;
  
  RETURN _full_url;
END;
$function$;