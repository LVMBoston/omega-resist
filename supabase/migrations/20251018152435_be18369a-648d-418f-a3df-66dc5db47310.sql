-- Add CASCADE DELETE to viral_slide_configs foreign key constraint
-- This ensures viral configs are automatically deleted when their slide is deleted

-- First, drop the existing foreign key constraint
ALTER TABLE viral_slide_configs 
DROP CONSTRAINT IF EXISTS viral_slide_configs_slide_id_fkey;

-- Re-add it with CASCADE DELETE
ALTER TABLE viral_slide_configs 
ADD CONSTRAINT viral_slide_configs_slide_id_fkey 
FOREIGN KEY (slide_id) 
REFERENCES slide_items(id) 
ON DELETE CASCADE;