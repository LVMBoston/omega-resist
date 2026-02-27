
-- 1. Fix the trigger function pattern (ILIKE 'test%' instead of LIKE 'TEST-%')
CREATE OR REPLACE FUNCTION mark_test_eoa_tokens()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.events_actions
    WHERE id = NEW.eoa_id
      AND mobilize_code ILIKE 'test%'
  ) THEN
    NEW.is_simulated := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2. Patch existing tokens
UPDATE tokens SET is_simulated = true
WHERE eoa_id IN (
  SELECT id FROM events_actions WHERE mobilize_code ILIKE 'test%'
) AND is_simulated = false;

-- 3. Patch existing url_events
UPDATE url_events SET is_simulated = true
WHERE token IN (
  SELECT token FROM tokens
  WHERE eoa_id IN (
    SELECT id FROM events_actions WHERE mobilize_code ILIKE 'test%'
  )
) AND is_simulated = false;
