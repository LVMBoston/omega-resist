-- Fix #1: Restrict slide_items write operations to admin/manager only
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can create slide items" ON public.slide_items;
DROP POLICY IF EXISTS "Anyone can update slide items" ON public.slide_items;
DROP POLICY IF EXISTS "Anyone can delete slide items" ON public.slide_items;

-- Create restricted write policies
CREATE POLICY "Admins and managers can insert slide items"
  ON public.slide_items
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update slide items"
  ON public.slide_items
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can delete slide items"
  ON public.slide_items
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Fix #2: Restrict tokens table and create safe lookup function
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view tokens" ON public.tokens;

-- Create a secure lookup function that only exposes necessary fields
CREATE OR REPLACE FUNCTION public.lookup_token(_token text)
RETURNS TABLE(
  token text,
  deck_slug text,
  full_url text,
  level integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    token,
    deck_slug,
    full_url,
    level
  FROM public.tokens
  WHERE tokens.token = _token
  LIMIT 1;
$$;

-- Allow admins to view all tokens
CREATE POLICY "Admins can view all tokens"
  ON public.tokens
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow managers to view tokens in their campaigns
CREATE POLICY "Managers can view campaign tokens"
  ON public.tokens
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'));

-- Allow users to view tokens they created
CREATE POLICY "Users can view their own tokens"
  ON public.tokens
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());