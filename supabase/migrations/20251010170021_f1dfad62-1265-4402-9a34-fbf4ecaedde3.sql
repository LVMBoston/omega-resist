-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can manage campaigns" ON public.campaigns;

-- Create separate restrictive policies for admin-only modifications
CREATE POLICY "Admins can insert campaigns"
ON public.campaigns
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaigns"
ON public.campaigns
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaigns"
ON public.campaigns
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));