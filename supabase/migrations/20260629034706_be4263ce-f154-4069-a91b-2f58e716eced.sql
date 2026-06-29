
-- 1) Extend url_events.event_type CHECK to allow refrig_* events
ALTER TABLE public.url_events
  DROP CONSTRAINT IF EXISTS url_events_event_type_check;

ALTER TABLE public.url_events
  ADD CONSTRAINT url_events_event_type_check
  CHECK (event_type IN ('scan','view','share','refrig_generated','refrig_scanned'));

-- 2) Update log_event() validation list to match
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
  IF _event_type NOT IN ('scan', 'view', 'share', 'refrig_generated', 'refrig_scanned') THEN
    RAISE EXCEPTION 'Invalid event_type: must be scan, view, share, refrig_generated, or refrig_scanned';
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
    token, event_type, utm_snapshot, ip_address, user_agent,
    latitude, longitude, city, region, country, country_code,
    zip_code, location_source, occurred_at
  ) VALUES (
    _token, _event_type, _utm_snapshot, _ip_address, _user_agent,
    _latitude, _longitude, _city, _region, _country, _country_code,
    _zip_code, _location_source, COALESCE(_occurred_at, now())
  )
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$function$;

-- 3) Add 'refrig' to mint_share medium whitelist
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
  _normalized_medium TEXT;
BEGIN
  _normalized_medium := lower(trim(_utm_medium));

  IF _normalized_medium IS NULL OR _normalized_medium = '' THEN
    RAISE EXCEPTION 'Share medium is required';
  END IF;

  IF _normalized_medium = 'qr' THEN
    RAISE EXCEPTION 'QR is reserved for Level 0 organizer seed tokens and cannot be used for viral shares';
  END IF;

  IF _normalized_medium NOT IN ('em', 'sms', 'tx', 'social', 'p2p', 'fb', 'bs', 'li', 'x', 'refrig') THEN
    RAISE EXCEPTION 'Invalid share medium: %', _utm_medium;
  END IF;

  SELECT
    root_token, tokens.level, eoa_id, deck_slug,
    utm_campaign, utm_id, tokens.l00_instance
  INTO
    _root_token, _parent_level, _eoa_id, _deck_slug,
    _utm_campaign, _utm_id, _l00_instance
  FROM public.tokens
  WHERE tokens.token = _parent_token;

  IF _parent_level IS NULL THEN
    RAISE EXCEPTION 'Parent token not found';
  END IF;

  _new_level := LEAST(_parent_level + 1, 3);

  _token := public.generate_token();
  _utm_source := format('L%s', lpad(_new_level::TEXT, 2, '0'));

  _full_url := format(
    'https://omega-resist.lovable.app/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&t=%s&p=%s&v_lvl=%s',
    _deck_slug, _utm_campaign, _utm_id, _utm_source,
    _normalized_medium, _token, _parent_token,
    lpad(_new_level::TEXT, 2, '0')
  );

  INSERT INTO public.tokens (
    token, parent_token, root_token, level, eoa_id, deck_slug,
    utm_campaign, utm_id, utm_content, utm_medium, utm_source,
    full_url, created_by, l00_instance
  ) VALUES (
    _token, _parent_token, _root_token, _new_level, _eoa_id, _deck_slug,
    _utm_campaign, _utm_id, NULL, _normalized_medium, _utm_source,
    _full_url, auth.uid(), _l00_instance
  );

  RETURN QUERY SELECT _token, _full_url, _new_level;
END;
$function$;
