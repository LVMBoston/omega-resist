-- Create viral_slide_configs table for storing hotspot configurations
CREATE TABLE public.viral_slide_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text NOT NULL,
  slug text NOT NULL UNIQUE,
  deck_slug text REFERENCES public.decks(slug) ON DELETE CASCADE,
  hotspots jsonb DEFAULT '[]'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.viral_slide_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Viral slide configs are publicly readable" 
ON public.viral_slide_configs 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create viral slide configs" 
ON public.viral_slide_configs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update viral slide configs" 
ON public.viral_slide_configs 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete viral slide configs" 
ON public.viral_slide_configs 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_viral_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_viral_slide_configs_updated_at
BEFORE UPDATE ON public.viral_slide_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_viral_configs_updated_at();