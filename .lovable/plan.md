## Goal

Each map hotspot's badge currently shows the total campaign event count (same number on every map). Change it to show the number of events whose coordinates fall within that specific map's current visible bounds, so overlapping or differently-framed maps each show their own count.

## 1. `src/components/MapHotspotRenderer.tsx`

a. Add a `visibleCount` state (number), defaulting to `eventPoints.length`.

b. Add a helper that, given the current Leaflet map bounds, counts `eventPoints` where `bounds.contains([lat, lng])` is true.

c. Recompute `visibleCount` whenever:
   - `eventPoints` changes (after fetch)
   - `mapReady` becomes true
   - The map fires `moveend` or `zoomend` (pan/zoom in editor mode or interactive runtime mode)
   - Initial saved bounds are applied (after the `fitBounds` calls already in the file)

d. Update the badge at lines 711–715 to render `{visibleCount} events` instead of `{eventPoints.length} events`. Keep the badge hidden when `eventPoints.length === 0` (no data at all), matching current behavior. When data exists but `visibleCount === 0`, still render the badge so the user sees `0 events` — that is the signal that this map is framed off the data.

## 2. What does not change

- Data fetching, marker rendering, clustering, interaction handlers.
- SSR snapshot renderer — out of scope unless you want the same badge baked into the static image (ask first).
- No new props on `MapHotspotRenderer`; the count is derived internally from current bounds.

## 3. Technical notes

- Use Leaflet's `map.getBounds().contains(L.latLng(lat, lng))` for filtering — handles antimeridian and is consistent with marker visibility.
- The `moveend` listener already exists for `onBoundsChange`; add the count recompute in the same handler block (or a sibling effect listening to the same events) to avoid duplicate subscriptions.
- Recompute is O(n) over event points; campaign sizes here are small enough that this is fine without memoization.

## 4. Decision log

This is a new plan (not an update to a prior doc). On approval, archive as:
`docs/decisions/hotspots/2026-06-12_map-hotspot-visible-event-count_feature-doc_lovable.md`
