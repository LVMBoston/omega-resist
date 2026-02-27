
-- Fix get_campaign_stats: add is_simulated = false filter to token_stats CTE
CREATE OR REPLACE FUNCTION public.get_campaign_stats(campaign_codes text[])
 RETURNS TABLE(campaign_code text, earliest_active timestamp with time zone, latest_active timestamp with time zone, real_data_rows bigint, sim_data_rows bigint, l0_count bigint, l1_count bigint, l2_count bigint, l3_plus_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH token_stats AS (
    SELECT 
      t.utm_campaign,
      COUNT(*) FILTER (WHERE t.level = 0) as l0_count,
      COUNT(*) FILTER (WHERE t.level = 1) as l1_count,
      COUNT(*) FILTER (WHERE t.level = 2) as l2_count,
      COUNT(*) FILTER (WHERE t.level >= 3) as l3_plus_count
    FROM tokens t
    WHERE t.utm_campaign = ANY(campaign_codes)
      AND t.deleted_at IS NULL
      AND t.is_simulated = false
    GROUP BY t.utm_campaign
  ),
  event_stats AS (
    SELECT 
      t.utm_campaign,
      MIN(e.occurred_at) FILTER (WHERE NOT e.is_simulated) as earliest_active,
      MAX(e.occurred_at) FILTER (WHERE NOT e.is_simulated) as latest_active,
      COUNT(*) FILTER (WHERE NOT e.is_simulated) as real_data_rows,
      COUNT(*) FILTER (WHERE e.is_simulated) as sim_data_rows
    FROM tokens t
    JOIN url_events e ON e.token = t.token
    WHERE t.utm_campaign = ANY(campaign_codes)
      AND t.deleted_at IS NULL
      AND e.deleted_at IS NULL
    GROUP BY t.utm_campaign
  )
  SELECT 
    ts.utm_campaign as campaign_code,
    es.earliest_active,
    es.latest_active,
    COALESCE(es.real_data_rows, 0) as real_data_rows,
    COALESCE(es.sim_data_rows, 0) as sim_data_rows,
    COALESCE(ts.l0_count, 0) as l0_count,
    COALESCE(ts.l1_count, 0) as l1_count,
    COALESCE(ts.l2_count, 0) as l2_count,
    COALESCE(ts.l3_plus_count, 0) as l3_plus_count
  FROM token_stats ts
  LEFT JOIN event_stats es ON es.utm_campaign = ts.utm_campaign;
$function$;
