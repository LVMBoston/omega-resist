import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract optional GPS coordinates from query params
    const url = new URL(req.url);
    const gpsLat = url.searchParams.get('lat');
    const gpsLng = url.searchParams.get('lng');
    
    console.log('📍 GPS coordinates from request:', { gpsLat, gpsLng });
    
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

    const isUS = geoData.country_code === 'US';
    
    // Initialize location data from ipapi.co
    let locationData = {
      ip,
      latitude: geoData.latitude || null,
      longitude: geoData.longitude || null,
      city: geoData.city || null,
      region: geoData.region || null,
      country: geoData.country_name || null,
      country_code: geoData.country_code || null,
      zip_code: geoData.postal || null,
    };

    // If GPS coordinates provided, look up zip code for US locations
    if (isUS && gpsLat && gpsLng) {
      console.log('📍 GPS coordinates provided for US location - looking up zip code');
      
      const latitude = parseFloat(gpsLat);
      const longitude = parseFloat(gpsLng);
      
      if (!isNaN(latitude) && !isNaN(longitude)) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Query zip codes within ~0.5 degree radius (roughly 35 miles)
        const { data: zipData, error: zipError } = await supabase
          .from('zip_codes')
          .select('zip_code, city, state_name, latitude, longitude')
          .gte('latitude', latitude - 0.5)
          .lte('latitude', latitude + 0.5)
          .gte('longitude', longitude - 0.5)
          .lte('longitude', longitude + 0.5);

        if (!zipError && zipData && zipData.length > 0) {
          // Calculate Haversine distance to find nearest zip
          const R = 3959; // Earth's radius in miles
          let nearestZip = null;
          let minDistance = Infinity;
          
          for (const zip of zipData) {
            const dLat = (zip.latitude - latitude) * Math.PI / 180;
            const dLon = (zip.longitude - longitude) * Math.PI / 180;
            const a = 
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(latitude * Math.PI / 180) * Math.cos(zip.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;
            
            if (distance < minDistance) {
              minDistance = distance;
              nearestZip = zip;
            }
          }
          
          if (nearestZip) {
            console.log('📍 GPS zip code lookup successful:', {
              zip: nearestZip.zip_code,
              distance: minDistance.toFixed(2) + ' miles'
            });
            
            // Use GPS-derived zip and city/state from our database
            locationData = {
              ...locationData,
              zip_code: nearestZip.zip_code,
              city: nearestZip.city || locationData.city,
              region: nearestZip.state_name || locationData.region,
            };
          }
        } else if (zipError) {
          console.error('📍 Error looking up GPS zip code:', zipError);
        }
      }
    }
    
    // If we have a US zip code from IP but missing coordinates, enhance with our local data
    if (isUS && geoData.postal && (!geoData.latitude || !geoData.longitude)) {
      console.log('📍 Enhancing US location with local zip code data:', geoData.postal);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: zipData, error: zipError } = await supabase
        .rpc('get_coordinates_from_zip', { p_zip_code: geoData.postal });

      if (!zipError && zipData && zipData.length > 0) {
        const localZipData = zipData[0];
        console.log('📍 Enhanced with local data:', localZipData);
        
        // Merge with priority to local data for US locations
        locationData = {
          ...locationData,
          latitude: localZipData.latitude || locationData.latitude,
          longitude: localZipData.longitude || locationData.longitude,
          city: localZipData.city || locationData.city,
          region: localZipData.state_name || locationData.region,
        };
      } else if (zipError) {
        console.error('📍 Error fetching local zip data:', zipError);
      }
    }
    
    // For non-US locations, round coordinates to 1 decimal place (~11km precision)
    if (!isUS && locationData.latitude && locationData.longitude) {
      console.log('🌍 Non-US location - rounding coordinates:', {
        original: { lat: locationData.latitude, lng: locationData.longitude },
        rounded: { 
          lat: Math.round(locationData.latitude * 10) / 10,
          lng: Math.round(locationData.longitude * 10) / 10
        }
      });
      
      locationData.latitude = Math.round(locationData.latitude * 10) / 10;
      locationData.longitude = Math.round(locationData.longitude * 10) / 10;
      locationData.zip_code = null; // Clear zip code for non-US
    }

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
