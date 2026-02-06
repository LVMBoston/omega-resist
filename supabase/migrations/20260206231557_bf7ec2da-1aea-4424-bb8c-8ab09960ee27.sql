-- Create trigger to clear IP on INSERT if zip_code already exists
CREATE TRIGGER clear_ip_on_insert_trigger
  BEFORE INSERT ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_ip_on_insert_if_zip_exists();

-- Create trigger to clear IP on UPDATE when zip_code becomes populated
CREATE TRIGGER clear_ip_when_zip_populated_trigger
  BEFORE UPDATE ON public.url_events
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_ip_when_zip_populated();