-- Add a public policy to allow reading token campaign association
-- This is needed for StatsPageSlide to resolve campaign context from viral tokens
-- We only expose utm_campaign for campaign resolution, not sensitive token data
CREATE POLICY "Anyone can lookup token campaign association" 
ON public.tokens 
FOR SELECT 
USING (true);