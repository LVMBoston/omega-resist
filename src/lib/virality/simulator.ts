import { supabase } from "@/integrations/supabase/client";

// US city coordinates lookup for zip code to lat/long conversion
export const SIMULATOR_CITIES: Record<string, { lat: number; lng: number; city: string; region: string; country: string }> = {
  // Major cities across US for simulation
  "19102": { lat: 39.9526, lng: -75.1652, city: "Philadelphia", region: "PA", country: "United States" },
  "10001": { lat: 40.7128, lng: -74.0060, city: "New York", region: "NY", country: "United States" },
  "90001": { lat: 34.0522, lng: -118.2437, city: "Los Angeles", region: "CA", country: "United States" },
  "60601": { lat: 41.8781, lng: -87.6298, city: "Chicago", region: "IL", country: "United States" },
  "77001": { lat: 29.7604, lng: -95.3698, city: "Houston", region: "TX", country: "United States" },
  "85001": { lat: 33.4484, lng: -112.0740, city: "Phoenix", region: "AZ", country: "United States" },
  "19019": { lat: 39.9526, lng: -75.1652, city: "Philadelphia", region: "PA", country: "United States" },
  "94102": { lat: 37.7749, lng: -122.4194, city: "San Francisco", region: "CA", country: "United States" },
  "98101": { lat: 47.6062, lng: -122.3321, city: "Seattle", region: "WA", country: "United States" },
  "02101": { lat: 42.3601, lng: -71.0589, city: "Boston", region: "MA", country: "United States" },
  "30301": { lat: 33.7490, lng: -84.3880, city: "Atlanta", region: "GA", country: "United States" },
  "33101": { lat: 25.7617, lng: -80.1918, city: "Miami", region: "FL", country: "United States" },
  // Campaign-specific zip codes
  "99501": { lat: 61.2181, lng: -149.9003, city: "Anchorage", region: "AK", country: "United States" },
  "02540": { lat: 41.5515, lng: -70.6148, city: "Falmouth", region: "MA", country: "United States" },
  "02601": { lat: 41.6521, lng: -70.2795, city: "Hyannis", region: "MA", country: "United States" },
  "02568": { lat: 41.3887, lng: -70.6083, city: "Vineyard Haven", region: "MA", country: "United States" },
  "02657": { lat: 42.0551, lng: -70.1710, city: "Provincetown", region: "MA", country: "United States" },
  "85085": { lat: 33.6820, lng: -112.1040, city: "Phoenix", region: "AZ", country: "United States" },
  "91360": { lat: 34.1964, lng: -118.8742, city: "Thousand Oaks", region: "CA", country: "United States" },
  
  // Extended zip code database for realistic share locations
  // Philadelphia area
  "19103": { lat: 39.9523, lng: -75.1638, city: "Philadelphia", region: "PA", country: "United States" },
  "19104": { lat: 39.9559, lng: -75.1967, city: "Philadelphia", region: "PA", country: "United States" },
  "19106": { lat: 39.9526, lng: -75.1481, city: "Philadelphia", region: "PA", country: "United States" },
  "19107": { lat: 39.9496, lng: -75.1603, city: "Philadelphia", region: "PA", country: "United States" },
  "19115": { lat: 40.0951, lng: -75.0421, city: "Philadelphia", region: "PA", country: "United States" },
  "19131": { lat: 39.9867, lng: -75.2207, city: "Philadelphia", region: "PA", country: "United States" },
  "19145": { lat: 39.9165, lng: -75.1819, city: "Philadelphia", region: "PA", country: "United States" },
  
  // New York area
  "10002": { lat: 40.7156, lng: -73.9860, city: "New York", region: "NY", country: "United States" },
  "10003": { lat: 40.7318, lng: -73.9889, city: "New York", region: "NY", country: "United States" },
  "10009": { lat: 40.7264, lng: -73.9776, city: "New York", region: "NY", country: "United States" },
  "10011": { lat: 40.7406, lng: -74.0006, city: "New York", region: "NY", country: "United States" },
  "10012": { lat: 40.7255, lng: -73.9983, city: "New York", region: "NY", country: "United States" },
  "10013": { lat: 40.7200, lng: -74.0054, city: "New York", region: "NY", country: "United States" },
  "10014": { lat: 40.7341, lng: -74.0067, city: "New York", region: "NY", country: "United States" },
  "11201": { lat: 40.6943, lng: -73.9903, city: "Brooklyn", region: "NY", country: "United States" },
  "11211": { lat: 40.7124, lng: -73.9534, city: "Brooklyn", region: "NY", country: "United States" },
  
  // Los Angeles area
  "90002": { lat: 33.9494, lng: -118.2471, city: "Los Angeles", region: "CA", country: "United States" },
  "90003": { lat: 33.9651, lng: -118.2726, city: "Los Angeles", region: "CA", country: "United States" },
  "90004": { lat: 34.0769, lng: -118.3089, city: "Los Angeles", region: "CA", country: "United States" },
  "90005": { lat: 34.0599, lng: -118.3014, city: "Los Angeles", region: "CA", country: "United States" },
  "90012": { lat: 34.0639, lng: -118.2378, city: "Los Angeles", region: "CA", country: "United States" },
  "90013": { lat: 34.0442, lng: -118.2476, city: "Los Angeles", region: "CA", country: "United States" },
  "90015": { lat: 34.0391, lng: -118.2651, city: "Los Angeles", region: "CA", country: "United States" },
  "90028": { lat: 34.1017, lng: -118.3290, city: "Los Angeles", region: "CA", country: "United States" },
  
  // Chicago area
  "60602": { lat: 41.8825, lng: -87.6291, city: "Chicago", region: "IL", country: "United States" },
  "60603": { lat: 41.8800, lng: -87.6289, city: "Chicago", region: "IL", country: "United States" },
  "60604": { lat: 41.8764, lng: -87.6295, city: "Chicago", region: "IL", country: "United States" },
  "60605": { lat: 41.8694, lng: -87.6192, city: "Chicago", region: "IL", country: "United States" },
  "60606": { lat: 41.8819, lng: -87.6392, city: "Chicago", region: "IL", country: "United States" },
  "60607": { lat: 41.8731, lng: -87.6532, city: "Chicago", region: "IL", country: "United States" },
  "60614": { lat: 41.9237, lng: -87.6531, city: "Chicago", region: "IL", country: "United States" },
  
  // Boston area
  "02108": { lat: 42.3584, lng: -71.0652, city: "Boston", region: "MA", country: "United States" },
  "02109": { lat: 42.3647, lng: -71.0542, city: "Boston", region: "MA", country: "United States" },
  "02110": { lat: 42.3584, lng: -71.0520, city: "Boston", region: "MA", country: "United States" },
  "02111": { lat: 42.3501, lng: -71.0620, city: "Boston", region: "MA", country: "United States" },
  "02113": { lat: 42.3667, lng: -71.0567, city: "Boston", region: "MA", country: "United States" },
  "02114": { lat: 42.3620, lng: -71.0686, city: "Boston", region: "MA", country: "United States" },
  "02115": { lat: 42.3428, lng: -71.0926, city: "Boston", region: "MA", country: "United States" },
  
  // Phoenix area
  "85003": { lat: 33.4484, lng: -112.0740, city: "Phoenix", region: "AZ", country: "United States" },
  "85004": { lat: 33.4549, lng: -112.0753, city: "Phoenix", region: "AZ", country: "United States" },
  "85006": { lat: 33.4605, lng: -112.0510, city: "Phoenix", region: "AZ", country: "United States" },
  "85007": { lat: 33.4501, lng: -112.0916, city: "Phoenix", region: "AZ", country: "United States" },
  "85008": { lat: 33.4751, lng: -112.0465, city: "Phoenix", region: "AZ", country: "United States" },
  "85012": { lat: 33.5025, lng: -112.0746, city: "Phoenix", region: "AZ", country: "United States" },
  "85013": { lat: 33.5001, lng: -112.0935, city: "Phoenix", region: "AZ", country: "United States" },
  
  // San Francisco area
  "94103": { lat: 37.7726, lng: -122.4099, city: "San Francisco", region: "CA", country: "United States" },
  "94104": { lat: 37.7910, lng: -122.4016, city: "San Francisco", region: "CA", country: "United States" },
  "94105": { lat: 37.7859, lng: -122.3892, city: "San Francisco", region: "CA", country: "United States" },
  "94107": { lat: 37.7625, lng: -122.3971, city: "San Francisco", region: "CA", country: "United States" },
  "94108": { lat: 37.7927, lng: -122.4073, city: "San Francisco", region: "CA", country: "United States" },
  "94109": { lat: 37.7908, lng: -122.4199, city: "San Francisco", region: "CA", country: "United States" },
  "94110": { lat: 37.7494, lng: -122.4156, city: "San Francisco", region: "CA", country: "United States" },
  
  // Seattle area
  "98102": { lat: 47.6295, lng: -122.3211, city: "Seattle", region: "WA", country: "United States" },
  "98103": { lat: 47.6691, lng: -122.3415, city: "Seattle", region: "WA", country: "United States" },
  "98104": { lat: 47.6038, lng: -122.3301, city: "Seattle", region: "WA", country: "United States" },
  "98105": { lat: 47.6629, lng: -122.3029, city: "Seattle", region: "WA", country: "United States" },
  "98106": { lat: 47.5324, lng: -122.3542, city: "Seattle", region: "WA", country: "United States" },
  "98107": { lat: 47.6686, lng: -122.3757, city: "Seattle", region: "WA", country: "United States" },
  "98109": { lat: 47.6336, lng: -122.3475, city: "Seattle", region: "WA", country: "United States" },
  
  // Atlanta area
  "30302": { lat: 33.7557, lng: -84.3902, city: "Atlanta", region: "GA", country: "United States" },
  "30303": { lat: 33.7490, lng: -84.3879, city: "Atlanta", region: "GA", country: "United States" },
  "30305": { lat: 33.8415, lng: -84.3850, city: "Atlanta", region: "GA", country: "United States" },
  "30306": { lat: 33.7909, lng: -84.3519, city: "Atlanta", region: "GA", country: "United States" },
  "30307": { lat: 33.7681, lng: -84.3408, city: "Atlanta", region: "GA", country: "United States" },
  "30308": { lat: 33.7712, lng: -84.3785, city: "Atlanta", region: "GA", country: "United States" },
  "30309": { lat: 33.7906, lng: -84.3831, city: "Atlanta", region: "GA", country: "United States" },
  
  // Miami area
  "33109": { lat: 25.7678, lng: -80.1347, city: "Miami Beach", region: "FL", country: "United States" },
  "33125": { lat: 25.7839, lng: -80.2357, city: "Miami", region: "FL", country: "United States" },
  "33126": { lat: 25.7781, lng: -80.2989, city: "Miami", region: "FL", country: "United States" },
  "33127": { lat: 25.8092, lng: -80.1944, city: "Miami", region: "FL", country: "United States" },
  "33128": { lat: 25.7656, lng: -80.1978, city: "Miami", region: "FL", country: "United States" },
  "33129": { lat: 25.7592, lng: -80.1914, city: "Miami", region: "FL", country: "United States" },
  "33130": { lat: 25.7514, lng: -80.2103, city: "Miami", region: "FL", country: "United States" },
  
  // Houston area
  "77002": { lat: 29.7589, lng: -95.3677, city: "Houston", region: "TX", country: "United States" },
  "77003": { lat: 29.7463, lng: -95.3540, city: "Houston", region: "TX", country: "United States" },
  "77004": { lat: 29.7294, lng: -95.3694, city: "Houston", region: "TX", country: "United States" },
  "77005": { lat: 29.7196, lng: -95.4294, city: "Houston", region: "TX", country: "United States" },
  "77006": { lat: 29.7408, lng: -95.3910, city: "Houston", region: "TX", country: "United States" },
  "77007": { lat: 29.7709, lng: -95.3949, city: "Houston", region: "TX", country: "United States" },
  "77008": { lat: 29.7971, lng: -95.4010, city: "Houston", region: "TX", country: "United States" },
};

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  country_code: string;
  zip_code: string;
}

