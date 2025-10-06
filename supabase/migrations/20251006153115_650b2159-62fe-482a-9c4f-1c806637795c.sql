-- Temporarily allow public access to campaigns table
DROP POLICY IF EXISTS "Admins and managers can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins and managers can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.campaigns;

CREATE POLICY "Anyone can manage campaigns"
ON public.campaigns
FOR ALL
USING (true)
WITH CHECK (true);

-- Temporarily allow public access to events_actions table
DROP POLICY IF EXISTS "Admins and managers can update events_actions" ON public.events_actions;
DROP POLICY IF EXISTS "Admins and managers can insert events_actions" ON public.events_actions;
DROP POLICY IF EXISTS "Admins can delete events_actions" ON public.events_actions;

CREATE POLICY "Anyone can manage events_actions"
ON public.events_actions
FOR ALL
USING (true)
WITH CHECK (true);

-- Temporarily allow public access to placements table
DROP POLICY IF EXISTS "Admins and managers can manage placements" ON public.placements;

CREATE POLICY "Anyone can manage placements"
ON public.placements
FOR ALL
USING (true)
WITH CHECK (true);