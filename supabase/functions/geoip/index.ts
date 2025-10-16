import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract IP from request headers
    const ip = 
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';

    console.log('📍 Getting geolocation for IP:', ip);

    // If we can't get IP or it's localhost, return null
    if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      console.log('📍 Local/unknown IP, returning null geolocation');
      return new Response(
        JSON.stringify({ 
          ip,
          latitude: null,
          longitude: null,
          city: null,
          region: null,
          country: null,
          country_code: null,
          zip_code: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call ipapi.co with API key for paid tier
    const apiKey = Deno.env.get('IPAPI_API_KEY');
    const geoResponse = await fetch(`https://ipapi.co/${ip}/json/?key=${apiKey}`);
    
    if (!geoResponse.ok) {
      console.error('📍 Geolocation API error:', await geoResponse.text());
      throw new Error('Failed to fetch geolocation data');
    }

    const geoData = await geoResponse.json();

    console.log('📍 Geolocation data:', geoData);

    // Return structured geolocation data
    const locationData = {
      ip,
      latitude: geoData.latitude || null,
      longitude: geoData.longitude || null,
      city: geoData.city || null,
      region: geoData.region || null,
      country: geoData.country_name || null,
      country_code: geoData.country_code || null,
      zip_code: geoData.postal || null,
    };

    return new Response(
      JSON.stringify(locationData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('📍 Geoip function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        ip: null,
        latitude: null,
        longitude: null,
        city: null,
        region: null,
        country: null,
        country_code: null,
        zip_code: null
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
