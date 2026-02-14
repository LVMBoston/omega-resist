
# Fix Map Pan/Zoom Mismatch Between Editor and Snapshot

## Problem
The server-side snapshot maps show a different viewport than what was calibrated in the Template Editor. This happens because the edge function converts Leaflet's bounding box (`north/south/east/west`) into a `center,zoom` pair using an approximate formula (`log2(360/span)`) that ignores container aspect ratio and Mercator distortion.

## Solution
Use Mapbox Static API's native **bounding box viewport** format instead of computing `center,zoom`. The API accepts `[west,south,east,north]` directly, which maps 1:1 to the Leaflet savedBounds.

## Changes

**File: `supabase/functions/render-stats-snapshot/index.ts`** (single change, ~5 lines)

Replace the current savedBounds-to-viewport conversion:
```
// Current (lossy):
viewport = `${centerLon},${centerLat},${zoom}`;
```

With the bounding box format:
```
// New (exact):
viewport = `[${savedBounds.west},${savedBounds.south},${savedBounds.east},${savedBounds.north}]`;
```

This eliminates the center/zoom calculation entirely. The `padding` parameter is also valid with bounding box viewports, so it can be re-enabled for this mode too.

## Risk Assessment
- **Low risk**: Single-line change in the viewport string format
- **No frontend changes** required
- **Automatic deployment**: Edge function deploys without publishing
- **Verification**: Re-render the snapshot and compare side-by-side with the editor

## Technical Detail
Mapbox Static API viewport formats:
- `auto` -- fit all overlays
- `lon,lat,zoom` -- explicit center (what we use now, lossy)
- `[west,south,east,north]` -- bounding box (what Leaflet stores, exact match)
