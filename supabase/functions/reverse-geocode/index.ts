import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Reverse geocoding that:
 * 1. For US locations: Uses the local zip_codes table to find the nearest zip code
 * 2. Falls back to OpenStreetMap Nominatim for city/region/country data
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, call Nominatim to get city/region/country
    let nominatimData: any = null;
    try {
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=16`,
        {
          headers: {
            'User-Agent': 'OmegaResist/1.0 (https://omega-resist.lovable.app)',
            'Accept-Language': 'en'
          }
        }
      );

      if (nominatimResponse.ok) {
        nominatimData = await nominatimResponse.json();
        console.log('🗺️ Nominatim response:', nominatimData);
      } else {
        console.warn('🗺️ Nominatim API returned non-OK status:', nominatimResponse.status);
      }
    } catch (nominatimError) {
      console.warn('🗺️ Nominatim API error (continuing without it):', nominatimError);
    }

    // Extract address components from Nominatim
    const address = nominatimData?.address || {};
    const city = address.city || address.town || address.village || address.municipality || address.hamlet || null;
    const region = address.state || address.province || address.region || null;
    const country = address.country || null;
    const countryCode = address.country_code?.toUpperCase() || null;

    // For US locations, query our zip_codes table to find the nearest zip code
    let zipCode: string | null = null;
    let finalCity = city;
    let finalRegion = region;
    
    if (countryCode === 'US' || (!countryCode && latitude > 24 && latitude < 50 && longitude > -125 && longitude < -66)) {
      console.log('🗺️ US location detected, querying local zip_codes table...');
      
      // Find the nearest zip code using raw SQL for distance calculation
      const { data: nearestZips, error: zipError } = await supabase.rpc('get_nearest_zip_code', {
        p_latitude: latitude,
        p_longitude: longitude
      });

      if (zipError) {
        console.error('🗺️ Error querying zip_codes table:', zipError);
      } else if (nearestZips && nearestZips.length > 0) {
        const nearest = nearestZips[0];
        zipCode = nearest.zip_code;
        console.log('🗺️ Found nearest zip code from database:', {
          zip_code: zipCode,
          city: nearest.city,
          state: nearest.state_name,
          zip_lat: nearest.latitude,
          zip_lon: nearest.longitude
        });
        
        // Fallback: if Nominatim didn't return city/region, use zip_codes table data
        if (!finalCity && nearest.city) {
          finalCity = nearest.city;
          console.log('🗺️ City fallback from zip_codes table:', finalCity);
        }
        if (!finalRegion && nearest.state_name) {
          finalRegion = nearest.state_name;
          console.log('🗺️ Region fallback from zip_codes table:', finalRegion);
        }
        
        // Calculate distance for logging
        const R = 6371; // Earth's radius in km
        const dLat = (nearest.latitude - latitude) * Math.PI / 180;
        const dLon = (nearest.longitude - longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(latitude * Math.PI / 180) * Math.cos(nearest.latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        console.log(`🗺️ Distance to nearest zip code: ${distance.toFixed(2)} km`);
      } else {
        console.log('🗺️ No zip codes found in database, falling back to Nominatim postcode');
        zipCode = address.postcode || null;
      }
    } else {
      // Non-US: use Nominatim postcode if available
      zipCode = address.postcode || null;
    }

    const result = {
      city,
      region,
      country,
      country_code: countryCode,
      zip_code: zipCode,
      display_name: nominatimData?.display_name || null
    };

    console.log('🗺️ Final parsed location:', result);

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
