-- Make slides bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'slides';

-- Add RLS policy for public read access to slides
CREATE POLICY "Anyone can view slides"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'slides');