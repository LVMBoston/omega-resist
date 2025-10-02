-- Create decks table
CREATE TABLE public.decks (
  slug TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create slide_items table
CREATE TABLE public.slide_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_slug TEXT NOT NULL REFERENCES public.decks(slug) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'image',
  content_url TEXT NOT NULL,
  is_compressed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deck_slug, position)
);

-- Enable RLS
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_items ENABLE ROW LEVEL SECURITY;

-- Public read policies (anyone can view decks)
CREATE POLICY "Decks are publicly readable"
  ON public.decks FOR SELECT
  USING (true);

CREATE POLICY "Slide items are publicly readable"
  ON public.slide_items FOR SELECT
  USING (true);

-- Create storage bucket for slides
INSERT INTO storage.buckets (id, name, public)
VALUES ('slides', 'slides', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Slides are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'slides');

-- Index for faster queries
CREATE INDEX idx_slide_items_deck_slug ON public.slide_items(deck_slug);
CREATE INDEX idx_slide_items_position ON public.slide_items(deck_slug, position);