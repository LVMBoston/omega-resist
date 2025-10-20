-- Create storage bucket for branding assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for branding bucket
CREATE POLICY "Admins can upload to branding bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update branding bucket files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete from branding bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Branding assets are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding');

-- Insert branding settings
INSERT INTO public.settings (category, key, value, description)
VALUES 
  ('branding', 'logo_1', '{"url": null, "name": "Logo 1"}'::jsonb, 'First logo slot'),
  ('branding', 'logo_2', '{"url": null, "name": "Logo 2"}'::jsonb, 'Second logo slot'),
  ('branding', 'logo_3', '{"url": null, "name": "Logo 3"}'::jsonb, 'Third logo slot'),
  ('branding', 'default_logo', '{"selected": null}'::jsonb, 'Selected default logo (1, 2, or 3)')
ON CONFLICT DO NOTHING;