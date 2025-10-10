-- Create shortened_urls table for URL shortening
CREATE TABLE public.shortened_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_code TEXT NOT NULL UNIQUE,
  full_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  clicks INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.shortened_urls ENABLE ROW LEVEL SECURITY;

-- Anyone can read shortened URLs (needed for redirects)
CREATE POLICY "Anyone can view shortened_urls"
ON public.shortened_urls
FOR SELECT
USING (true);

-- Authenticated users can create shortened URLs
CREATE POLICY "Authenticated users can create shortened_urls"
ON public.shortened_urls
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can manage all shortened URLs
CREATE POLICY "Admins can manage shortened_urls"
ON public.shortened_urls
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create function to generate short codes
CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-character alphanumeric code
    new_code := substring(md5(random()::text || clock_timestamp()::text) from 1 for 6);
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM shortened_urls WHERE short_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create function to shorten URL
CREATE OR REPLACE FUNCTION public.shorten_url(_full_url TEXT)
RETURNS TABLE(short_code TEXT, short_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _short_code TEXT;
  _short_url TEXT;
BEGIN
  -- Check if URL already shortened
  SELECT shortened_urls.short_code INTO _short_code
  FROM public.shortened_urls
  WHERE full_url = _full_url
  LIMIT 1;
  
  -- If not found, create new short code
  IF _short_code IS NULL THEN
    _short_code := public.generate_short_code();
    
    INSERT INTO public.shortened_urls (
      short_code,
      full_url,
      created_by
    ) VALUES (
      _short_code,
      _full_url,
      auth.uid()
    );
  END IF;
  
  _short_url := 'https://omega-resist.lovable.app/s/' || _short_code;
  
  RETURN QUERY SELECT _short_code, _short_url;
END;
$$;

-- Create function to increment click count
CREATE OR REPLACE FUNCTION public.track_redirect(_short_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_url TEXT;
BEGIN
  -- Get full URL and increment clicks
  UPDATE public.shortened_urls
  SET clicks = clicks + 1
  WHERE short_code = _short_code
  RETURNING full_url INTO _full_url;
  
  RETURN _full_url;
END;
$$;