import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { shortenUrl } from "./shortener";
import { toast } from "sonner";

/**
 * Input schema for minting L00 tokens.
 * utm_content is auto-constructed by the database as {mobilize_code}-{utm_id}
 */
const MintL00Input = z.object({
  eoaId: z.string().uuid(),
  deckSlug: z.string().min(1),
  utmMedium: z.enum(["qr", "em", "sms", "social", "p2p"])
});

const MintL00Output = z.object({ 
  token: z.string(), 
  full_url: z.string().url(),
  short_url: z.string().url().optional()
});

/**
 * Mints L00 root token for an event/action.
 * utm_content is automatically constructed as {mobilize_code}-{utm_id} by the database.
 * Optionally shortens URL in background if lazy=true
 * 
 * Note: This function automatically invalidates any existing L00 tokens for this EoA
 * to ensure only one valid token exists at a time.
 */
export async function mintL00(
  input: z.infer<typeof MintL00Input>,
  options?: { lazy?: boolean; onShortened?: (shortUrl: string) => void }
) {
  const { eoaId, deckSlug, utmMedium } = MintL00Input.parse(input);
  
  // Mint new token (old L00 tokens are automatically replaced by RPC function)
  // The mint_l00 function deletes existing L00 tokens for this EoA before creating new ones
  const { data, error } = await supabase.rpc("mint_l00", {
    _eoa_id: eoaId,
    _deck_slug: deckSlug,
    _utm_medium: utmMedium
  });
  
  if (error) {
    console.error("mint_l00 error:", error);
    throw new Error("DECK_VIRAL_MINT_L00_FAILED: " + error.message);
  }
  
  const result = Array.isArray(data) ? data[0] : data;
  const tokenData = MintL00Output.parse(result);
  
  // Update token with current deck version (timestamp)
  const deckVersion = new Date().toISOString();
  await supabase
    .from("tokens")
    .update({ deck_version_at_mint: deckVersion })
    .eq("token", tokenData.token);

  // Shorten URL (lazy or blocking)
  if (options?.lazy) {
    // Background shortening (non-blocking)
    shortenUrl(tokenData.full_url)
      .then(shortUrl => {
        console.log(`🔗 Background shortened: ${shortUrl}`);
        if (options.onShortened) {
          options.onShortened(shortUrl);
        }
      })
      .catch(error => {
        console.error("Background shortening failed:", error);
      });
    
    // Return immediately without short URL
    return tokenData;
  } else {
    // Blocking shortening (wait for short URL)
    try {
      const shortUrl = await shortenUrl(tokenData.full_url);
      return {
        ...tokenData,
        short_url: shortUrl
      };
    } catch (error) {
      console.error("Failed to shorten URL:", error);
      // Return without short URL on failure
      return tokenData;
    }
  }
}

const MintShareInput = z.object({
  parentToken: z.string().min(1),
  utmMedium: z.enum(["qr", "em", "sms", "social", "p2p"])
});

const MintShareOutput = z.object({ 
  token: z.string(), 
  full_url: z.string().url(), 
  level: z.number().int().min(1).max(3) 
});

export async function mintShare(input: z.infer<typeof MintShareInput>) {
  const { parentToken, utmMedium } = MintShareInput.parse(input);
  
  const { data, error } = await supabase.rpc("mint_share", {
    _parent_token: parentToken,
    _utm_medium: utmMedium
  });
  
  if (error) {
    console.error("mint_share error:", error);
    throw new Error("DECK_VIRAL_MINT_SHARE_FAILED: " + error.message);
  }
  
  // RPC returns array of rows, get first row
  const result = Array.isArray(data) ? data[0] : data;
  return MintShareOutput.parse(result);
}

const LogEventInput = z.object({
  token: z.string(),
  eventType: z.enum(["scan", "view", "share"]),
  utmSnapshot: z.record(z.any()).optional(),
  ip: z.string().optional(),
  ua: z.string().optional()
});

interface GeoLocationData {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  zip_code: string | null;
  location_source: 'gps' | 'ip' | 'unknown';
}

