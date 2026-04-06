# Data Hotspot Support in FullResolutionHotspotEditor (6c + 6b)

**Status: Approved & Implemented**  
**Date: 2026-04-06**

## Problem

The `FullResolutionHotspotEditor` (used in the Deck Editor for inline hotspot editing) only supported action hotspot types (sms, email, social, external_link, email_links, video). Data hotspot types (`live_number`, `chart`, `map`) could only be created via the separate `DataTemplateEditor` in the Template Repository. This created a capability gap: the auto-classifier in the Deck Editor recognized data types it could never produce.

Additionally, the `classifyHotspots` function was defined inline in `DeckEditor.tsx`, making it unavailable for reuse elsewhere.

## Solution

### 1. Extract `classifyHotspots` to shared utility (6b)

Created `src/lib/hotspotClassification.ts` with:
- `ACTION_HOTSPOT_TYPES` — Set of action type strings
- `DATA_HOTSPOT_TYPES` — Set of data type strings (`live_number`, `chart`, `map`)
- `classifyHotspots(hotspots)` — Returns `{ slideType, templateType }` based on hotspot mix

Updated `DeckEditor.tsx` to import from the shared utility instead of defining inline.

### 2. Add data hotspot categories to editor (6c)

Added three new `IconCategory` entries to `FullResolutionHotspotEditor`:
- `live_number` — preset: `{ id: "live-number", width: 20, height: 8 }`
- `chart` — preset: `{ id: "chart-stacked", width: 40, height: 30 }`
- `map` — preset: `{ id: "map-activity", width: 50, height: 40 }`

Category selector now shows two labeled sections: **Action** (6 categories) and **Data** (3 categories with dashed borders).

### 3. Campaign selector for live preview

- Added a campaign dropdown at the top of the editor, visible when ≥1 data hotspot exists.
- Wired `useLiveMetrics(campaignCode)` to populate `displayValues` for live_number hotspots.
- Campaign selection is preview-only — not saved with the template.
- Includes "clear selection" X button with `userClearedCampaign` ref pattern.

### 4. Canvas rendering

- `live_number`: Styled rectangle with scaled font (1080px reference width), showing resolved metric value or "—".
- `chart`: `ChartHotspotRenderer` when campaign selected, otherwise `BarChart3` placeholder.
- `map`: `MapHotspotRenderer` with lock/unlock toggle and isolated drag handle, otherwise `MapIcon` placeholder.

### 5. Type-specific calibration controls

When a data hotspot is selected, the right panel shows:
- `live_number` → `HotspotCalibrationControls` (metric picker, font styling, alignment, colors)
- `chart` → `ChartCalibrationControls` (chart type, data source, axis toggles, position/size)
- `map` → `MapCalibrationControls` (map style, clustering, zoom, saved bounds, position/size)

### 6. Thumbnail generation

Data hotspots are skipped during thumbnail generation (they render dynamically at runtime).

## Backward Compatibility

- No database schema changes.
- Existing action-only templates work identically.
- The `DataTemplateEditor` and Template Repository remain fully functional (no removal).
- Existing `classifyHotspots` behavior is preserved exactly via the shared utility.

## Files Changed

- `src/lib/hotspotClassification.ts` (new — shared classification utility)
- `src/components/FullResolutionHotspotEditor.tsx` (data categories, campaign selector, canvas rendering, calibration controls)
- `src/pages/DeckEditor.tsx` (import classifyHotspots from shared utility)
- `docs/decisions/deck-editor/2026-04-06_data-hotspot-editor-integration_feature-doc_lovable.md` (new — this document)
