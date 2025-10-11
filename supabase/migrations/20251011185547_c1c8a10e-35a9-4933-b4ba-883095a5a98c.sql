-- Add soft deletion columns to relevant tables
ALTER TABLE public.url_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for soft deletion queries
CREATE INDEX IF NOT EXISTS idx_url_events_deleted_at ON public.url_events(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_deleted_at ON public.tokens(deleted_at) WHERE deleted_at IS NULL;

-- Create dashboard_shares table for shareable read-only links
CREATE TABLE IF NOT EXISTS public.dashboard_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code TEXT UNIQUE NOT NULL,
  campaign_id TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  view_count INTEGER DEFAULT 0 NOT NULL,
  last_viewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on dashboard_shares
ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;

-- Admins can manage all shares
CREATE POLICY "Admins can manage all dashboard shares"
ON public.dashboard_shares
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can view active, non-expired shares (for the shareable link feature)
CREATE POLICY "Public can view active dashboard shares"
ON public.dashboard_shares
FOR SELECT
TO anon
USING (
  is_active = true 
  AND expires_at > now()
);

-- Create function to generate unique share codes
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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