/**
 * Calculate Haversine distance between two points in miles
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Look up the nearest zip code from GPS coordinates
 */
async function lookupNearestZipCode(lat: number, lng: number): Promise<string | null> {
  try {
    // Query zip codes within ~0.5 degree radius (roughly 35 miles)
    const { data, error } = await supabase
      .from("zip_codes")
      .select("zip_code, city, state_name, latitude, longitude")
      .gte("latitude", lat - 0.5)
      .lte("latitude", lat + 0.5)
      .gte("longitude", lng - 0.5)
      .lte("longitude", lng + 0.5);
    
    if (error || !data || data.length === 0) {
      console.log("📍 No zip codes found near GPS coordinates");
      return null;
    }
    
    // Find the nearest zip code using Haversine distance
    let nearestZip = null;
    let minDistance = Infinity;
    
    for (const zip of data) {
      const distance = haversineDistance(lat, lng, zip.latitude, zip.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestZip = zip.zip_code;
      }
    }
    
    console.log(`📍 GPS zip code lookup: ${nearestZip} (${minDistance.toFixed(2)} miles away)`);
    return nearestZip;
  } catch (error) {
    console.error("❌ Failed to lookup zip code:", error);
    return null;
  }
}

async function getGPSLocation(): Promise<{ latitude: number; longitude: number } | null> {
  // Check if geolocation is available
  if (!navigator.geolocation) {
    console.log("📍 GPS not available on this device");
    return null;
  }

  try {
    console.log("📍 Requesting GPS permission...");
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });

    console.log("✅ GPS coordinates obtained:", {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } catch (error) {
    console.log("📍 GPS permission denied or failed:", error);
    return null;
  }
}