/**
 * Get base location for L00 from EOA zip code
 */
export function getL00Location(zipCode: string, city?: string, state?: string): LocationData | null {
  const cityData = SIMULATOR_CITIES[zipCode];
  
  if (!cityData) {
    // If zip not in lookup, return null
    return null;
  }
  
  return {
    latitude: cityData.lat,
    longitude: cityData.lng,
    city: city || cityData.city,
    region: state || cityData.region,
    country: cityData.country,
    country_code: "US",
    zip_code: zipCode,
  };
}

/**
 * Calculate distance between two coordinates in degrees
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

/**
 * Find all zip codes within a certain radius of a location
 */
function findNearbyZipCodes(
  baseLat: number,
  baseLng: number,
  maxDistanceDegrees: number
): Array<{ zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } }> {
  const nearby: Array<{ zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } }> = [];
  
  for (const [zipCode, data] of Object.entries(SIMULATOR_CITIES)) {
    const distance = calculateDistance(baseLat, baseLng, data.lat, data.lng);
    if (distance <= maxDistanceDegrees) {
      nearby.push({ zipCode, data });
    }
  }
  
  return nearby;
}

/**
 * Select a random nearby location from real zip codes
 */
function selectRandomNearbyLocation(
  baseLat: number,
  baseLng: number,
  maxDistanceDegrees: number
): { zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } } | null {
  const nearby = findNearbyZipCodes(baseLat, baseLng, maxDistanceDegrees);
  
  if (nearby.length === 0) {
    // If no nearby zip codes found, return a random zip code from the database
    const allZipCodes = Object.entries(SIMULATOR_CITIES);
    const randomIndex = Math.floor(Math.random() * allZipCodes.length);
    return {
      zipCode: allZipCodes[randomIndex][0],
      data: allZipCodes[randomIndex][1]
    };
  }
  
  // Select random zip code from nearby options
  const randomIndex = Math.floor(Math.random() * nearby.length);
  return nearby[randomIndex];
}

