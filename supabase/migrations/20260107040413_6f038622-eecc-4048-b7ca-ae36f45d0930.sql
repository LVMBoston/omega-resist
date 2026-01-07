-- Delete the single orphan L00 event (base token without instance suffix)
DELETE FROM url_events 
WHERE token = 'l00-837854-rs1-qr' 
  AND id = '57eff935-6bfb-40f6-8035-cafb1788b517';

-- Create function to auto-fix future orphan L00 tokens by appending :legacy
CREATE OR REPLACE FUNCTION prevent_base_l00_events()
RETURNS TRIGGER AS $$
BEGIN
  -- If token matches base L00 pattern (no colon/instance suffix), append :legacy
  IF NEW.token ~ '^l00-[^:]+$' THEN
    NEW.token := NEW.token || ':legacy';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on url_events to enforce instance suffix
CREATE TRIGGER enforce_l00_instance
BEFORE INSERT ON url_events
FOR EACH ROW EXECUTE FUNCTION prevent_base_l00_events();