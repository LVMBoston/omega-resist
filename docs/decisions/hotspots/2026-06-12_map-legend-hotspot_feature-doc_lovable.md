# Map Legend Hotspot

Status: Approved & Implemented
Date: 2026-06-12

## 1. Goal
A placeable static visual key explaining the symbols drawn by the map hotspot. No data fetch — purely a legend.

## 2. Legend items (fixed)
a. QR — `#000099`
b. Email — `#0066ff`
c. Text / SMS — `#99ccff`
d. Other — `#64748b`
e. Seed with spawns — slate dot with green ring (`#22c55e`)

## 3. UX
a. Implemented as a new `metricKey: "map_legend"` on the existing live-number hotspot — inherits W, H, Z, transparency.
b. Font-size drives swatch size (swatch ≈ `0.9 × fontSize`) so the legend scales proportionally.
c. Width too narrow → labels truncate with ellipsis. Height too small → bottom rows clip (overflow hidden).
d. Color, background, padding, font family/weight all flow from the existing live-number style controls.

## 4. Files changed
- `src/types/viralTemplates.ts` — added `'map_legend'` to `LiveMetricKey`.
- `src/components/MapLegend.tsx` — new shared renderer + `MAP_LEGEND_ITEMS` source of truth.
- `src/components/HotspotCalibrationControls.tsx` — added "🗺️ Map Legend" dropdown option.
- `src/components/SlidePreviewOverlay.tsx` — added label + icon for editor thumbnail.
- `src/components/HybridSlide.tsx` — short-circuit live_number branch on map_legend.
- `src/components/FullResolutionHotspotEditor.tsx` — same short-circuit for in-editor canvas.
- `src/components/InteractiveSlideOverlay.tsx` — same short-circuit for viewer.
- `src/hooks/useLiveMetrics.ts`, `src/pages/DataTemplateTestHarness.tsx` — METRIC_LABELS map exhaustiveness.
- `supabase/functions/render-stats-snapshot/index.ts` — SSR parity (SVG `<circle>` + `<text>` per row, clipped to bounds).

## 5. Out of scope
- No changes to `MapHotspotRenderer.tsx` marker drawing.
- No DB schema changes.
- No auto-filtering of legend rows by present channels (fixed list, per user).
