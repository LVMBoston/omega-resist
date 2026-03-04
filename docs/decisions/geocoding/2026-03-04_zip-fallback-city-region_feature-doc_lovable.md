# Fix: Resolve City/Region from zip_codes Table When Reverse-Geocode Returns Null

**Status:** Approved & Implemented
**Date:** 2026-03-04

## 1. Problem

When a GPS-sourced event is in an isolated area (e.g., Julian, CA -- zip 92036), the Nominatim reverse-geocode API returns no city name. The `reverse-geocode` edge function passes this null back, and the event is stored with `zip_code = '92036'` but `city = NULL`.

The `zip_codes` table already has the correct mapping: `92036 -> Julian, California`.

## 2. Root Cause

The `reverse-geocode` edge function has no fallback. When Nominatim's `address` object lacks a `city`/`town`/`village`, it returns `null` without checking the local `zip_codes` table.

## 3. Fix (single change)

**File:** `supabase/functions/reverse-geocode/index.ts`

a. After resolving the nearest zip code via `get_nearest_zip_code` RPC, if `city` is still null, use the `city` and `state_name` from the nearest zip code result as fallback values.

b. This is a ~10-line addition to the existing US-location branch, after the Nominatim parsing and zip lookup are complete.

## 4. Backfill (one-time SQL)

a. Ran an UPDATE to fill in missing city/region on existing `url_events` rows that have a `zip_code` but null `city`, by joining against the `zip_codes` table:

```sql
UPDATE url_events ue
SET city = zc.city, region = zc.state_name
FROM zip_codes zc
WHERE ue.zip_code = zc.zip_code
  AND ue.zip_code IS NOT NULL
  AND ue.city IS NULL;
```

## 5. What Does Not Change

- No new dependencies or APIs
- No changes to `mint.ts` or `fetchGeolocation`
- No Perplexity integration needed
- Privacy architecture unchanged
