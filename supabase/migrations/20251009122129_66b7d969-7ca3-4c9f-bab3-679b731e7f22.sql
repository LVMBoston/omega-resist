-- Create function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create settings table for application configuration
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings
CREATE POLICY "Anyone can view settings"
ON public.settings
FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings"
ON public.settings
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create trigger to update updated_at
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert initial settings
INSERT INTO public.settings (category, key, value, description) VALUES
('email', 'l00_template', '{"subject": "Your Event QR Code", "body": "Thank you for your interest! Here is your personalized QR code to access event information.\n\nClick the link below or scan the QR code:\n{{link}}\n\nBest regards,\nThe Team"}', 'Email template for L00 (initial) QR codes'),
('email', 'l01_template', '{"subject": "Share This Event!", "body": "Thanks for engaging! Help us spread the word by sharing this link with your network:\n\n{{link}}\n\nEvery share helps!"}', 'Email template for L01 (first share) links'),
('sms', 'l00_template', '{"body": "Your event link: {{link}}"}', 'SMS template for L00 (initial) QR codes'),
('sms', 'l01_template', '{"body": "Share this event: {{link}}"}', 'SMS template for L01 (first share) links'),
('utm', 'content_vocabulary', '["poster", "handout", "em", "flyer", "banner", "digital-ad", "social-post"]', 'Allowed values for utm_content parameter'),
('utm', 'medium_vocabulary', '["qr", "email", "sms", "fb", "twitter", "linkedin", "instagram", "web"]', 'Allowed values for utm_medium parameter'),
('general', 'domain', '{"value": "https://app.democracyforge.org"}', 'Base domain for generated links');