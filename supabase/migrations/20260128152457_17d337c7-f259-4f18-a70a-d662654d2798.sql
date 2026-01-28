-- Create function to efficiently get first view dates for EoAs
-- This replaces the expensive client-side fetching of all url_events
CREATE OR REPLACE FUNCTION public.get_first_view_by_eoa_ids(eoa_ids uuid[])
RETURNS TABLE(eoa_id uuid, mobilize_code text, first_view_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH eoa_mobilize AS (
    -- Get mobilize_code for each EoA
    SELECT ea.id as eoa_id, ea.mobilize_code
    FROM events_actions ea
    WHERE ea.id = ANY(eoa_ids)
  ),
  token_first_views AS (
    -- Get first view per token, then per EoA
    SELECT DISTINCT ON (t.eoa_id)
      t.eoa_id,
      e.occurred_at as first_view_at
    FROM tokens t
    JOIN url_events e ON e.token = t.token
    WHERE t.eoa_id = ANY(eoa_ids)
      AND t.is_simulated = false
      AND e.event_type = 'view'
      AND e.is_simulated = false
      AND t.deleted_at IS NULL
      AND e.deleted_at IS NULL
    ORDER BY t.eoa_id, e.occurred_at ASC
  )
  SELECT 
    em.eoa_id,
    em.mobilize_code,
    tfv.first_view_at
  FROM eoa_mobilize em
  LEFT JOIN token_first_views tfv ON tfv.eoa_id = em.eoa_id;
$$;