-- Add snapshot configuration columns to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS snapshot_interval_minutes integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS snapshot_enabled boolean DEFAULT false;

-- Add snapshot state columns to viral_slide_configs table
ALTER TABLE public.viral_slide_configs 
ADD COLUMN IF NOT EXISTS cached_snapshot_path text,
ADD COLUMN IF NOT EXISTS snapshot_rendered_at timestamptz;

-- Create slide-snapshots storage bucket with public read access
INSERT INTO storage.buckets (id, name, public)
VALUES ('slide-snapshots', 'slide-snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access to slide-snapshots
CREATE POLICY "Public read access for slide-snapshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'slide-snapshots');

-- Create policy for authenticated users to upload snapshots
CREATE POLICY "Service role can upload snapshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'slide-snapshots');

-- Create policy for service role to update/delete snapshots
CREATE POLICY "Service role can manage snapshots"
ON storage.objects
FOR ALL
USING (bucket_id = 'slide-snapshots');

-- Add index for efficient snapshot lookups
CREATE INDEX IF NOT EXISTS idx_viral_slide_configs_snapshot_rendered_at 
ON public.viral_slide_configs (snapshot_rendered_at)
WHERE template_type = 'stats_page' AND cached_snapshot_path IS NOT NULL;