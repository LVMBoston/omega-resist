-- Add template_type column to classify templates
ALTER TABLE viral_slide_configs 
ADD COLUMN template_type TEXT NOT NULL DEFAULT 'interactive_share';

-- Add config column for type-specific extensible data
ALTER TABLE viral_slide_configs 
ADD COLUMN config JSONB DEFAULT '{}'::jsonb;

-- Add check constraint for valid template types
ALTER TABLE viral_slide_configs 
ADD CONSTRAINT valid_template_type 
CHECK (template_type IN ('interactive_share', 'display_only', 'custom_action'));

-- Create index for template type queries
CREATE INDEX idx_viral_slide_configs_template_type 
ON viral_slide_configs(template_type);

-- Create index for config JSONB queries (GIN for efficient JSONB searches)
CREATE INDEX idx_viral_slide_configs_config 
ON viral_slide_configs USING gin(config);

-- Add comments explaining structure
COMMENT ON COLUMN viral_slide_configs.template_type IS 
'Type of template: interactive_share (default, L01-L03 viral), display_only (no interactivity), custom_action (future extensibility)';

COMMENT ON COLUMN viral_slide_configs.config IS 
'Type-specific configuration. For interactive_share: share settings. For display_only: display duration, transitions. For custom_action: action definitions.';