ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS official_start_at timestamptz NULL;

COMMENT ON COLUMN public.campaigns.official_start_at IS
  'Optional override: reporting/visualization start time. Events before this are pre-launch/test.';

DROP FUNCTION IF EXISTS public.get_campaign_map_events(text);
DROP FUNCTION IF EXISTS public.get_campaign_map_events(text, timestamptz);

CREATE FUNCTION public.get_campaign_map_events(
  _campaign_code text,
  _since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  latitude double precision,
  longitude double precision,
  utm_medium text,
  level int,
  spawn_count int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH camp AS (
    SELECT id FROM public.campaigns WHERE code = _campaign_code LIMIT 1
  ),
  toks AS (
    SELECT t.token, t.level, t.utm_medium, t.root_token
    FROM public.tokens t
    JOIN public.events_actions ea ON ea.id = t.eoa_id
    JOIN camp c ON c.id = ea.campaign_id
    WHERE t.is_simulated = false
      AND t.deleted_at IS NULL
  ),
  spawn_counts AS (
    SELECT root_token AS token, COUNT(*)::int AS spawn_count
    FROM toks
    WHERE root_token IS NOT NULL AND root_token <> token
    GROUP BY root_token
  )
  SELECT
    e.id AS event_id,
    e.latitude,
    e.longitude,
    COALESCE(t.utm_medium, 'qr') AS utm_medium,
    COALESCE(t.level, 0) AS level,
    COALESCE(sc.spawn_count, 0) AS spawn_count
  FROM public.url_events e
  JOIN toks t ON t.token = e.token
  LEFT JOIN spawn_counts sc ON sc.token = e.token
  WHERE e.event_type = 'view'
    AND e.is_simulated = false
    AND e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.deleted_at IS NULL
    AND (_since IS NULL OR e.occurred_at >= _since);
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_map_events(text, timestamptz) TO anon, authenticated;