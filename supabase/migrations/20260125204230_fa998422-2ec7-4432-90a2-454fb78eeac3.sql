-- Add stats_page to the valid template_type values
-- First drop the existing constraint if it exists
ALTER TABLE public.viral_slide_configs 
DROP CONSTRAINT IF EXISTS valid_template_type;

-- Add the updated constraint with stats_page included
ALTER TABLE public.viral_slide_configs 
ADD CONSTRAINT valid_template_type 
CHECK (template_type IN ('interactive_share', 'display_only', 'custom_action', 'stats_page'));