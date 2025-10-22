-- Transform viral_slide_configs into template library
-- This makes it the authoritative source for interactive slide templates

-- Add template identification columns to viral_slide_configs
ALTER TABLE viral_slide_configs
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update slug to be more appropriate for templates
ALTER TABLE viral_slide_configs
ALTER COLUMN slug SET NOT NULL;

-- Make slide_id nullable since templates aren't tied to specific slides initially
ALTER TABLE viral_slide_configs
ALTER COLUMN slide_id DROP NOT NULL;

-- Make deck_slug nullable since templates aren't deck-specific
ALTER TABLE viral_slide_configs
ALTER COLUMN deck_slug DROP NOT NULL;

-- Add template_id to slide_items to reference templates
ALTER TABLE slide_items
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES viral_slide_configs(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_slide_items_template_id ON slide_items(template_id);
CREATE INDEX IF NOT EXISTS idx_viral_configs_slug ON viral_slide_configs(slug);

-- Add unique constraint on slug for templates
ALTER TABLE viral_slide_configs
ADD CONSTRAINT unique_template_slug UNIQUE (slug);

-- Comment explaining the new architecture
COMMENT ON TABLE viral_slide_configs IS 'Template library for interactive slides. Templates are reusable configurations that can be referenced by multiple decks via slide_items.template_id';
COMMENT ON COLUMN slide_items.template_id IS 'References the viral_slide_config template. When set, the slide inherits hotspots and configuration from the template';
COMMENT ON COLUMN viral_slide_configs.slide_id IS 'Legacy: Previously linked to specific slide. Now nullable as templates are deck-agnostic';
COMMENT ON COLUMN viral_slide_configs.is_default IS 'Marks the default template to use when assigning interactive slides';