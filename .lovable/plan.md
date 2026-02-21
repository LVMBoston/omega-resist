

# Resilient Short URL Lookup for EoA Tokens

## Problem

When the EoA Manager loads existing L00 tokens, it looks up short codes by doing an **exact match** on `full_url` against the `shortened_urls` table. If the deck slug, UTM format, or instance suffix changed since the short code was created, the lookup silently fails and the QR/short URL appears missing -- even though a valid short code may exist, or could be created.

## Solution

After the existing exact-match lookup, add a **fallback step**: for any token that has no matching short URL, automatically shorten it. This uses the existing `shortenUrl()` function which already handles caching and deduplication via the `shorten_url` RPC (which returns the existing short code if the URL was already shortened, or creates a new one).

This avoids any re-minting and preserves all event history. It simply ensures every L00 token always has a working short URL.

## Technical Detail

**File**: `src/pages/CampaignEoaManager.tsx` (lines ~237-270)

After building `shortUrlMap` from the batch lookup, iterate over tokens that have no match and call `shortenUrlsBatch()` for the missing URLs:

```typescript
// After existing shortUrlMap is built (line ~261)...

// Collect tokens missing a short URL
const missingUrls = data
  .filter(t => !shortUrlMap.has(t.full_url))
  .map(t => t.full_url);

if (missingUrls.length > 0) {
  console.log(`Auto-shortening ${missingUrls.length} URLs without short codes...`);
  const { shortenUrlsBatch } = await import("@/lib/virality/shortener");
  const newShorts = await shortenUrlsBatch(missingUrls);
  newShorts.forEach((shortUrl, fullUrl) => {
    shortUrlMap.set(fullUrl, shortUrl);
  });
}
```

No other files change. The `shortenUrlsBatch` function already exists and handles batch creation plus local caching.

## What stays the same

- No re-minting of tokens
- No modification of `events_actions` or `tokens` tables
- No deletion of existing short codes
- Existing short codes continue to work
- The `invalidate_tokens_on_critical_change` trigger is never fired

