CREATE OR REPLACE FUNCTION public.clear_simulation_data(_campaign_code text DEFAULT NULL)
RETURNS TABLE(deleted_events integer, deleted_tokens integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted_events integer := 0;
  _deleted_tokens integer := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Permission denied: only admins or managers can clear simulation data';
  END IF;

  WITH deleted AS (
    DELETE FROM public.url_events ue
    USING public.tokens t
    WHERE ue.token = t.token
      AND ue.is_simulated = true
      AND (_campaign_code IS NULL OR t.utm_campaign = _campaign_code)
    RETURNING ue.id
  )
  SELECT count(*)::integer INTO _deleted_events FROM deleted;

  WITH deleted AS (
    DELETE FROM public.tokens t
    WHERE t.is_simulated = true
      AND (_campaign_code IS NULL OR t.utm_campaign = _campaign_code)
    RETURNING t.id
  )
  SELECT count(*)::integer INTO _deleted_tokens FROM deleted;

  RETURN QUERY SELECT _deleted_events, _deleted_tokens;
END;
$$;