async function fetchGeolocation(): Promise<GeoLocationData> {
  try {
    console.log("🔍 [DEBUG] fetchGeolocation START");
    
    // Try to get GPS coordinates first (mobile devices)
    const gpsCoords = await getGPSLocation();
    console.log("🔍 [DEBUG] gpsCoords result:", gpsCoords);
    
    // Visual debug alert for GPS
    if (gpsCoords) {
      toast.success("📍 GPS OBTAINED", {
        description: `Lat: ${gpsCoords.latitude.toFixed(6)}, Lng: ${gpsCoords.longitude.toFixed(6)}`,
        duration: 5000
      });
    } else {
      toast.info("📍 No GPS", {
        description: "Using IP-based location",
        duration: 3000
      });
    }
    
    // Fetch IP-based geolocation for city/region/zip data
    console.log("📍 Calling geoip function...");
    const { data, error } = await supabase.functions.invoke('geoip');
    
    console.log("📍 Geoip response:", { data, error });
    
    if (error) {
      console.error("❌ Geoip function error:", error);
      // If we have GPS coords but geoip failed, still use GPS coords
      if (gpsCoords) {
        // Check if non-US based on lack of country_code (since geoip failed)
        // Round coordinates for privacy (non-US assumed)
        return {
          latitude: Math.round(gpsCoords.latitude * 10) / 10,
          longitude: Math.round(gpsCoords.longitude * 10) / 10,
          city: null,
          region: null,
          country: null,
          country_code: null,
          zip_code: null,
          location_source: 'gps'
        };
      }
      return {
        latitude: null,
        longitude: null,
        city: null,
        region: null,
        country: null,
        country_code: null,
        zip_code: null,
        location_source: 'unknown'
      };
    }
    
    const isUS = data?.country_code === 'US';
    console.log("🔍 [DEBUG] isUS:", isUS, "country_code:", data?.country_code);
    
    // For US: use GPS with zip lookup OR IP-based location
    // For non-US: round GPS coordinates to 1 decimal place (~11km precision)
    let finalLat: number | null = null;
    let finalLng: number | null = null;
    let finalZipCode: string | null = null;
    
    if (isUS) {
      // US: Prefer GPS coords, fallback to IP
      finalLat = gpsCoords?.latitude ?? data?.latitude ?? null;
      finalLng = gpsCoords?.longitude ?? data?.longitude ?? null;
      console.log("🔍 [DEBUG] US branch - finalLat:", finalLat, "finalLng:", finalLng);
      
      // If we have GPS coordinates, look up the nearest zip code
      if (gpsCoords) {
        console.log("🔍 [DEBUG] GPS coords available - calling lookupNearestZipCode");
        const gpsZipCode = await lookupNearestZipCode(gpsCoords.latitude, gpsCoords.longitude);
        console.log("🔍 [DEBUG] gpsZipCode result:", gpsZipCode);
        finalZipCode = gpsZipCode || data?.zip_code || null;
        console.log("🔍 [DEBUG] finalZipCode (GPS path):", finalZipCode);
        
        // Visual debug alert for zip lookup
        toast.success("📮 ZIP CODE LOOKUP", {
          description: `GPS Zip: ${gpsZipCode || 'Not found'} | IP Zip: ${data?.zip_code || 'None'} | Final: ${finalZipCode}`,
          duration: 8000
        });
      } else {
        // Fall back to IP-based zip code
        console.log("🔍 [DEBUG] No GPS - using IP-based zip");
        finalZipCode = data?.zip_code || null;
        console.log("🔍 [DEBUG] finalZipCode (IP path):", finalZipCode);
      }
    } else {
      // Non-US: Round GPS or IP coordinates to 1 decimal place
      const lat = gpsCoords?.latitude ?? data?.latitude;
      const lng = gpsCoords?.longitude ?? data?.longitude;
      
      finalLat = lat ? Math.round(lat * 10) / 10 : null;
      finalLng = lng ? Math.round(lng * 10) / 10 : null;
      finalZipCode = null; // Don't store zip for non-US
      
      console.log("🌍 Non-US location - rounded coordinates for privacy:", {
        original: { lat, lng },
        rounded: { lat: finalLat, lng: finalLng }
      });
    }
    
    const result = {
      latitude: finalLat,
      longitude: finalLng,
      city: data?.city || null,
      region: data?.region || null,
      country: data?.country || null,
      country_code: data?.country_code || null,
      zip_code: finalZipCode,
      location_source: (gpsCoords ? 'gps' : 'ip') as 'gps' | 'ip' | 'unknown'
    };
    
    console.log("🔍 [DEBUG] Final result object:", JSON.stringify(result, null, 2));
    
    // Visual debug alert for final result
    toast.success("✅ FINAL LOCATION DATA", {
      description: `Source: ${result.location_source} | Zip: ${result.zip_code || 'None'} | City: ${result.city || 'Unknown'}`,
      duration: 10000
    });
    
    if (gpsCoords) {
      console.log("✅ Using GPS coordinates with IP-based location metadata:", result);
    } else {
      console.log("✅ Using IP-based geolocation:", result);
    }
    
    return result;
  } catch (error) {
    console.error("❌ Failed to fetch geolocation:", error);
    return {
      latitude: null,
      longitude: null,
      city: null,
      region: null,
      country: null,
      country_code: null,
      zip_code: null,
      location_source: 'unknown'
    };
  }
}

export async function logEvent(input: z.infer<typeof LogEventInput>) {
  const { token, eventType, utmSnapshot, ip, ua } = LogEventInput.parse(input);
  
  // Fetch geolocation data
  const geoData = await fetchGeolocation();
  
  const { data, error } = await supabase.rpc("log_event", {
    _token: token,
    _event_type: eventType,
    _utm_snapshot: utmSnapshot ?? null,
    _ip_address: ip ?? null,
    _user_agent: ua ?? null,
    _latitude: geoData.latitude,
    _longitude: geoData.longitude,
    _city: geoData.city,
    _region: geoData.region,
    _country: geoData.country,
    _country_code: geoData.country_code,
    _zip_code: geoData.zip_code,
    _location_source: geoData.location_source
  });
  
  if (error) {
    console.error("log_event error:", error);
    throw new Error("DECK_VIRAL_LOG_EVENT_FAILED: " + error.message);
  }
  
  // Return both event_id and geo data for debugging
  return { 
    event_id: data, 
    geo_data: geoData 
  };
}
