-- Allow admins and managers to delete simulated tokens
CREATE POLICY "Admins and managers can delete simulated tokens"
ON public.tokens
FOR DELETE
TO authenticated
USING (
  is_simulated = true 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);