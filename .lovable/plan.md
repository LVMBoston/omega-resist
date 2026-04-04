

# Arrow-Key Chain Stepper + Visual Chain Flow

**Date**: 2026-04-03

## Summary

Replace auto-play on chain selection with manual Left/Right arrow-key stepping through chain events. Add visual connectors (polylines) between parent→child events to depict the chain flow.

---

## 1. Remove auto-play on chain selection

a. In `handleMarkerClick`, remove `setTimelinePosition(0)` and `setIsPlaying(true)`.
b. Instead, set `timelinePosition` to `1.0` (show all chain events immediately) and set a new `highlightedEventIndex` state to `0` (highlight the first event in the chain).

## 2. Add arrow-key stepping state

a. New state: `highlightedEventIndex: number | null` — the index into the chain's time-sorted event list that is currently "focused."
b. New memo: `chainEventsOrdered` — the chain's `displayEvents` sorted chronologically, computed only when `viewMode === "chain"`.
c. On chain selection, set `highlightedEventIndex = 0`.
d. On "Show All Events", set `highlightedEventIndex = null`.

## 3. Keyboard handler for Left/Right arrows

a. Add a `keydown` listener (capture phase, like the loupe) that intercepts `ArrowLeft` and `ArrowRight` when `viewMode === "chain"` and the loupe is not active.
b. **Right arrow**: increment `highlightedEventIndex` (clamped to `chainEventsOrdered.length - 1`).
c. **Left arrow**: decrement `highlightedEventIndex` (clamped to `0`).
d. Call `e.preventDefault()` and `e.stopImmediatePropagation()` to prevent map panning.
e. On each step, pan the map to center on the highlighted event's lat/lng (smooth pan, no zoom change) and open its tooltip.

## 4. Visual highlight for the "current" event

a. The highlighted marker gets a pulsing CSS ring (e.g., a `box-shadow` animation) to distinguish it from the rest of the chain.
b. All other chain markers remain visible and static — the user sees the full chain geography at all times.
c. The Event Story panel opens for the highlighted event (reuse existing `setSelectedEventId`).

## 5. Draw polylines connecting chain events (parent→child flow)

a. When `viewMode === "chain"`, draw `L.polyline` segments connecting each event to its parent event (using `parentToken` → matching `token` in the same chain).
b. Line style: dashed, semi-transparent, colored by the child's level color. Weight: 2px.
c. Add a small arrowhead (using CSS or SVG marker) at the child end to show direction.
d. Lines are added to the same `layerGroup` as the markers so they filter/clear together.
e. For co-located parent/child (same ZIP), the jitter already separates them, so the short line is still visible.

## 6. Retain existing Play/Pause controls

a. The timeline slider, Play/Pause, and speed controls remain functional for users who prefer continuous animation.
b. Arrow-key stepping and Play/Pause coexist — pressing an arrow key while playing pauses playback and jumps to the nearest event.

## 7. Update decision doc

a. Append a new `## Update — 2026-04-03 (Arrow-Key Chain Stepper)` section to `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md`.

---

## Files Modified

- `src/components/SamizdatMap.tsx` — arrow-key handler, highlighted index state, polyline drawing, pulse style, remove auto-play
- `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` — new update section

