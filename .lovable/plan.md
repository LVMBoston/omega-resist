# Plan — Map Legend Hotspot

Status: Approved
Date: 2026-06-12

## 1. Goal

Add a placeable "Map Legend" element so a slide can show what the symbols on the map mean (marker colors per channel, and the green ring for seeds that produced spawns). The legend is a static visual key — it does not query data.

## 2. What the legend shows

Pulled directly from `MapHotspotRenderer` so it always matches the map:

a. QR — navy dot (`#000099`)
b. Email — medium blue dot (`#0066ff`)
c. Text / SMS — light blue dot (`#99ccff`)
d. Other — slate dot (`#64748b`)
e. Green ring — "this seed has spawns"

Fixed list (always all five), confirmed with user.

## 3. UX

a. New entry in the Live Number metric dropdown: **"Map Legend"** (`metricKey: "map_legend"`).
b. Reuses live-number hotspot — inherits W, H, Z, transparency, font-size, color, background, padding, alignment.
c. Swatch size scales with font-size so legend stays proportional.
d. `overflow: hidden` so contents never spill outside the user's box.
e. Rendered in editor preview overlay so the deck-editor thumbnail matches.

## 4. Files to change

a. `src/types/viralTemplates.ts` — add `"map_legend"` to metric-key union.
b. Runtime live-number renderer (locate during build, likely `LiveNumberRenderer.tsx` or inline in `InteractiveSlideOverlay.tsx`) — when `metricKey === "map_legend"`, render swatch list.
c. `src/components/SlidePreviewOverlay.tsx` — add `map_legend` label + mini swatch preview.
d. Metric dropdown component (likely in hotspot calibration) — add option.
e. `supabase/functions/render-stats-snapshot/index.ts` — SSR parity: render same legend in snapshot SVG.

## 5. What does NOT change

- `MapHotspotRenderer.tsx` marker drawing
- Database schema
- Hotspot drag/resize/Z/transparency behavior

## 6. Decision log

Archive to `docs/decisions/hotspots/2026-06-12_map-legend-hotspot_feature-doc_lovable.md` with `Status: Approved & Implemented`. This is a **new** plan (not an update to a prior decision).
