import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get Google OAuth2 access token using service account
async function getAccessToken(): Promise<string> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  
  // Create JWT for service account
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/presentations.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Encode header and claim
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Import private key
  const privateKey = credentials.private_key;
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(
    pemHeader.length,
    privateKey.length - pemFooter.length - 1
  ).replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Token exchange error:', error);
    throw new Error('Failed to get access token');
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Google Slides import...');
    
    const { presentationId, deckSlug } = await req.json();
    
    if (!presentationId || !deckSlug) {
      throw new Error('presentationId and deckSlug are required');
    }

    console.log(`Processing presentation: ${presentationId} for deck: ${deckSlug}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Getting access token...');
    let accessToken;
    try {
      accessToken = await getAccessToken();
      console.log('Access token obtained successfully');
    } catch (tokenError) {
      console.error('Failed to get access token:', tokenError);
      throw new Error(`Authentication failed: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
    }

    console.log('Fetching presentation:', presentationId);

    // Fetch presentation metadata using OAuth2 token
    const presentationResponse = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
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
      const thumbnailUrl = `https://slides.googleapis.com/v1/presentations/${presentationId}/pages/${slideId}/thumbnail?thumbnailProperties.thumbnailSize=LARGE`;
      
      const thumbnailResponse = await fetch(thumbnailUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
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
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name
    });
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorStack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
