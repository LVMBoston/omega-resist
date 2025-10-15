-- Create zip_codes table for comprehensive US zip code data
CREATE TABLE IF NOT EXISTS public.zip_codes (
  zip_code TEXT PRIMARY KEY,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(11, 7) NOT NULL,
  city TEXT,
  state_id TEXT,
  state_name TEXT,
  timezone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to zip codes
CREATE POLICY "Zip codes are publicly readable"
ON public.zip_codes
FOR SELECT
USING (true);

-- Allow admins to manage zip codes
CREATE POLICY "Admins can manage zip codes"
ON public.zip_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_zip_codes_lat_lng ON public.zip_codes(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_zip_codes_state ON public.zip_codes(state_id);

-- Add comment
COMMENT ON TABLE public.zip_codes IS 'Comprehensive US zip code database with lat/lon coordinates for simulator and geolocation features';