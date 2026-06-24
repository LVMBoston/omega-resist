
CREATE OR REPLACE FUNCTION public.get_campaign_map_events(_campaign_code text)
RETURNS TABLE (
  event_id uuid,
  latitude double precision,
  longitude double precision,
  utm_medium text,
  level integer,
  token text,
  spawn_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH camp AS (
    SELECT id FROM public.campaigns WHERE code = _campaign_code LIMIT 1
  ),
  eoa AS (
    SELECT id FROM public.events_actions WHERE campaign_id = (SELECT id FROM camp)
  ),
  tk AS (
    SELECT token, level, utm_medium, root_token
    FROM public.tokens
    WHERE eoa_id IN (SELECT id FROM eoa)
      AND is_simulated = false
  ),
  spawns AS (
    SELECT root_token, count(*)::int AS c
    FROM public.tokens
    WHERE root_token IN (SELECT token FROM tk WHERE level = 0)
      AND level > 0
      AND is_simulated = false
    GROUP BY root_token
  )
  SELECT
    e.id AS event_id,
    e.latitude,
    e.longitude,
    tk.utm_medium,
    tk.level,
    e.token,
    COALESCE(s.c, 0) AS spawn_count
  FROM public.url_events e
  JOIN tk ON tk.token = e.token
  LEFT JOIN spawns s ON s.root_token = e.token
  WHERE e.event_type = 'view'
    AND e.is_simulated = false
    AND e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_map_events(text) TO anon, authenticated, service_role;
