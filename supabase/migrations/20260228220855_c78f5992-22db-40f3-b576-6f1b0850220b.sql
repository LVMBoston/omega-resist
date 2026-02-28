
-- 1. Create campaign_message_overrides table
CREATE TABLE public.campaign_message_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mobilize_code text,
  category text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index using COALESCE for nullable mobilize_code
CREATE UNIQUE INDEX uq_campaign_msg_override
  ON public.campaign_message_overrides (
    campaign_id,
    COALESCE(mobilize_code, '__campaign__'),
    category,
    key
  );

-- Enable RLS
ALTER TABLE public.campaign_message_overrides ENABLE ROW LEVEL SECURITY;

-- Admin/manager can do everything
CREATE POLICY "Admins and managers can manage overrides"
  ON public.campaign_message_overrides
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Public SELECT (templates must be readable at share-time by unauthenticated viewers)
CREATE POLICY "Anyone can view message overrides"
  ON public.campaign_message_overrides
  FOR SELECT
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_campaign_message_overrides_updated_at
  BEFORE UPDATE ON public.campaign_message_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add campaign_type column to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN campaign_type text NOT NULL DEFAULT 'samizdat';

-- 3. Create resolve_message_template function
CREATE OR REPLACE FUNCTION public.resolve_message_template(
  p_campaign_id uuid,
  p_mobilize_code text,
  p_category text,
  p_key text
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT value FROM campaign_message_overrides
     WHERE campaign_id = p_campaign_id
       AND mobilize_code = p_mobilize_code
       AND category = p_category AND key = p_key),
    (SELECT value FROM campaign_message_overrides
     WHERE campaign_id = p_campaign_id
       AND mobilize_code IS NULL
       AND category = p_category AND key = p_key),
    (SELECT value FROM settings
     WHERE category = p_category AND key = p_key)
  );
$$;
