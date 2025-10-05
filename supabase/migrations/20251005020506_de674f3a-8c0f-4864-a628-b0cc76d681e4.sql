-- Fix function search path for generate_token
DROP FUNCTION IF EXISTS public.generate_token();

CREATE OR REPLACE FUNCTION public.generate_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric token
    new_token := substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM tokens WHERE token = new_token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;

-- Hide materialized view from API by revoking access
REVOKE ALL ON public.daily_aggregates_mv FROM authenticated;
REVOKE ALL ON public.daily_aggregates_mv FROM anon;
REVOKE ALL ON public.daily_aggregates_mv FROM public;

-- Update refresh function to populate the regular daily_aggregates table instead
DROP FUNCTION IF EXISTS public.refresh_daily_aggregates();

CREATE OR REPLACE FUNCTION public.refresh_daily_aggregates()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear existing aggregates
  DELETE FROM daily_aggregates;
  
  -- Populate from materialized view
  INSERT INTO daily_aggregates (
    date,
    campaign_id,
    eoa_id,
    deck_slug,
    placement_id,
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
    t.placement_id,
    t.level,
    COUNT(*) FILTER (WHERE e.event_type = 'scan') as scans,
    COUNT(*) FILTER (WHERE e.event_type = 'view') as views,
    COUNT(*) FILTER (WHERE e.event_type = 'share') as shares,
    COUNT(DISTINCT t.token) as unique_tokens
  FROM url_events e
  JOIN tokens t ON e.token = t.token
  JOIN events_actions ea ON t.eoa_id = ea.id
  GROUP BY 1, 2, 3, 4, 5, 6;
END;
$$;