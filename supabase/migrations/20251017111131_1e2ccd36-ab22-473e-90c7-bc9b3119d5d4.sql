-- Fix track_redirect to handle errors gracefully
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
  _token_exists BOOLEAN;
BEGIN
  -- Get full URL and increment clicks
  UPDATE public.shortened_urls
  SET clicks = clicks + 1
  WHERE short_code = _short_code
  RETURNING full_url INTO _full_url;
  
  IF _full_url IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Try to extract token and log event, but don't fail if it doesn't work
  BEGIN
    _query_params := split_part(_full_url, '?', 2);
    
    IF _query_params IS NOT NULL AND _query_params LIKE '%t=%' THEN
      -- Extract token value
      _token := split_part(
        split_part(_query_params || '&', 't=', 2),
        '&',
        1
      );
      
      -- Check if token exists in tokens table
      IF _token IS NOT NULL AND _token != '' THEN
        SELECT EXISTS(SELECT 1 FROM public.tokens WHERE token = _token) INTO _token_exists;
        
        -- Only log event if token exists
        IF _token_exists THEN
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
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but continue with redirect
      RAISE WARNING 'Failed to log event for shortened URL: %', SQLERRM;
  END;
  
  -- Always return the full URL for redirect
  RETURN _full_url;
END;
$function$;