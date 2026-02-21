
-- Trigger 1: Auto-flag tokens minted for TEST- EoAs as simulated
CREATE OR REPLACE FUNCTION public.mark_test_eoa_tokens()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.events_actions
    WHERE id = NEW.eoa_id
      AND mobilize_code LIKE 'TEST-%'
  ) THEN
    NEW.is_simulated := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_mark_test_eoa_tokens
  BEFORE INSERT ON public.tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_test_eoa_tokens();

-- Trigger 2: Auto-flag url_events when their parent token is simulated
CREATE OR REPLACE FUNCTION public.mark_test_token_events()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tokens
    WHERE token = NEW.token AND is_simulated = true
  ) THEN
    NEW.is_simulated := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_mark_test_token_events
  BEFORE INSERT ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_test_token_events();
