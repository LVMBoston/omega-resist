## Goal

Give each hotspot a "Z" (layer) value so you can choose which one sits on top when they overlap. The control appears alongside W and H in the right-side calibration panel for **all three** hotspot families (action / live number, chart, map).

## 1. What you'll see

a. The W / H row becomes a **W / H / Z** row in every calibration panel.
b. Z is a numeric stepper from **0 to 99** (default **1**). Higher number = on top.
c. The change is immediately visible in the editor canvas, in the live deck viewer, and in saved snapshot images.

## 2. Where it applies

a. **Action hotspots** (sms, email, social, video, external link, app download, image, email links, transparent) — `HotspotCalibrationControls`.
b. **Live number hotspots** — same `HotspotCalibrationControls`.
c. **Chart hotspots** — `ChartCalibrationControls`.
d. **Map hotspots** — `MapCalibrationControls`.

## 3. Technical changes

a. Add optional `zIndex?: number` to the `Hotspot` interface in `src/types/viralTemplates.ts`. No DB migration — hotspots are stored as JSON.
b. Add a Z `SliderWithButtons` to the three calibration components, converting the existing 2-column W/H row into a 3-column W/H/Z row.
c. Apply `zIndex: hotspot.zIndex ?? 1` to every hotspot wrapper `style={{ ... }}` in:
   - `src/components/FullResolutionHotspotEditor.tsx` (editor canvas — multiple per-type branches)
   - `src/components/DataTemplateEditor.tsx` (data template canvas)
   - `src/components/InteractiveSlideOverlay.tsx` (runtime viewer — all hotspot branches incl. transparent, video, live number, chart, map, image, etc.)
d. **Snapshot parity** (per the editor/SSR render-parity rule): in `supabase/functions/render-stats-snapshot/canvas.ts`, sort hotspots by `zIndex` ascending before drawing so higher Z paints last/on top.

## 4. Backwards compatibility

a. Existing hotspots have no `zIndex` — they fall back to `1`, matching today's behavior. Nothing visually changes until you start adjusting Z values.
b. No database migration needed.

## 5. Decision log

a. New file: `docs/decisions/hotspots/2026-06-12_z-index-layer-control_feature-doc_lovable.md` with `Status: Approved & Implemented`.