/**
 * Generate L01 location (±3-5 miles from L00) using real nearby zip codes
 */
export function getL01Location(parentLocation: LocationData): LocationData {
  const nearbyLocation = selectRandomNearbyLocation(
    parentLocation.latitude,
    parentLocation.longitude,
    0.05 // ±0.05° ≈ ±3-5 miles
  );
  
  if (!nearbyLocation) {
    return parentLocation;
  }
  
  return {
    latitude: nearbyLocation.data.lat,
    longitude: nearbyLocation.data.lng,
    city: nearbyLocation.data.city,
    region: nearbyLocation.data.region,
    country: nearbyLocation.data.country,
    country_code: "US",
    zip_code: nearbyLocation.zipCode,
  };
}

/**
 * Generate L02 location (±15-20 miles from L01) using real nearby zip codes
 */
export function getL02Location(parentLocation: LocationData): LocationData {
  const nearbyLocation = selectRandomNearbyLocation(
    parentLocation.latitude,
    parentLocation.longitude,
    0.25 // ±0.25° ≈ ±15-20 miles
  );
  
  if (!nearbyLocation) {
    return parentLocation;
  }
  
  return {
    latitude: nearbyLocation.data.lat,
    longitude: nearbyLocation.data.lng,
    city: nearbyLocation.data.city,
    region: nearbyLocation.data.region,
    country: nearbyLocation.data.country,
    country_code: "US",
    zip_code: nearbyLocation.zipCode,
  };
}

