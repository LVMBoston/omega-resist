-- Fix campaign_id type in dashboard_shares
ALTER TABLE public.dashboard_shares ALTER COLUMN campaign_id TYPE uuid USING campaign_id::uuid;

-- Now add the foreign key
ALTER TABLE public.dashboard_shares 
ADD CONSTRAINT fk_dashboard_shares_campaign 
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;