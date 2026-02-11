

# Fix: iOS Snapshot Blocked by HEAD Pre-Check

## Root Cause

`StatsPageSlide.tsx` validates snapshot URLs with a cross-origin `fetch(url, { mode: 'cors', method: 'HEAD' })` before rendering the `<img>` tag. iOS Safari ITP blocks this fetch, which sets `snapshotLoadFailed = true`, causing the component to fall back to dynamic metric rendering -- which also partially fails because ITP blocks some Supabase API calls too.

## The Fix

On mobile devices, skip the `fetch`-based HEAD pre-check entirely. Instead, render the snapshot `<img>` tag directly and rely on the `onError` handler (which already exists at line 301-305) to detect broken images. The `<img>` tag loads cross-origin images without ITP interference because image loading is not subject to the same restrictions as `fetch`.

## Changes

### 1. `src/components/StatsPageSlide.tsx`

**Modify the snapshot validation effect (lines 242-269)**:
- Add a condition: if `isMobile`, skip the HEAD fetch and set `validatedSnapshotUrl` directly from `campaignSnapshotUrl`.
- On desktop, keep the existing HEAD pre-check behavior unchanged.

The change is approximately:

```
useEffect(() => {
  if (!shouldUseCachedSnapshot || !campaignSnapshotUrl) {
    setValidatedSnapshotUrl(null);
    return;
  }

  // On mobile, skip HEAD pre-check (ITP blocks cross-origin fetch)
  // Rely on <img> onError handler instead
  if (isMobile) {
    setValidatedSnapshotUrl(campaignSnapshotUrl);
    return;
  }

  // Desktop: existing HEAD validation logic unchanged
  ...
});
```

### 2. No other files changed

- No database changes
- No edge function changes  
- The existing `onError` handler on the snapshot `<img>` (line 301-305) already handles the fallback if the image itself fails to load

## Why This Works

- `<img src="...">` tags load cross-origin resources without being blocked by ITP (images are exempt from tracking prevention)
- The HEAD fetch was a pre-optimization to avoid rendering a broken `<img>`, but on mobile it causes the exact problem it tries to prevent
- Desktop keeps the HEAD check since it doesn't have ITP issues

