import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { shortenUrl } from "./shortener";

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
    // Try to get GPS coordinates first (mobile devices)
    const gpsCoords = await getGPSLocation();
    
    // Fetch IP-based geolocation for city/region/zip data
    console.log("📍 Calling geoip function...");
    const { data, error } = await supabase.functions.invoke('geoip');
    
    console.log("📍 Geoip response:", { data, error });
    
    if (error) {
      console.error("❌ Geoip function error:", error);
      // If we have GPS coords but geoip failed, still use GPS coords
      if (gpsCoords) {
        return {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
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
    
    // Merge GPS coordinates (if available) with IP-based location data
    const result = {
      latitude: gpsCoords?.latitude ?? data?.latitude ?? null,
      longitude: gpsCoords?.longitude ?? data?.longitude ?? null,
      city: data?.city || null,
      region: data?.region || null,
      country: data?.country || null,
      country_code: data?.country_code || null,
      zip_code: data?.zip_code || null,
      location_source: (gpsCoords ? 'gps' : 'ip') as 'gps' | 'ip' | 'unknown'
    };
    
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
  
  return data; // event_id
}
