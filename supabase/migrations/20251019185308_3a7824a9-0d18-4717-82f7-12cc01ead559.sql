-- Add display_order column to campaigns table
ALTER TABLE campaigns ADD COLUMN display_order INTEGER;

-- Set initial display_order based on created_at (oldest first)
WITH ordered_campaigns AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM campaigns
)
UPDATE campaigns
SET display_order = ordered_campaigns.row_num
FROM ordered_campaigns
WHERE campaigns.id = ordered_campaigns.id;

-- Make display_order NOT NULL after setting initial values
ALTER TABLE campaigns ALTER COLUMN display_order SET NOT NULL;

-- Set default for new campaigns (max + 1)
ALTER TABLE campaigns ALTER COLUMN display_order SET DEFAULT 999999;