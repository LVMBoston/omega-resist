
# Plan: Data Hotspot Support in FullResolutionHotspotEditor (6c + 6b)

**Date: 2026-04-06**

---

## 1. Extract `classifyHotspots` to shared utility (6b ride-along)

a. Create `src/lib/hotspotClassification.ts` with the `classifyHotspots(hotspots): { slideType, templateType }` function currently inline in `DeckEditor.tsx`.
b. Update `DeckEditor.tsx` to import from the new shared utility.
c. Update `InteractiveTemplates.tsx` (Template Repository) to use the same function for any classification logic.

## 2. Add three new icon categories to `FullResolutionHotspotEditor`

a. Add `IconCategory` entries: `"live_number"`, `"chart"`, `"map"`.
b. Add icon presets:
   - `live_number`: single preset `{ id: "live-number", type: "live_number", width: 20, height: 8 }` (default hotspot box).
   - `chart`: single preset `{ id: "chart-stacked", type: "chart", width: 40, height: 30 }`.
   - `map`: single preset `{ id: "map-activity", type: "map", width: 50, height: 40 }`.
c. Add category images/icons/labels (using `Hash`, `BarChart3`, `MapIcon` from lucide).
d. Add to `allowMultiple` array (all three allow multiple instances).

## 3. Campaign selector for live preview

a. Add a campaign dropdown (reusing the same Supabase query pattern from `DataTemplateEditor`) at the top of the right-hand properties panel, visible whenever ≥1 data hotspot exists.
b. Wire `useLiveMetrics(campaignCode)` to populate `displayValues` for `live_number` hotspots.
c. Pass `campaignCode` to `ChartHotspotRenderer` and `MapHotspotRenderer` on the canvas.
d. Include the "clear selection" X button with the `userClearedCampaign` ref pattern (per existing fix doc).
e. Campaign selection is preview-only — not saved with the template.

## 4. Canvas rendering for data hotspots

a. For `live_number` hotspots: render a styled rectangle with scaled font size (reusing the `baseFontSize * (imageWidth / 1080)` formula from `DraggableHotspotOverlay`), showing the resolved metric value or "—" placeholder.
b. For `chart` hotspots: render `ChartHotspotRenderer` when campaignCode is set, otherwise a `BarChart3` placeholder icon.
c. For `map` hotspots: render `MapHotspotRenderer` when campaignCode is set, otherwise a `MapIcon` placeholder. Include the lock/unlock toggle and isolated drag handle (same pattern as `DraggableHotspotOverlay`).
d. All three types support drag-to-reposition using the existing editor drag system.

## 5. Type-specific calibration controls in the right panel

a. When a `live_number` hotspot is selected: embed `HotspotCalibrationControls` (metric picker, font family/size/weight, color pickers, text/vertical alignment, padding, border radius).
b. When a `chart` hotspot is selected: embed `ChartCalibrationControls` (chart type, data source, axis toggles) plus position/size sliders.
c. When a `map` hotspot is selected: embed `MapCalibrationControls` (map style, clustering toggle, zoom, saved bounds) plus position/size sliders.
d. Position (x/y) and size (width/height) sliders are shown for all data hotspot types (same as existing action hotspots get position controls).

## 6. Auto-classification integration

a. When saving, use the extracted `classifyHotspots()` from step 1 to auto-set `template_type` based on the mix of hotspot types present.
b. No change to the existing save flow — just swap inline logic for the shared import.

## 7. What does NOT change

- The `DataTemplateEditor` remains fully functional (no removal).
- The Template Repository creation paths remain unchanged (deferred to future 6a/6d work).
- Snapshot generation/deployment stays in `DataTemplateEditor` only.
- The `DraggableHotspotOverlay` component is not modified — rendering logic is adapted into the editor's own canvas layer.
- No database schema changes.

## 8. Files changed

- `src/lib/hotspotClassification.ts` (new)
- `src/components/FullResolutionHotspotEditor.tsx` (categories, presets, canvas rendering, right-panel controls, campaign selector)
- `src/pages/DeckEditor.tsx` (import classifyHotspots from shared utility)
- `src/pages/InteractiveTemplates.tsx` (import classifyHotspots if applicable)
- `docs/decisions/deck-editor/2026-04-06_data-hotspot-editor-integration_feature-doc_lovable.md` (new decision doc)

## 9. Implementation sequence

a. Step 1 first (extract utility) — small, independent.
b. Steps 2–5 together (the main feature).
c. Step 6 is automatic (already wired via the shared utility).
d. Step 8 decision doc last.
