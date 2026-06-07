# Unify Map Rendering — CartoDB Server-Side Stitching

Status: Approved & Implemented
Date: 2026-06-07

## 1. Decision

Replace the Mapbox Static Images API call in `supabase/functions/render-stats-snapshot/index.ts` with a server-side CartoDB Positron tile-stitching renderer. This makes the SSR snapshot pixel-faithful to the live Leaflet editor and eliminates Mapbox from the entire stack (honoring the project rule: "Mapbox is forbidden due to iOS Safari WebGL 1 limitations").

## 2. What changed

a. **No more Mapbox.** Removed `api.mapbox.com` request and `MAPBOX_PUBLIC_TOKEN` dependency from the snapshot path. (Secret still exists in env but is unused; safe to remove later.)
b. **Server-side tile fetcher.** `fetchCartoTile()` pulls `https://{a|b|c}.basemaps.cartocdn.com/{slug}/{z}/{x}/{y}.png` — identical to the editor.
c. **Web-mercator math.** `lngToWorldX`, `latToWorldY`, `zoomForBounds` mirror Leaflet's projection.
d. **Stitching.** `imagescript@1.2.17` decodes each PNG tile and composites into a canvas sized to the hotspot's pixel dimensions (`pixelWidth` x `pixelHeight`) — no silent re-fitting that could swap landscape↔portrait.
e. **Viewport source of truth.** `savedCenter`+`savedZoom` first; `savedBounds` fallback with computed fit zoom; US center default if neither is set.
f. **Label density.** `labelDensity = no_labels` → `light_nolabels` tiles; `labels` → `light_all`; `auto` mirrors the editor's small-display rule.
g. **Marker drawing.** Same `MEDIUM_COLORS` palette as `MapHotspotRenderer.tsx` (qr/em/sms/tx), with white stroke ring, or green stroke when the token has spawned children.

## 3. Tradeoffs

a. No Leaflet clustering on the server — raw pins only. Acceptable for static snapshots.
b. Tile fetch cost: ~6–12 tiles per snapshot at typical zooms; fetched in parallel; well within edge-function budget.
c. Marker rendering is pixel-drawn rather than SVG — slightly different antialiasing vs. the live map, but visually consistent at snapshot resolution.

## 4. Verification

a. Re-render a slide whose map hotspot is in landscape and confirm the snapshot is also landscape (no portrait swap).
b. Confirm marker positions align with the editor at the same `savedCenter`/`savedZoom`.
c. Confirm `labelDensity = no_labels` produces a label-free basemap.

## 5. Files touched

- `supabase/functions/render-stats-snapshot/index.ts` — `renderStaticMap()` rewritten.

## Update — 2026-06-07

a. **Fractional zoom honored.** `savedZoom` is no longer rounded to the nearest integer. Tiles are fetched at `tileZ = round(zoom)` and resized by `2^(zoom - tileZ)` before compositing, so a zoom of 4.5 renders correctly instead of snapping to 4 or 5.
b. **Literal fontSize for text hotspots.** Removed the `width / 960` silent rescaling. Each hotspot's `liveNumberStyle.fontSize` is now used verbatim so text matches the editor's stored value.

