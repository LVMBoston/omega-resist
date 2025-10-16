-- Create function to lookup coordinates from zip codes
CREATE OR REPLACE FUNCTION public.get_coordinates_from_zip(p_zip_code text)
RETURNS TABLE(
  latitude numeric,
  longitude numeric,
  city text,
  state_name text,
  timezone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    z.latitude,
    z.longitude,
    z.city,
    z.state_name,
    z.timezone
  FROM public.zip_codes z
  WHERE z.zip_code = p_zip_code
  LIMIT 1;
END;
$function$;

-- Backfill existing url_events with zip code data where coordinates are missing
UPDATE public.url_events
SET 
  latitude = zc.latitude,
  longitude = zc.longitude,
  city = COALESCE(url_events.city, zc.city),
  region = COALESCE(url_events.region, zc.state_name)
FROM public.zip_codes zc
WHERE url_events.zip_code = zc.zip_code
  AND url_events.latitude IS NULL
  AND url_events.longitude IS NULL;