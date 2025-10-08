-- Drop the materialized view that depends on placement_id
DROP MATERIALIZED VIEW IF EXISTS daily_aggregates_mv CASCADE;

-- Add utm_content to events_actions table
ALTER TABLE public.events_actions
ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Remove placement_id from tokens table
ALTER TABLE public.tokens
DROP COLUMN IF EXISTS placement_id;

-- Drop placements table
DROP TABLE IF EXISTS public.placements CASCADE;

-- Update daily_aggregates to remove placement_id
ALTER TABLE public.daily_aggregates
DROP COLUMN IF EXISTS placement_id;

-- Update mint_l00 function to use utm_content from event
CREATE OR REPLACE FUNCTION public.mint_l00(_eoa_id uuid, _deck_slug text, _utm_medium text DEFAULT 'qr'::text, _utm_content text DEFAULT NULL::text)
 RETURNS TABLE(token text, full_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token TEXT;
  _campaign_id UUID;
  _utm_campaign TEXT;
  _utm_id TEXT;
  _utm_source TEXT;
  _full_url TEXT;
  _user_id UUID;
  _event_utm_content TEXT;
BEGIN
  _user_id := auth.uid();
  
  -- Check if user has permission (admin or manager)
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or manager can mint tokens';
  END IF;
  
  -- Get campaign details and utm_content from EoA
  SELECT ea.campaign_id, ea.utm_id, c.code, ea.utm_content
  INTO _campaign_id, _utm_id, _utm_campaign, _event_utm_content
  FROM public.events_actions ea
  JOIN public.campaigns c ON ea.campaign_id = c.id
  WHERE ea.id = _eoa_id;
  
  IF _campaign_id IS NULL THEN
    RAISE EXCEPTION 'EoA not found';
  END IF;
  
  -- Use provided utm_content or fall back to event's utm_content
  _utm_content := COALESCE(_utm_content, _event_utm_content);
  
  -- Generate token
  _token := public.generate_token();
  
  -- Set UTM parameters
  _utm_source := 'L00';
  
  -- Build full URL
  _full_url := format(
    'https://app.democracyforge.org/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&utm_content=%s&t=%s&v_lvl=00',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    COALESCE(_utm_content, ''),
    _token
  );
  
  -- Insert token record
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
    NULL,
    _token,
    0,
    _eoa_id,
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_content,
    _utm_medium,
    _utm_source,
    _full_url,
    _user_id
  );
  
  RETURN QUERY SELECT _token, _full_url;
END;
$function$;

-- Update refresh_daily_aggregates function to not use placement_id
CREATE OR REPLACE FUNCTION public.refresh_daily_aggregates()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Clear existing aggregates
  DELETE FROM daily_aggregates;
  
  -- Populate from url_events
  INSERT INTO daily_aggregates (
    date,
    campaign_id,
    eoa_id,
    deck_slug,
    level,
    scans,
    views,
    shares,
    unique_tokens
  )
  SELECT
    date_trunc('day', e.occurred_at)::date as date,
    ea.campaign_id,
    t.eoa_id,
    t.deck_slug,
    t.level,
    COUNT(*) FILTER (WHERE e.event_type = 'scan') as scans,
    COUNT(*) FILTER (WHERE e.event_type = 'view') as views,
    COUNT(*) FILTER (WHERE e.event_type = 'share') as shares,
    COUNT(DISTINCT t.token) as unique_tokens
  FROM url_events e
  JOIN tokens t ON e.token = t.token
  JOIN events_actions ea ON t.eoa_id = ea.id
  GROUP BY 1, 2, 3, 4, 5;
END;
$function$;