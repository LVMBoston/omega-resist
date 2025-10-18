import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { presentationId, deckSlug } = await req.json();
    
    if (!presentationId || !deckSlug) {
      throw new Error('presentationId and deckSlug are required');
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching presentation:', presentationId);

    // Fetch presentation metadata
    const presentationResponse = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}?key=${GOOGLE_API_KEY}`
    );

    if (!presentationResponse.ok) {
      const error = await presentationResponse.text();
      console.error('Google Slides API error:', error);
      throw new Error(`Failed to fetch presentation: ${presentationResponse.status}`);
    }

    const presentation = await presentationResponse.json();
    const slides = presentation.slides || [];

    console.log(`Found ${slides.length} slides`);

    const uploadedSlides = [];

    // Process each slide
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideId = slide.objectId;

      console.log(`Processing slide ${i + 1}/${slides.length}: ${slideId}`);

      // Get slide thumbnail (largest available size)
      const thumbnailUrl = `https://slides.googleapis.com/v1/presentations/${presentationId}/pages/${slideId}/thumbnail?thumbnailProperties.thumbnailSize=LARGE&key=${GOOGLE_API_KEY}`;
      
      const thumbnailResponse = await fetch(thumbnailUrl);
      
      if (!thumbnailResponse.ok) {
        console.error(`Failed to fetch thumbnail for slide ${slideId}`);
        continue;
      }

      const thumbnailData = await thumbnailResponse.json();
      const imageUrl = thumbnailData.contentUrl;

      // Download the image
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const imageArrayBuffer = await imageBlob.arrayBuffer();
      const imageBuffer = new Uint8Array(imageArrayBuffer);

      // Upload to Supabase storage
      const fileName = `${deckSlug}/slide-${i + 1}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slides')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error for slide', i + 1, ':', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('slides')
        .getPublicUrl(fileName);

      console.log(`Uploaded slide ${i + 1}: ${publicUrl}`);

      // Insert slide into database
      const { error: insertError } = await supabase
        .from('slide_items')
        .insert({
          deck_slug: deckSlug,
          position: i + 1,
          content_url: publicUrl,
          type: 'image',
          is_compressed: false
        });

      if (insertError) {
        console.error('Insert error for slide', i + 1, ':', insertError);
        throw insertError;
      }

      uploadedSlides.push({
        position: i + 1,
        url: publicUrl
      });
    }

    console.log(`Successfully imported ${uploadedSlides.length} slides`);

    return new Response(
      JSON.stringify({
        success: true,
        slidesCount: uploadedSlides.length,
        slides: uploadedSlides
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error importing Google Slides:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to import slides';
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
