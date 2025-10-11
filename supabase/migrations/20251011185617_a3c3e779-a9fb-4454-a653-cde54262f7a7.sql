-- Fix search_path for generate_share_code function
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    
    -- Check if code already exists
    SELECT COUNT(*) INTO exists_count
    FROM public.dashboard_shares
    WHERE share_code = code;
    
    EXIT WHEN exists_count = 0;
  END LOOP;
  
  RETURN code;
END;
$$;