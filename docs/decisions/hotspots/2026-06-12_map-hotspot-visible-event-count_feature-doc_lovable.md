Status: Approved & Implemented
Date: 2026-06-12

# Map Hotspot — Per-Map Visible Event Count

Each map hotspot's badge now shows the number of events whose coordinates fall within that map's current visible bounds, instead of the campaign-wide total. Overlapping or differently-framed maps on the same slide now each show their own count.

## Implementation

`src/components/MapHotspotRenderer.tsx`:
- Added `visibleCount` state.
- New effect computes `bounds.contains(L.latLng(lat, lng))` over `eventPoints` and updates on `moveend` / `zoomend`, plus on initial mount and whenever `eventPoints` changes.
- Badge renders `{visibleCount} events`. Hidden only when there is no data at all; shows `0 events` when data exists but the map is framed off it.

Out of scope: SSR snapshot renderer (no badge baked into static images).
