-- Allow admins and managers to insert url_events for simulation purposes
CREATE POLICY "Admins and managers can insert url_events"
ON public.url_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);