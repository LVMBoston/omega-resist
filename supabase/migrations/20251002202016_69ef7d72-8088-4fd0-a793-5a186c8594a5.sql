-- Allow anyone to create decks (can add auth later)
CREATE POLICY "Anyone can create decks"
  ON public.decks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update decks"
  ON public.decks FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete decks"
  ON public.decks FOR DELETE
  USING (true);

-- Slide items policies
CREATE POLICY "Anyone can create slide items"
  ON public.slide_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update slide items"
  ON public.slide_items FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete slide items"
  ON public.slide_items FOR DELETE
  USING (true);

-- Storage policies for uploads
CREATE POLICY "Anyone can upload slides"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'slides');

CREATE POLICY "Anyone can update slides"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'slides');

CREATE POLICY "Anyone can delete slides"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'slides');