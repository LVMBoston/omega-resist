import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const ShortenUrlOutput = z.object({
  short_code: z.string(),
  short_url: z.string().url()
});

// In-memory cache for short URLs
const shortUrlCache = new Map<string, string>();

// LocalStorage key for persistent cache
const CACHE_KEY = "l00_short_urls";

// Load cache from localStorage on module load
function loadCache() {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([fullUrl, shortUrl]) => {
        shortUrlCache.set(fullUrl, shortUrl as string);
      });
    }
  } catch (error) {
    console.error("Failed to load short URL cache:", error);
  }
}

// Save cache to localStorage
function saveCache() {
  try {
    const cacheObj = Object.fromEntries(shortUrlCache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
  } catch (error) {
    console.error("Failed to save short URL cache:", error);
  }
}

// Initialize cache
loadCache();

/**
 * Shorten a single URL with caching
 */
export async function shortenUrl(fullUrl: string): Promise<string> {
  // Check cache first
  const cached = shortUrlCache.get(fullUrl);
  if (cached) {
    console.log("📦 Short URL cache hit:", fullUrl.substring(0, 50));
    return cached;
  }

  try {
    const { data, error } = await supabase.rpc("shorten_url", {
      _full_url: fullUrl
    });
    
    if (error) {
      console.error("shorten_url error:", error);
      throw new Error("URL_SHORTENING_FAILED: " + error.message);
    }
    
    const result = Array.isArray(data) ? data[0] : data;
    const parsed = ShortenUrlOutput.parse(result);
    
    // Cache the result
    shortUrlCache.set(fullUrl, parsed.short_url);
    saveCache();
    
    return parsed.short_url;
  } catch (error) {
    console.error("Failed to shorten URL:", error);
    throw error;
  }
}

/**
 * Shorten multiple URLs in parallel (batch operation)
 * Returns Map<fullUrl, shortUrl> with successful shortenings
 */
export async function shortenUrlsBatch(
  fullUrls: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Split into cached and uncached
  const uncached: string[] = [];
  fullUrls.forEach(url => {
    const cached = shortUrlCache.get(url);
    if (cached) {
      results.set(url, cached);
    } else {
      uncached.push(url);
    }
  });

  if (uncached.length === 0) {
    console.log("📦 All URLs from cache");
    return results;
  }

  console.log(`🔗 Shortening ${uncached.length} URLs in parallel...`);

  // Process in parallel with concurrency limit (10 at a time)
  const BATCH_SIZE = 10;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const promises = batch.map(url => 
      shortenUrl(url)
        .then(shortUrl => ({ url, shortUrl, success: true }))
        .catch(error => ({ url, error, success: false }))
    );

    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach(result => {
      if (result.status === "fulfilled" && result.value.success && 'shortUrl' in result.value) {
        results.set(result.value.url, result.value.shortUrl);
      }
    });
  }

  console.log(`✅ Successfully shortened ${results.size}/${fullUrls.length} URLs`);
  return results;
}

/**
 * Clear the short URL cache (useful for debugging)
 */
export function clearShortUrlCache() {
  shortUrlCache.clear();
  localStorage.removeItem(CACHE_KEY);
}
