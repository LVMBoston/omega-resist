-- Add slide_id column to viral_slide_configs to link each config to a specific slide
ALTER TABLE viral_slide_configs
ADD COLUMN slide_id uuid REFERENCES slide_items(id);

-- Update existing records to link them to their corresponding slides based on matching image URLs
UPDATE viral_slide_configs vsc
SET slide_id = si.id
FROM slide_items si
WHERE si.content_url = vsc.image_url;

-- Make slide_id required for new records
ALTER TABLE viral_slide_configs
ALTER COLUMN slide_id SET NOT NULL;