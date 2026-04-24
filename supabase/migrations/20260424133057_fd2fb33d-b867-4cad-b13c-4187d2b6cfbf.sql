CREATE OR REPLACE FUNCTION public.log_event(
  _token text,
  _event_type text,
  _utm_snapshot jsonb DEFAULT NULL::jsonb,
  _ip_address inet DEFAULT NULL::inet,
  _user_agent text DEFAULT NULL::text,
  _latitude numeric DEFAULT NULL::numeric,
  _longitude numeric DEFAULT NULL::numeric,
  _city text DEFAULT NULL::text,
  _region text DEFAULT NULL::text,
  _country text DEFAULT NULL::text,
  _country_code text DEFAULT NULL::text,
  _zip_code text DEFAULT NULL::text,
  _location_source text DEFAULT 'unknown'::text,
  _occurred_at timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event_id UUID;
  _token_level INTEGER;
  _recent_event_count INTEGER;
  _rate_limit_window INTERVAL := '1 minute';
  _max_events_per_window INTEGER := 10;
BEGIN
  IF _event_type NOT IN ('scan', 'view', 'share') THEN
    RAISE EXCEPTION 'Invalid event_type: must be scan, view, or share';
  END IF;
  
  IF _location_source NOT IN ('gps', 'ip', 'unknown') THEN
    RAISE EXCEPTION 'Invalid location_source: must be gps, ip, or unknown';
  END IF;
  
  SELECT level INTO _token_level
  FROM public.tokens
  WHERE token = _token;
  
  IF _token_level IS NULL THEN
    RAISE EXCEPTION 'Token not found: %', _token;
  END IF;
  
  IF _token_level > 0 AND _ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO _recent_event_count
    FROM public.url_events
    WHERE token = _token
      AND ip_address = _ip_address
      AND occurred_at > (now() - _rate_limit_window);
    
    IF _recent_event_count >= _max_events_per_window THEN
      RAISE EXCEPTION 'Rate limit exceeded: max % events per % for level % tokens (IP: %)', 
        _max_events_per_window, 
        _rate_limit_window,
        _token_level,
        _ip_address;
    END IF;
  END IF;
  
  INSERT INTO public.url_events (
    token,
    event_type,
    utm_snapshot,
    ip_address,
    user_agent,
    latitude,
    longitude,
    city,
    region,
    country,
    country_code,
    zip_code,
    location_source,
    occurred_at
  ) VALUES (
    _token,
    _event_type,
    _utm_snapshot,
    _ip_address,
    _user_agent,
    _latitude,
    _longitude,
    _city,
    _region,
    _country,
    _country_code,
    _zip_code,
    _location_source,
    COALESCE(_occurred_at, now())
  )
  RETURNING id INTO _event_id;
  
  RETURN _event_id;
END;
$function$;