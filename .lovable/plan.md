

# Plan: Fix Edge Function CORS Headers

## Problem Analysis
The `render-stats-snapshot` edge function works when called server-side but fails with "Load failed" from the browser. The network logs show the POST request errors out without a response.

**Root Cause:** The Supabase JS client sends additional headers that aren't included in the edge function's `Access-Control-Allow-Headers`:
- Current allowed: `authorization, x-client-info, apikey, content-type`
- Client is sending: `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`

When the browser's preflight (OPTIONS) request doesn't get back these headers as "allowed", the actual POST is blocked.

---

## Solution

Update the CORS headers in `supabase/functions/render-stats-snapshot/index.ts` to include all headers that the Supabase JS client might send:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/render-stats-snapshot/index.ts` | Update `corsHeaders` object on lines 5-8 to include all Supabase client headers |

---

## Verification Steps

1. Deploy the updated edge function
2. Navigate to Interactive Templates page
3. Select a Data Template and campaign
4. Click the **Server Refresh** button
5. Confirm the toast shows success instead of the "Load failed" error

---

## Technical Notes

- The edge function logic is already working correctly (confirmed via direct test)
- This is purely a browser CORS preflight issue
- No changes needed to the config.toml since `verify_jwt = false` is already set

