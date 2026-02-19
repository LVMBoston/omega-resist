ALTER TABLE public.viral_slide_configs DROP CONSTRAINT valid_template_type;

ALTER TABLE public.viral_slide_configs ADD CONSTRAINT valid_template_type CHECK (template_type IN ('interactive_share', 'display_only', 'custom_action', 'stats_page', 'hybrid'));