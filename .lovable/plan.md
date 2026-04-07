

# Skip Overlap Detection for Data Hotspots

## Problem
The overlap validator treats all hotspots identically. Data hotspots (`live_number`, `chart`, `map`) are display-only — overlapping them is harmless and often intentional. Only action–action overlaps represent a real usability issue (competing tap targets).

## Plan

### 1. Update `detectOverlaps` in `src/lib/hotspotValidation.ts`
   a. Import or inline the `DATA_HOTSPOT_TYPES` set from `src/lib/hotspotClassification.ts`.
   b. In the inner loop of `detectOverlaps`, skip pairs where **either** hotspot is a data type (i.e., only flag when both are action types).
   c. Apply the same filter in `getAllIntersections` so the red overlap rectangles on the canvas also disappear for data-involved pairs.

### 2. Update `InteractiveTemplates.tsx` save guard
   a. The save-blocking check on line ~464 already only runs for `interactive_share` templates, so no change needed there. But confirm that hybrid templates (which mix action + data) also benefit from the filtered overlap logic.

### 3. No changes needed
   - `FullResolutionHotspotEditor.tsx` — it calls `detectOverlaps`/`getAllIntersections` from the shared utility, so it inherits the fix automatically.
   - `checkOverlap` — remains available for general bounding-box checks if ever needed.

### 4. Archive decision document
   a. Save to `docs/decisions/hotspots/2026-04-07_skip-data-hotspot-overlap_feature-doc_lovable.md` as a new decision.

## Files Changed
- `src/lib/hotspotValidation.ts` — filter data hotspot pairs from `detectOverlaps` and `getAllIntersections`
- `docs/decisions/hotspots/2026-04-07_skip-data-hotspot-overlap_feature-doc_lovable.md` (new)

