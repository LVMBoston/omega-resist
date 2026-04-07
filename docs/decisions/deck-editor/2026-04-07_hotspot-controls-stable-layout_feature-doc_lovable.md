# Stabilize & Regroup HotspotCalibrationControls Layout

**Date:** 2026-04-07  
**Author:** lovable  
**Status:** Approved & Implemented  
**Project Area:** deck-editor

## Summary

The `HotspotCalibrationControls` component had two UX issues:
1. Selecting "Manual Entry" conditionally inserted a Label textarea, pushing all controls below it and causing disorientation.
2. Controls were not logically grouped (e.g., Font was far from Size/Weight).

## Changes

### `src/components/HotspotCalibrationControls.tsx`

- **Stable Label field**: The Label textarea is now always rendered. When `metricKey !== "manual_entry"`, it appears as `disabled` with `opacity-40`, keeping the grid layout stable.
- **Logical grouping**: Controls reordered into semantic rows:
  - Row 1: Metric | Label
  - Row 2: Size | Weight | Font (3-column)
  - Row 3: X | Y
  - Row 4: W | H
  - Row 5: H-Align | V-Align
  - Row 6: Text Color | BG Color
  - Row 7: Preview
- **Size control**: Converted from `SliderWithButtons` to a compact number input to fit the 3-column row with Weight and Font.

## Rationale

Keeping the Label field always present prevents layout shifts when toggling metric types. Grouping Size/Weight/Font together and pairing alignment controls makes the panel scannable and predictable.

## Update — 2026-04-07: Fine Zoom Controls for Map Hotspots

### Problem
The mouse scroll wheel zoom on map hotspots is too coarse for precise framing.

### Changes

#### `src/components/DraggableHotspotOverlay.tsx`
- Added `mapControlsRef` to store `MapControls` instances keyed by hotspot ID.
- When a map hotspot is **unlocked**, +/− buttons appear below the lock toggle (right edge), each zooming by 0.5 levels for fine control.
- The `onMapReady` callback now stores controls locally in addition to forwarding them upstream.

### Rationale
Fractional zoom (±0.5) provides much finer framing control than the default scroll wheel (±1 level per tick).
