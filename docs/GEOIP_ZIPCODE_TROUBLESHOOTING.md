# Geoip & Zip Code Mapping Troubleshooting Guide

## Overview
This document details the fragile components related to geolocation, zip code display, and map visualization. This is critical reference material for future debugging.

---

## Problem Summary

### Initial Issues
1. **Geoip edge function not being invoked from frontend**
   - CORS preflight requests were failing
   - Browser blocked requests due to missing headers

2. **Map not displaying zip code locations**
   - Geographic data not reaching the map component
   - Events not showing proper coordinates

---

## Root Cause Analysis

### CORS Configuration Issue
**File:** `supabase/functions/geoip/index.ts` (lines 3-8)

**Problem:** The CORS headers were incomplete. The Supabase JavaScript client automatically sends additional headers (`Cache-Control` and `Pragma`) that weren't allowed by the edge function.

**Original (Broken) Code:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

**Error Message:**
```
Access to fetch at 'https://wznilzguqjwvkysuleta.supabase.co/functions/v1/geoip' 
from origin 'https://bee1b942-b0d5-4fcf-8ed7-2e0665861e6e.lovableproject.com' 
has been blocked by CORS policy: Request header field cache-control is not 
allowed by Access-Control-Allow-Headers in preflight response.
```

---

## Solution Steps

### Step 1: Identify Missing CORS Headers
1. Created test harness at `/geoip-test` (file: `src/pages/GeoipTest.tsx`)
2. Observed browser console showing CORS preflight failure
3. Identified that `cache-control` and `pragma` headers were being blocked

### Step 2: Update Edge Function CORS Headers
**File:** `supabase/functions/geoip/index.ts`

**Fixed Code:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

**Key Changes:**
- Added `cache-control` to allowed headers
- Added `pragma` to allowed headers

### Step 3: Deploy Edge Function
The edge function was deployed automatically after code changes.

### Step 4: Verify Fix
Use the test harness at `/geoip-test` to verify the function works correctly.

---

## Critical Files & Components

### Backend (Edge Functions)
1. **`supabase/functions/geoip/index.ts`**
   - Handles IP-to-geolocation conversion
   - Uses ipapi.co API with API key
   - Enhances US locations with local zip code database
   - **FRAGILE:** CORS headers must match client library requirements

### Frontend (React Components)
1. **`src/pages/GeoipTest.tsx`**
   - Test harness for geoip function
   - Useful for debugging CORS and function issues

2. **`src/components/ActivityMap.tsx`**
   - Displays geographic spread of tokens on Mapbox
   - Relies on geoip data for coordinates

3. **`src/components/SharedDashboardMap.tsx`**
   - Similar to ActivityMap but for shared dashboards

### Database
1. **`zip_codes` table**
   - Stores US zip code coordinates
   - Used to enhance incomplete geolocation data
   - RPC function: `get_coordinates_from_zip`

---

## Troubleshooting Checklist

### When Geoip Function Fails

1. **Check CORS Headers**
   ```bash
   # Verify headers in supabase/functions/geoip/index.ts
   # Must include: authorization, x-client-info, apikey, content-type, cache-control, pragma
   ```

2. **Verify API Key**
   - Secret name: `IPAPI_API_KEY`
   - Check if secret exists in Supabase Edge Function Secrets
   - Test API key at https://ipapi.co/

3. **Test with Harness**
   - Navigate to `/geoip-test`
   - Check browser console for CORS errors
   - Verify function response contains lat/long data

4. **Check Edge Function Logs**
   - Look for `📍 Getting geolocation for IP:` logs
   - Look for `📍 Geolocation data:` logs
   - Check for error messages

### When Map Doesn't Display Locations

1. **Verify Mapbox Token**
   - Check if `MAPBOX_TOKEN` secret exists
   - Verify token is valid at https://mapbox.com/

2. **Check Data Flow**
   ```typescript
   // In ActivityMap or SharedDashboardMap:
   // 1. Query should return events with latitude/longitude
   // 2. Filter out null coordinates
   // 3. Pass to map component
   ```

3. **Inspect Console Logs**
   - Look for `getGeographicSpread for campaign` logs
   - Verify `totalTokens` and `filteredTokens` counts
   - Check number of points returned

