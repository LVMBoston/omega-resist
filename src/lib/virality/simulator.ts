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
 * Apply random variance to location coordinates
 * @param lat Base latitude
 * @param lng Base longitude
 * @param varianceDegrees Max variance in degrees (±)
 */
function applyLocationVariance(
  lat: number, 
  lng: number, 
  varianceDegrees: number
): { latitude: number; longitude: number } {
  return {
    latitude: lat + (Math.random() - 0.5) * varianceDegrees * 2,
    longitude: lng + (Math.random() - 0.5) * varianceDegrees * 2,
  };
}

/**
 * Generate L01 location (±3-5 miles from L00)
 */
export function getL01Location(parentLocation: LocationData): LocationData {
  const newCoords = applyLocationVariance(
    parentLocation.latitude,
    parentLocation.longitude,
    0.05 // ±0.05° ≈ ±3-5 miles
  );
  
  return {
    ...newCoords,
    city: parentLocation.city,
    region: parentLocation.region,
    country: parentLocation.country,
    country_code: parentLocation.country_code,
    zip_code: parentLocation.zip_code,
  };
}

/**
 * Generate L02 location (±15-20 miles from L01)
 */
export function getL02Location(parentLocation: LocationData): LocationData {
  const newCoords = applyLocationVariance(
    parentLocation.latitude,
    parentLocation.longitude,
    0.25 // ±0.25° ≈ ±15-20 miles
  );
  
  return {
    ...newCoords,
    city: parentLocation.city,
    region: parentLocation.region,
    country: parentLocation.country,
    country_code: parentLocation.country_code,
    zip_code: parentLocation.zip_code,
  };
}

/**
 * Generate L03 location (±50-70 miles from L02)
 */
export function getL03Location(parentLocation: LocationData): LocationData {
  const newCoords = applyLocationVariance(
    parentLocation.latitude,
    parentLocation.longitude,
    1.0 // ±1° ≈ ±50-70 miles
  );
  
  return {
    ...newCoords,
    city: parentLocation.city,
    region: parentLocation.region,
    country: parentLocation.country,
    country_code: parentLocation.country_code,
    zip_code: parentLocation.zip_code,
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
  const { data, error } = await supabase.rpc("log_event", {
    _token: token,
    _event_type: eventType,
    _utm_snapshot: null,
    _ip_address: null,
    _user_agent: "Simulator/1.0",
    _latitude: location.latitude,
    _longitude: location.longitude,
    _city: location.city,
    _region: location.region,
    _country: location.country,
    _country_code: location.country_code,
    _zip_code: location.zip_code,
  });

  if (error) {
    console.error("logEventWithLocation error:", error);
    throw error;
  }

  return data;
}
