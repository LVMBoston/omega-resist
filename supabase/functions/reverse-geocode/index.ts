import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Reverse geocoding using OpenStreetMap Nominatim (free, no API key).
 * Rate limit: 1 request/second - should be fine for our use case.
 * https://nominatim.org/release-docs/develop/api/Reverse/
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🗺️ Reverse geocoding coordinates:', { latitude, longitude });

    // Call Nominatim API
    // IMPORTANT: Nominatim requires a valid User-Agent header
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=16`,
      {
        headers: {
          'User-Agent': 'OmegaResist/1.0 (https://omega-resist.lovable.app)',
          'Accept-Language': 'en'
        }
      }
    );

    if (!response.ok) {
      console.error('🗺️ Nominatim API error:', response.status, await response.text());
      throw new Error('Failed to reverse geocode');
    }

    const data = await response.json();
    console.log('🗺️ Nominatim response:', data);

    // Extract address components
    const address = data.address || {};
    
    // Nominatim uses different fields for city depending on location size
    const city = address.city || address.town || address.village || address.municipality || address.hamlet || null;
    const region = address.state || address.province || address.region || null;
    const country = address.country || null;
    const countryCode = address.country_code?.toUpperCase() || null;
    const zipCode = address.postcode || null;

    const result = {
      city,
      region,
      country,
      country_code: countryCode,
      zip_code: zipCode,
      display_name: data.display_name || null
    };

    console.log('🗺️ Parsed location:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🗺️ Reverse geocode error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
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
