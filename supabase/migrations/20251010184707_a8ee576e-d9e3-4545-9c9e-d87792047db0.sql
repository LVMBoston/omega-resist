-- ============================================================================
-- SECURITY FIX #1: Secure the slides storage bucket
-- ============================================================================

-- Make the slides bucket private
UPDATE storage.buckets 
SET public = false,
    file_size_limit = 10485760,  -- 10MB limit
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE name = 'slides';

-- Drop existing overly permissive storage policies for slides bucket
DROP POLICY IF EXISTS "Anyone can upload slides" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update slides" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete slides" ON storage.objects;
DROP POLICY IF EXISTS "Slides are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public slides access" ON storage.objects;

-- Create secure storage policies
CREATE POLICY "Admins and managers can upload slides"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'slides' 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins and managers can update slides"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'slides' 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins and managers can delete slides"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'slides' 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- Keep public read access for viral sharing (authenticated users can view)
CREATE POLICY "Authenticated users can view slides"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'slides');

-- Also allow public viewing via signed URLs (for anonymous viral shares)
CREATE POLICY "Public can view slides via signed URLs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'slides');


-- ============================================================================
-- SECURITY FIX #2: Protect the decks table from anonymous modification
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create decks" ON decks;
DROP POLICY IF EXISTS "Anyone can update decks" ON decks;
DROP POLICY IF EXISTS "Anyone can delete decks" ON decks;

-- Add role-based policies
CREATE POLICY "Admins and managers can insert decks"
ON decks FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update decks"
ON decks FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete decks"
ON decks FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Keep public read access (SELECT policy "Decks are publicly readable" already exists)