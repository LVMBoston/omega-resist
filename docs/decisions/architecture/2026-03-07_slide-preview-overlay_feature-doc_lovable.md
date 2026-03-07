# Interactive Slide Preview Overlay in DeckEditor

- **Status:** Approved & Implemented
- **Date:** 2026-03-07
- **Author:** Lovable AI + project owner

---

## Summary

Added a static hotspot overlay to the DeckEditor center preview for `spread-word` slides. This renders positioned placeholders showing hotspot type/label over the raw background, enabling meaningful thumbnail capture without requiring live campaign data.

## Changes

1. **`src/components/SlidePreviewOverlay.tsx`** — New component rendering hotspots as positioned boxes:
   - `live_number` → metric label + icon (respects `liveNumberStyle` for manual entries)
   - `chart` → bar-chart icon placeholder
   - `map` → map icon placeholder
   - Action hotspots → action type icon

2. **`src/pages/DeckEditor.tsx`** —
   - Added `previewHotspots` state loaded via `useEffect` when selected slide changes
   - Hotspot resolution priority: staged `hotspotChanges` → per-slide DB config → shared template DB config
   - Center preview renders raw `content_url` (not thumbnail) + `SlidePreviewOverlay`
   - `handleSaveHotspots` now auto-triggers `handleCaptureThumbnail` after 600ms delay

## Files NOT Changed

- `snapshotCapture.ts`
- `FullResolutionHotspotEditor`
- `DraggableHotspotOverlay`
- All rendering components
