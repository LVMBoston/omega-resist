CREATE OR REPLACE FUNCTION public.get_nearest_zip_code(p_latitude numeric, p_longitude numeric)
RETURNS TABLE(zip_code text, city text, state_name text, latitude numeric, longitude numeric, distance_km numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    z.zip_code,
    z.city,
    z.state_name,
    z.latitude,
    z.longitude,
    (6371 * acos(
      cos(radians(p_latitude)) * cos(radians(z.latitude)) * 
      cos(radians(z.longitude) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * sin(radians(z.latitude))
    ))::numeric as distance_km
  FROM public.zip_codes z
  ORDER BY (z.latitude - p_latitude)^2 + (z.longitude - p_longitude)^2
  LIMIT 1;
$$;