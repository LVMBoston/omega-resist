
# Plan: Add Missing CORS Headers (`cache-control`, `pragma`)

## Root Cause

The Supabase client in this project is configured to send `Cache-Control` and `Pragma` headers on every request:

```typescript
// src/integrations/supabase/client.ts
global: {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  },
},
```

The `render-stats-snapshot` edge function's CORS configuration does **not** include these headers:

```typescript
// Current - missing cache-control and pragma
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, ...'
```

When the browser sends a preflight (OPTIONS) request, it checks if all headers the client intends to send are listed in `Access-Control-Allow-Headers`. Since `cache-control` and `pragma` are missing, the browser blocks the actual POST request with "Load failed".

Other edge functions in this project (like `geoip` and `get-mapbox-token`) already include these headers and work correctly.

---

## Solution

Update the CORS headers in the `render-stats-snapshot` edge function to include `cache-control` and `pragma`:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/render-stats-snapshot/index.ts` | Add `cache-control, pragma` to the `Access-Control-Allow-Headers` string (line 7) |

---

## Verification Steps

1. Deploy the updated edge function
2. Navigate to Interactive Templates page
3. Select a Data Template and campaign
4. Click **Server Refresh**
5. Confirm success toast appears instead of error

---

## Why This Was Missed

The initial CORS fix added the `x-supabase-client-*` headers based on the standard Supabase client docs, but this project has a custom client configuration that adds `Cache-Control` and `Pragma` headers. The other working edge functions were created with these headers already included.
