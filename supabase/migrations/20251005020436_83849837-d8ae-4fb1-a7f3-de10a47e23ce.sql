-- Drop existing policies on url_events to replace with stricter ones
DROP POLICY IF EXISTS "Anyone can insert url_events" ON public.url_events;
DROP POLICY IF EXISTS "Admins and managers can view url_events" ON public.url_events;

-- Drop existing policies on daily_aggregates to make it read-only
DROP POLICY IF EXISTS "Anyone can view daily_aggregates" ON public.daily_aggregates;
DROP POLICY IF EXISTS "Admins and managers can manage daily_aggregates" ON public.daily_aggregates;

-- Update url_events RLS: Only via log_event() function, but allow viewing
CREATE POLICY "Admins and managers can view url_events"
  ON public.url_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Update daily_aggregates RLS: Read-only for everyone
CREATE POLICY "Anyone can view daily_aggregates"
  ON public.daily_aggregates FOR SELECT
  USING (true);

-- Create function to generate unique token
CREATE OR REPLACE FUNCTION public.generate_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric token
    new_token := substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.tokens WHERE token = new_token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;

-- Create function to mint L00 tokens
CREATE OR REPLACE FUNCTION public.mint_l00(
  _eoa_id UUID,
  _placement_id UUID,
  _deck_slug TEXT,
  _utm_medium TEXT DEFAULT 'qrcode'
)
RETURNS TABLE(token TEXT, full_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token TEXT;
  _campaign_id UUID;
  _utm_campaign TEXT;
  _utm_id TEXT;
  _utm_content TEXT;
  _utm_source TEXT;
  _full_url TEXT;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  
  -- Check if user has permission (admin or manager)
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or manager can mint tokens';
  END IF;
  
  -- Get campaign details from EoA
  SELECT ea.campaign_id, ea.utm_id, c.code
  INTO _campaign_id, _utm_id, _utm_campaign
  FROM public.events_actions ea
  JOIN public.campaigns c ON ea.campaign_id = c.id
  WHERE ea.id = _eoa_id;
  
  IF _campaign_id IS NULL THEN
    RAISE EXCEPTION 'EoA not found';
  END IF;
  
  -- Generate token
  _token := public.generate_token();
  
  -- Set UTM parameters
  _utm_source := 'L00';
  _utm_content := (SELECT code FROM public.placements WHERE id = _placement_id);
  
  -- Build full URL
  _full_url := format(
    'https://app.democracyforge.org/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&utm_content=%s&t=%s&v_lvl=00',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    _utm_content,
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
    placement_id,
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
    _placement_id,
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
$$;

-- Create function to mint share tokens (L01-L03)
CREATE OR REPLACE FUNCTION public.mint_share(
  _parent_token TEXT,
  _utm_medium TEXT
)
RETURNS TABLE(token TEXT, full_url TEXT, level INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token TEXT;
  _root_token TEXT;
  _parent_level INTEGER;
  _new_level INTEGER;
  _eoa_id UUID;
  _deck_slug TEXT;
  _utm_campaign TEXT;
  _utm_id TEXT;
  _utm_source TEXT;
  _full_url TEXT;
BEGIN
  -- Get parent token details
  SELECT 
    root_token,
    tokens.level,
    eoa_id,
    deck_slug,
    utm_campaign,
    utm_id
  INTO 
    _root_token,
    _parent_level,
    _eoa_id,
    _deck_slug,
    _utm_campaign,
    _utm_id
  FROM public.tokens
  WHERE tokens.token = _parent_token;
  
  IF _parent_level IS NULL THEN
    RAISE EXCEPTION 'Parent token not found';
  END IF;
  
  -- Calculate new level
  _new_level := _parent_level + 1;
  
  IF _new_level > 3 THEN
    RAISE EXCEPTION 'Maximum share level (L03) reached';
  END IF;
  
  -- Generate new token
  _token := public.generate_token();
  
  -- Set UTM source based on level
  _utm_source := format('L%s', lpad(_new_level::TEXT, 2, '0'));
  
  -- Build full URL
  _full_url := format(
    'https://app.democracyforge.org/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s&t=%s&p=%s&v_lvl=%s',
    _deck_slug,
    _utm_campaign,
    _utm_id,
    _utm_source,
    _utm_medium,
    _token,
    _parent_token,
    lpad(_new_level::TEXT, 2, '0')
  );
  
  -- Insert new token
  INSERT INTO public.tokens (
    token,
    parent_token,
    root_token,
    level,
    eoa_id,
    deck_slug,
    placement_id,
    utm_campaign,
    utm_id,
    utm_content,
    utm_medium,
    utm_source,
    full_url,
    created_by
  ) VALUES (
    _token,
    _parent_token,
    _root_token,
    _new_level,
    _eoa_id,
    _deck_slug,
    NULL,
    _utm_campaign,
    _utm_id,
    NULL,
    _utm_medium,
    _utm_source,
    _full_url,
    auth.uid()
  );
  
  RETURN QUERY SELECT _token, _full_url, _new_level;
END;
$$;

-- Create function to log URL events
CREATE OR REPLACE FUNCTION public.log_event(
  _token TEXT,
  _event_type TEXT,
  _utm_snapshot JSONB DEFAULT NULL,
  _ip_address INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
  _token_exists BOOLEAN;
BEGIN
  -- Validate event type
  IF _event_type NOT IN ('scan', 'view', 'share') THEN
    RAISE EXCEPTION 'Invalid event_type: must be scan, view, or share';
  END IF;
  
  -- Check if token exists
  SELECT EXISTS(SELECT 1 FROM public.tokens WHERE token = _token) INTO _token_exists;
  
  IF NOT _token_exists THEN
    RAISE EXCEPTION 'Token not found: %', _token;
  END IF;
  
  -- Insert event
  INSERT INTO public.url_events (
    token,
    event_type,
    utm_snapshot,
    ip_address,
    user_agent,
    occurred_at
  ) VALUES (
    _token,
    _event_type,
    _utm_snapshot,
    _ip_address,
    _user_agent,
    now()
  )
  RETURNING id INTO _event_id;
  
  RETURN _event_id;
END;
$$;

-- Create materialized view for daily aggregates (replace table approach)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_aggregates_mv AS
SELECT
  date_trunc('day', e.occurred_at)::date as date,
  t.eoa_id,
  ea.campaign_id,
  t.deck_slug,
  t.placement_id,
  t.level,
  t.root_token,
  COUNT(*) FILTER (WHERE e.event_type = 'scan') as scans,
  COUNT(*) FILTER (WHERE e.event_type = 'view') as views,
  COUNT(*) FILTER (WHERE e.event_type = 'share') as shares,
  COUNT(DISTINCT t.token) as unique_tokens
FROM public.url_events e
JOIN public.tokens t ON e.token = t.token
JOIN public.events_actions ea ON t.eoa_id = ea.id
GROUP BY 1, 2, 3, 4, 5, 6, 7;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_agg_mv_unique 
ON public.daily_aggregates_mv (date, campaign_id, eoa_id, deck_slug, COALESCE(placement_id::text, 'null'), level, root_token);

-- Create function to refresh daily aggregates
CREATE OR REPLACE FUNCTION public.refresh_daily_aggregates()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_aggregates_mv;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.daily_aggregates_mv TO authenticated;
GRANT SELECT ON public.daily_aggregates_mv TO anon;