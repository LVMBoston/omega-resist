-- Fix L00 tokens that should not be marked as simulated
-- These are real QR codes in the field, not simulation data
UPDATE tokens 
SET is_simulated = false 
WHERE level = 0 
AND token LIKE 'l00-%'
AND is_simulated = true;