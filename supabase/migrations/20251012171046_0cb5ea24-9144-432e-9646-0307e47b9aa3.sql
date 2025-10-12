-- Allow admins and managers to delete simulated url_events
CREATE POLICY "Admins and managers can delete simulated url_events"
ON public.url_events
FOR DELETE
TO authenticated
USING (
  is_simulated = true 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);