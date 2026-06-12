# Hotspot Z-Index (Layer) Control

**Status:** Approved & Implemented
**Date:** 2026-06-12

## Summary

Added a per-hotspot **Z** (stacking order) control alongside the existing W and H sliders in every calibration panel (action / live number, chart, map). Higher Z = on top when hotspots overlap.

- Range: `0`–`99`, integer step.
- Default: `1` (matches today's behavior — existing hotspots are unaffected).
- Persisted as `Hotspot.zIndex` in the hotspots JSONB column (no DB migration).

## Why

Hotspots can overlap (especially full-canvas maps under labels, or transparent tap targets over images). Until now there was no way to choose which one renders on top — order depended on array position.

## Editor / SSR Parity

Per the editor/SSR render-parity rule, all renderers honor `zIndex`:

| Layer | File | Mechanism |
|---|---|---|
| Editor canvas (full-resolution) | `src/components/FullResolutionHotspotEditor.tsx` | `zIndex: dragging ? 1000 : (hotspot.zIndex ?? 1)` applied to each wrapper |
| Data template canvas | `src/components/DraggableHotspotOverlay.tsx` | same pattern |
| Runtime viewer | `src/components/InteractiveSlideOverlay.tsx` | `zIndex` on `transparentStyle` + live number + video button wrappers |
| Snapshot SVG | `supabase/functions/render-stats-snapshot/index.ts` | All hotspot SVG fragments (maps, images, text) merged into one array and stably sorted by `zIndex` ascending so higher Z paints last |

## Files Changed

| File | Change |
|------|--------|
| `src/types/viralTemplates.ts` | Added optional `zIndex?: number` on `Hotspot` |
| `src/components/FullResolutionHotspotEditor.tsx` | Local Hotspot type + `zIndex` on 5 wrapper style blocks |
| `src/components/HotspotCalibrationControls.tsx` | Row 4 became **W / H / Z** 3-col |
| `src/components/ChartCalibrationControls.tsx` | Added **Z** slider after H |
| `src/components/MapCalibrationControls.tsx` | Size grid became **W / H / Z** 3-col |
| `src/components/DraggableHotspotOverlay.tsx` | `zIndex` on map, chart, live number wrappers |
| `src/components/InteractiveSlideOverlay.tsx` | `zIndex` on live number wrapper, `transparentStyle`, video button |
| `supabase/functions/render-stats-snapshot/index.ts` | Tagged map/image/text SVG entries with `z`, merged + stable-sorted before SVG assembly |

## Backwards Compatibility

- Existing hotspots with no `zIndex` field fall back to `1`, matching previous render order.
- No database migration required (JSONB).
- Snapshot SVG output is byte-identical for any template whose hotspots all use the default `1`.
