-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create events_actions (EoAs) table
CREATE TABLE public.events_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  utm_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('event', 'action')),
  mobilize_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.events_actions ENABLE ROW LEVEL SECURITY;

-- Create deck_versions table
CREATE TABLE public.deck_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_slug TEXT REFERENCES public.decks(slug) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (deck_slug, version)
);

ALTER TABLE public.deck_versions ENABLE ROW LEVEL SECURITY;

-- Create deck_eoa_assignments table
CREATE TABLE public.deck_eoa_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_slug TEXT NOT NULL,
  deck_version INTEGER NOT NULL,
  eoa_id UUID REFERENCES public.events_actions(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  FOREIGN KEY (deck_slug, deck_version) REFERENCES public.deck_versions(deck_slug, version) ON DELETE CASCADE,
  UNIQUE (deck_slug, deck_version, eoa_id)
);

ALTER TABLE public.deck_eoa_assignments ENABLE ROW LEVEL SECURITY;

-- Create placements table
CREATE TABLE public.placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  context TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

-- Create unified tokens table (replaces minted_urls and viral_shares)
CREATE TABLE public.tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  parent_token TEXT REFERENCES public.tokens(token) ON DELETE SET NULL,
  root_token TEXT REFERENCES public.tokens(token) ON DELETE SET NULL,
  level INTEGER NOT NULL CHECK (level >= 0 AND level <= 3),
  eoa_id UUID REFERENCES public.events_actions(id) ON DELETE CASCADE NOT NULL,
  deck_slug TEXT REFERENCES public.decks(slug) ON DELETE CASCADE NOT NULL,
  placement_id UUID REFERENCES public.placements(id) ON DELETE SET NULL,
  utm_campaign TEXT,
  utm_id TEXT,
  utm_content TEXT,
  utm_medium TEXT,
  utm_source TEXT,
  full_url TEXT NOT NULL,
  minted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tokens_parent ON public.tokens(parent_token);
CREATE INDEX idx_tokens_root ON public.tokens(root_token);
CREATE INDEX idx_tokens_level ON public.tokens(level);
CREATE INDEX idx_tokens_eoa ON public.tokens(eoa_id);

-- Create url_events table (append-only log)
CREATE TABLE public.url_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT REFERENCES public.tokens(token) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('scan', 'view', 'share')),
  utm_snapshot JSONB,
  ip_address INET,
  user_agent TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.url_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_url_events_token ON public.url_events(token);
CREATE INDEX idx_url_events_type ON public.url_events(event_type);
CREATE INDEX idx_url_events_occurred ON public.url_events(occurred_at);

-- Create daily_aggregates table for rollups
CREATE TABLE public.daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  eoa_id UUID REFERENCES public.events_actions(id) ON DELETE CASCADE,
  deck_slug TEXT REFERENCES public.decks(slug) ON DELETE CASCADE,
  placement_id UUID REFERENCES public.placements(id) ON DELETE SET NULL,
  level INTEGER,
  scans INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  unique_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (date, campaign_id, eoa_id, deck_slug, placement_id, level)
);

ALTER TABLE public.daily_aggregates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_daily_agg_date ON public.daily_aggregates(date);
CREATE INDEX idx_daily_agg_campaign ON public.daily_aggregates(campaign_id);
CREATE INDEX idx_daily_agg_eoa ON public.daily_aggregates(eoa_id);

-- RLS Policies for campaigns
CREATE POLICY "Anyone can view campaigns"
  ON public.campaigns FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can insert campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for events_actions
CREATE POLICY "Anyone can view events_actions"
  ON public.events_actions FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can insert events_actions"
  ON public.events_actions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update events_actions"
  ON public.events_actions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete events_actions"
  ON public.events_actions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for deck_versions
CREATE POLICY "Anyone can view deck_versions"
  ON public.deck_versions FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage deck_versions"
  ON public.deck_versions FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS Policies for deck_eoa_assignments
CREATE POLICY "Anyone can view deck_eoa_assignments"
  ON public.deck_eoa_assignments FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage deck_eoa_assignments"
  ON public.deck_eoa_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS Policies for placements
CREATE POLICY "Anyone can view placements"
  ON public.placements FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage placements"
  ON public.placements FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS Policies for tokens
CREATE POLICY "Anyone can view tokens"
  ON public.tokens FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert tokens"
  ON public.tokens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all tokens"
  ON public.tokens FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for url_events
CREATE POLICY "Anyone can insert url_events"
  ON public.url_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins and managers can view url_events"
  ON public.url_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS Policies for daily_aggregates
CREATE POLICY "Anyone can view daily_aggregates"
  ON public.daily_aggregates FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage daily_aggregates"
  ON public.daily_aggregates FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_viral_configs_updated_at();

CREATE TRIGGER update_events_actions_updated_at
  BEFORE UPDATE ON public.events_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_viral_configs_updated_at();

CREATE TRIGGER update_daily_aggregates_updated_at
  BEFORE UPDATE ON public.daily_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_viral_configs_updated_at();