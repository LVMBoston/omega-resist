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
  
  zipCodeCache = new Map();
  allZipCodes = [];
  
  // Fetch all zip codes in batches to handle large datasets
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  let batchCount = 0;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('zip_code, latitude, longitude, city, state_id, state_name')
      .range(offset, offset + batchSize - 1);
    
    if (error) {
      console.error('Error loading zip codes:', error);
      throw new Error('Failed to load zip code data from database');
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    batchCount++;
    console.log(`Loaded batch ${batchCount}: ${data.length} records (offset ${offset})`);
    
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
    
    offset += batchSize;
    
    // If we got less than a full batch, we're done
    if (data.length < batchSize) {
      hasMore = false;
    }
  }
  
  if (allZipCodes.length === 0) {
    throw new Error('No zip code data found in database. Please import the data first.');
  }
  
  console.log(`✓ Loaded ${allZipCodes.length} zip codes into cache from ${batchCount} batches`);
  
  // Debug: Check if specific zip codes are in cache
  const testZips = ['02657', '01945', '02633'];
  testZips.forEach(zip => {
    console.log(`Test zip ${zip}: ${zipCodeCache!.has(zip) ? 'FOUND' : 'NOT FOUND'}`);
  });
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
 * Generate L01 location - stays within 50 miles for concentrated virality
 * First level of sharing stays local
 */
export async function getL01Location(parentLocation: LocationData): Promise<LocationData> {
  // Local share within ~50 miles (no viral jumps)
  return await selectRandomNearbyLocation(
    parentLocation.latitude,
    parentLocation.longitude,
    0.75 // ±0.75° ≈ ±50 miles
  );
}

/**
 * Generate L02 location - stays within 50 miles for concentrated virality
 * Second level stays within region
 */
export async function getL02Location(parentLocation: LocationData): Promise<LocationData> {
  // Regional share within ~50 miles (no viral jumps)
  return await selectRandomNearbyLocation(
    parentLocation.latitude,
    parentLocation.longitude,
    0.75 // ±0.75° ≈ ±50 miles
  );
}

/**
 * Generate L03 location - stays within 50 miles for concentrated virality
 * Third level stays within region for better visualization
 */
export async function getL03Location(parentLocation: LocationData): Promise<LocationData> {
  // Regional share within ~50 miles (no viral jumps)
  return await selectRandomNearbyLocation(
    parentLocation.latitude,
    parentLocation.longitude,
    0.75 // ±0.75° ≈ ±50 miles
  );
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
 * Create a real L00 instance token for simulated event logging.
 * Base L00 tokens cannot receive url_events directly because the database
 * enforces instance-suffixed L00 event tokens.
 */
export async function instantiateSimulatedL00Token(baseToken: string): Promise<string> {
  if (!baseToken.startsWith('l00-') || baseToken.includes(':')) {
    return baseToken;
  }

  const { data, error } = await supabase.rpc('instantiate_l00_token', {
    _base_token: baseToken,
  });

  if (error) {
    console.error('Error instantiating simulated L00 token:', error);
    throw error;
  }

  const instanceToken = data?.[0]?.instance_token;
  if (!instanceToken) {
    throw new Error('Simulator could not create an L00 instance token');
  }

  await supabase
    .from('tokens')
    .update({ is_simulated: true })
    .eq('token', instanceToken);

  return instanceToken;
}

/**
 * Log event with location data using supabase
 */
export async function logEventWithLocation(
  token: string,
  eventType: "scan" | "view" | "share",
  location: LocationData,
  occurredAt?: Date
) {
  const { data, error } = await (supabase as any).rpc('log_event', {
    _token: token,
    _event_type: eventType,
    _utm_snapshot: null,
    _ip_address: null,
    _user_agent: 'Simulator/1.0',
    _latitude: location.latitude,
    _longitude: location.longitude,
    _city: location.city,
    _region: location.region,
    _country: location.country,
    _country_code: location.country_code,
    _zip_code: location.zip_code,
    _location_source: 'ip',
    _occurred_at: occurredAt?.toISOString(),
  });

  if (error) {
    console.error("Error logging simulated event:", error);
    throw error;
  }

  return data;
}
