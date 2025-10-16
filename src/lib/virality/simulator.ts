import { supabase } from "@/integrations/supabase/client";

// Cache for zip code data to minimize database queries
let zipCodeCache: Map<string, LocationData> | null = null;
let allZipCodes: LocationData[] | null = null;

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
 * Initialize and cache zip code data from database
 * This loads all 33,000+ zip codes into memory for fast lookups
 */
async function initializeZipCodeCache(): Promise<void> {
  if (zipCodeCache && allZipCodes) return; // Already initialized
  
  console.log('Loading zip code database...');
  const { data, error } = await supabase
    .from('zip_codes')
    .select('zip_code, latitude, longitude, city, state_id, state_name');
  
  if (error) {
    console.error('Error loading zip codes:', error);
    throw new Error('Failed to load zip code data from database');
  }
  
  if (!data || data.length === 0) {
    throw new Error('No zip code data found in database. Please import the data first.');
  }
  
  zipCodeCache = new Map();
  allZipCodes = [];
  
  data.forEach((row) => {
    // Normalize zip code to 5 digits with leading zeros
    const normalizedZip = row.zip_code.toString().padStart(5, '0');
    
    const location: LocationData = {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      city: row.city || '',
      region: row.state_name || '',
      country: 'United States',
      country_code: 'US',
      zip_code: normalizedZip,
    };
    zipCodeCache!.set(normalizedZip, location);
    allZipCodes!.push(location);
  });
  
  console.log(`✓ Loaded ${allZipCodes.length} zip codes into cache`);
}

/**
 * Get base location for L00 from EOA zip code
 * Returns the location associated with the event/action
 */
export async function getL00Location(
  zipCode: string,
  city?: string,
  state?: string
): Promise<LocationData | null> {
  await initializeZipCodeCache();
  
  // Normalize zip code to 5 digits with leading zeros
  const normalizedZip = zipCode.toString().padStart(5, '0');
  
  const location = zipCodeCache!.get(normalizedZip);
  
  if (!location) {
    console.warn(`Zip code ${normalizedZip} (original: ${zipCode}) not found in database`);
    return null;
  }
  
  // Use provided city/state if available, otherwise use database values
  return {
    ...location,
    city: city || location.city,
    region: state || location.region,
  };
}

/**
 * Calculate distance between two coordinates in degrees
 * ~1 degree ≈ 69 miles
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

/**
 * Find all zip codes within a certain radius of a location
 */
async function findNearbyZipCodes(
  baseLat: number,
  baseLng: number,
  maxDistanceDegrees: number
): Promise<LocationData[]> {
  await initializeZipCodeCache();
  
  return allZipCodes!.filter((location) => {
    const distance = calculateDistance(baseLat, baseLng, location.latitude, location.longitude);
    return distance <= maxDistanceDegrees;
  });
}

/**
 * Select a random nearby location from real zip codes
 */
async function selectRandomNearbyLocation(
  baseLat: number,
  baseLng: number,
  maxDistanceDegrees: number
): Promise<LocationData> {
  const nearby = await findNearbyZipCodes(baseLat, baseLng, maxDistanceDegrees);
  
  if (nearby.length === 0) {
    // If no nearby zip codes found, perform a viral jump to random location
    return await getRandomUSLocation();
  }
  
  // Select random zip code from nearby options
  const randomIndex = Math.floor(Math.random() * nearby.length);
  return nearby[randomIndex];
}

/**
 * Get a completely random US location (for viral jumps)
 */
async function getRandomUSLocation(): Promise<LocationData> {
  await initializeZipCodeCache();
  
  const randomIndex = Math.floor(Math.random() * allZipCodes!.length);
  return allZipCodes![randomIndex];
}

/**
 * Generate L01 location - 70% local (within 10 miles), 30% anywhere in US
 * First level of sharing typically stays local
 */
export async function getL01Location(parentLocation: LocationData): Promise<LocationData> {
  const isViralJump = Math.random() < 0.30; // 30% chance of viral jump
  
  if (isViralJump) {
    // Viral jump to anywhere in US
    return await getRandomUSLocation();
  } else {
    // Local share within ~10 miles
    return await selectRandomNearbyLocation(
      parentLocation.latitude,
      parentLocation.longitude,
      0.15 // ±0.15° ≈ ±10 miles
    );
  }
}

/**
 * Generate L02 location - 50% regional (within 50 miles), 50% anywhere in US
 * Second level shows increased geographic spread
 */
export async function getL02Location(parentLocation: LocationData): Promise<LocationData> {
  const isViralJump = Math.random() < 0.50; // 50% chance of viral jump
  
  if (isViralJump) {
    // Viral jump to anywhere in US
    return await getRandomUSLocation();
  } else {
    // Regional share within ~50 miles
    return await selectRandomNearbyLocation(
      parentLocation.latitude,
      parentLocation.longitude,
      0.75 // ±0.75° ≈ ±50 miles
    );
  }
}

/**
 * Generate L03 location - 20% regional (within 100 miles), 80% anywhere in US
 * Third level is predominantly viral jumps to distant locations
 */
export async function getL03Location(parentLocation: LocationData): Promise<LocationData> {
  const isViralJump = Math.random() < 0.80; // 80% chance of viral jump
  
  if (isViralJump) {
    // Viral jump to anywhere in US
    return await getRandomUSLocation();
  } else {
    // Regional share within ~100 miles
    return await selectRandomNearbyLocation(
      parentLocation.latitude,
      parentLocation.longitude,
      1.5 // ±1.5° ≈ ±100 miles
    );
  }
}

/**
 * Get location for any level token based on parent
 */
export async function getLocationForLevel(
  level: number,
  parentLocation: LocationData
): Promise<LocationData> {
  switch (level) {
    case 1:
      return await getL01Location(parentLocation);
    case 2:
      return await getL02Location(parentLocation);
    case 3:
      return await getL03Location(parentLocation);
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
 * Log event with location data using supabase
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
