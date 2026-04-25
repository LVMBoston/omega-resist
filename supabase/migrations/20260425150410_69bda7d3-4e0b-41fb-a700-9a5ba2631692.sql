-- Drop the three older overloads of log_event that conflict with the newest signature.
-- Keep only the 14-arg version (with _location_source AND _occurred_at).
-- This resolves PostgREST PGRST203 "Could not choose the best candidate function" error
-- which was breaking view-event logging in the deck viewer.

DROP FUNCTION IF EXISTS public.log_event(
  _token text, _event_type text, _utm_snapshot jsonb, _ip_address inet, _user_agent text
);

DROP FUNCTION IF EXISTS public.log_event(
  _token text, _event_type text, _utm_snapshot jsonb, _ip_address inet, _user_agent text,
  _latitude numeric, _longitude numeric, _city text, _region text, _country text,
  _country_code text, _zip_code text
);

DROP FUNCTION IF EXISTS public.log_event(
  _token text, _event_type text, _utm_snapshot jsonb, _ip_address inet, _user_agent text,
  _latitude numeric, _longitude numeric, _city text, _region text, _country text,
  _country_code text, _zip_code text, _location_source text
);

-- Fix is_token_valid: it referenced a non-existent column "invalidated_at".
-- Tokens are soft-deleted via deleted_at only.
CREATE OR REPLACE FUNCTION public.is_token_valid(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.tokens 
    WHERE token = p_token 
      AND deleted_at IS NULL
  );
END;
$function$;