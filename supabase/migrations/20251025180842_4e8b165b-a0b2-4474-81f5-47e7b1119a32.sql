-- Link spread-word slides without template_id to the default template
UPDATE slide_items 
SET template_id = '29145786-407a-4844-9356-7caa04921e59'
WHERE type = 'spread-word' 
AND template_id IS NULL
AND id IN ('8640d34c-7c5d-4aa5-a609-417fdbaf9d9d', 'b5c63d89-7c14-43f3-8584-efaba027a6a3');