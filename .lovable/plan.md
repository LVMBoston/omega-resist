

# Feedback Strategy to Minimize Regression Risk

## The Core Problem

When multiple issues are reported together, fixes for one can inadvertently break the other. Additionally, mixing pre-existing bugs with refactor-introduced bugs makes it hard to attribute causes correctly.

## Recommended Feedback Approach

### 1. Categorize Before Reporting

Sort issues into two buckets:

- **Refactor regressions**: Things that worked before the layout change and now don't (e.g., controls distorted in the sidebar). These are high priority.
- **Pre-existing issues**: Things that were broken before the refactor started (e.g., the Leaflet `classList` error on zoom). These should be tracked separately.

### 2. One Issue Per Message

Report one issue at a time, with:
- **What you did** (e.g., "Opened Samizdat Template-1 in the full-page editor, selected hotspot #5 (map), changed zoom")
- **What you expected** (e.g., "Zoom changes without errors")
- **What happened** (e.g., "Toast error: Cannot read properties of null reading classList")
- **Screenshot** (as you've been doing -- this is excellent)

This lets each fix be scoped, tested, and verified independently.

### 3. Verify Before Moving On

After each fix is applied, confirm it works before reporting the next issue. This creates a clear "known good" checkpoint.

## Current Issue Triage

### Issue A: Leaflet `classList` Error on Zoom (Pre-existing)
- **Root cause**: Leaflet's internal DOM manipulation tries to access a container element that has been removed or re-rendered by React. This is NOT caused by the layout refactor.
- **Fix scope**: `MapHotspotRenderer.tsx` -- needs a guard in the map cleanup/re-render lifecycle. Should be addressed as a separate task after the refactor is complete.

### Issue B: Hotspot Width Visual Discrepancy (Needs Investigation)
- **Likely cause**: Map hotspots use a different max-width cap (95%) vs. standard number hotspots. The `width: 100%` in the config means "100% of max-width," which differs by hotspot type.
- **Next step**: Investigate `DraggableHotspotOverlay.tsx` to confirm whether the rendering path applies different constraints for `type: 'map'` vs. `type: 'number'` hotspots. If intentional, document it; if not, normalize.

## Summary

For the current refactor, continue reporting layout/control issues one at a time. Hold Leaflet-internal bugs (like the classList error) as separate follow-up tasks -- they are unrelated to the split-view layout work.

