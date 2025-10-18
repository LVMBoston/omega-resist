-- Add CASCADE DELETE rules for campaign hierarchy

-- First, drop existing foreign keys if they exist (they might not have CASCADE)
ALTER TABLE public.events_actions
DROP CONSTRAINT IF EXISTS events_actions_campaign_id_fkey;

ALTER TABLE public.tokens
DROP CONSTRAINT IF EXISTS tokens_eoa_id_fkey;

ALTER TABLE public.daily_aggregates
DROP CONSTRAINT IF EXISTS daily_aggregates_campaign_id_fkey,
DROP CONSTRAINT IF EXISTS daily_aggregates_eoa_id_fkey;

-- Add foreign keys with CASCADE DELETE
-- When a campaign is deleted, delete all its events/actions
ALTER TABLE public.events_actions
ADD CONSTRAINT events_actions_campaign_id_fkey
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- When an event/action is deleted, delete all its tokens
ALTER TABLE public.tokens
ADD CONSTRAINT tokens_eoa_id_fkey
FOREIGN KEY (eoa_id) REFERENCES public.events_actions(id) ON DELETE CASCADE;

-- When a campaign is deleted, delete its daily aggregates
ALTER TABLE public.daily_aggregates
ADD CONSTRAINT daily_aggregates_campaign_id_fkey
FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- When an event/action is deleted, delete its daily aggregates
ALTER TABLE public.daily_aggregates
ADD CONSTRAINT daily_aggregates_eoa_id_fkey
FOREIGN KEY (eoa_id) REFERENCES public.events_actions(id) ON DELETE CASCADE;