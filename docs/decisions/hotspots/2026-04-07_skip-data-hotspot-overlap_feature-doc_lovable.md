# Skip Overlap Detection for Data Hotspots

**Date:** 2026-04-07  
**Author:** lovable  
**Status:** Approved & Implemented  
**Project Area:** hotspots

## Summary

Data hotspots (`live_number`, `chart`, `map`) are display-only elements — they have no tap targets and overlapping them is harmless and often intentional (e.g., a live number overlaid on a map). Only action–action overlaps (`sms`, `email`, `social`, `external_link`, etc.) represent a real usability issue with competing tap targets.

## Changes

### `src/lib/hotspotValidation.ts`

- `detectOverlaps()`: inner loop now skips pairs where **either** hotspot has a type in `DATA_HOTSPOT_TYPES`.
- `getAllIntersections()`: same filter applied, so red overlap rectangles on the editor canvas no longer appear for data-involved pairs.
- `checkOverlap()` and `calculateIntersectionRect()`: unchanged — remain available for general bounding-box checks.

### No other files changed

- `FullResolutionHotspotEditor.tsx` calls the shared utility functions and inherits the fix automatically.
- `InteractiveTemplates.tsx` save guard already scopes overlap blocking to `interactive_share` templates; hybrid templates benefit from the filtered logic.

## Rationale

Treating data hotspots as overlappable aligns with their non-interactive nature and removes false-positive warnings that confused editors working on hybrid or stats-page slides.