### When Zip Codes Don't Resolve

1. **Check zip_codes Table**
   ```sql
   -- Verify data exists
   SELECT COUNT(*) FROM zip_codes;
   
   -- Test specific zip code
   SELECT * FROM get_coordinates_from_zip('06489');
   ```

2. **Check Geoip Enhancement Logic**
   ```typescript
   // In supabase/functions/geoip/index.ts (lines 70-95)
   // Verifies US zip code enhancement is working
   ```

---

## Backup Strategy

### Recommended Approach

1. **Version Control Critical Files**
   - Commit working versions immediately
   - Tag stable releases: `git tag -a v1.0-geoip-stable -m "Working geoip implementation"`

2. **Document Working State**
   - Current working CORS headers (see above)
   - Current working API key configuration
   - Current working database schema

3. **Save Test Cases**
   - Keep `/geoip-test` page as permanent fixture
   - Add automated tests if possible

4. **Monitor Edge Function Logs**
   - Regularly check for errors
   - Set up alerts for repeated failures

### Files to Backup Before Changes

```
supabase/functions/geoip/index.ts
src/components/ActivityMap.tsx
src/components/SharedDashboardMap.tsx
src/pages/GeoipTest.tsx
```

### Quick Restore Commands

If issues arise, restore from this documentation:

1. **Restore CORS headers:**
   ```typescript
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
     'Access-Control-Allow-Methods': 'POST, OPTIONS',
   };
   ```

2. **Verify OPTIONS handler exists:**
   ```typescript
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
   ```

3. **Verify all responses include CORS headers:**
   ```typescript
   return new Response(
     JSON.stringify(data),
     { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
   );
   ```

---

## Common Pitfalls

### ❌ DO NOT:
1. Remove `cache-control` or `pragma` from CORS headers
2. Change CORS configuration without testing in browser
3. Deploy edge function without verifying CORS in preflight
4. Delete `/geoip-test` page (it's a critical diagnostic tool)

### ✅ DO:
1. Test CORS changes in browser before deploying
2. Keep test harness page maintained and functional
3. Document any changes to geoip logic immediately
4. Verify edge function logs after deployment
5. Test with actual browser requests, not just curl/Postman

---

## Testing Workflow

### Before Making Changes
1. Document current working state
2. Test geoip function at `/geoip-test`
3. Verify map displays locations correctly
4. Save edge function logs showing successful requests

### After Making Changes
1. Deploy edge function
2. Hard refresh browser (Ctrl+Shift+R)
3. Test at `/geoip-test` first
4. Check browser console for CORS errors
5. Verify map displays locations
6. Check edge function logs for errors

---

## Additional Resources

- **CORS Documentation:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **ipapi.co API Docs:** https://ipapi.co/api/
- **Mapbox GL JS:** https://docs.mapbox.com/mapbox-gl-js/

---

## Change Log

| Date | Issue | Fix | Files Changed |
|------|-------|-----|---------------|
| 2025-11-28 | CORS blocking geoip function | Added `cache-control, pragma` to allowed headers | `supabase/functions/geoip/index.ts` |
| 2025-11-28 | No test harness for debugging | Created test page | `src/pages/GeoipTest.tsx`, `src/App.tsx` |

---

## Emergency Recovery

If everything breaks and you need to start fresh:

1. **Restore geoip function from this documentation** (see "Quick Restore Commands" above)
2. **Verify secrets exist:**
   - `IPAPI_API_KEY` in Supabase Edge Function Secrets
   - `MAPBOX_TOKEN` in Supabase Edge Function Secrets
3. **Test with harness:** Navigate to `/geoip-test` and verify functionality
4. **Check database:** Verify `zip_codes` table has data
5. **Redeploy edge function:** It will redeploy automatically on code save

---

## Contact & Maintenance

This is critical infrastructure. Any changes to these components should be:
- Tested thoroughly with the test harness
- Documented in this file
- Verified in production before considering complete
- Backed up before major refactoring

**Last Updated:** 2025-11-28  
**Maintainer:** Project Team  
**Status:** ✅ Working (as of last update)