/**
 * Generate L03 location (±50-70 miles from L02) using real nearby zip codes
 */
export function getL03Location(parentLocation: LocationData): LocationData {
  const nearbyLocation = selectRandomNearbyLocation(
    parentLocation.latitude,
    parentLocation.longitude,
    1.0 // ±1° ≈ ±50-70 miles
  );
  
  if (!nearbyLocation) {
    return parentLocation;
  }
  
  return {
    latitude: nearbyLocation.data.lat,
    longitude: nearbyLocation.data.lng,
    city: nearbyLocation.data.city,
    region: nearbyLocation.data.region,
    country: nearbyLocation.data.country,
    country_code: "US",
    zip_code: nearbyLocation.zipCode,
  };
}

/**
 * Get location for any level token based on parent
 */
export function getLocationForLevel(
  level: number,
  parentLocation: LocationData
): LocationData {
  switch (level) {
    case 1:
      return getL01Location(parentLocation);
    case 2:
      return getL02Location(parentLocation);
    case 3:
      return getL03Location(parentLocation);
    default:
      return parentLocation;
  }
}

/**
 * Generate random timestamp within date range
 */
export function randomTimestampInRange(startDate: Date, endDate: Date): Date {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return new Date(start + Math.random() * (end - start));
}

/**
 * Log event with location data using supabase RPC
 */
export async function logEventWithLocation(
  token: string,
  eventType: "scan" | "view" | "share",
  location: LocationData
) {
  // Insert directly with is_simulated flag
  const { data, error } = await supabase
    .from("url_events")
    .insert({
      token,
      event_type: eventType,
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      region: location.region,
      country: location.country,
      country_code: location.country_code,
      zip_code: location.zip_code,
      is_simulated: true,
      user_agent: "Simulator/1.0",
      occurred_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error logging simulated event:", error);
    throw error;
  }

  return data;
}
