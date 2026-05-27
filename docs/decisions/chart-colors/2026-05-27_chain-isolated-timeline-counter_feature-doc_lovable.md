# Chain-Isolated Timeline Counter

**Status: Approved & Implemented**
**Date: 2026-05-27**

## Problem

When a chain (L00 instance) is isolated on the Samizdat map, the timeline counter still read `Events: X / 117` — the denominator was the full campaign and the numerator was unfiltered by chain.

## Fix

In `src/components/SamizdatMap.tsx`, the counter under the timeline slider now branches on view mode:

- **Chain mode + selected instance**: `Events: {displayEvents.length} / {chainTotal}`, where `chainTotal = eventPoints.filter(e => e.l00Instance === selectedL00Instance).length`.
- **All-events mode** (unchanged): `Events: {filteredEventPoints.length} / {eventPoints.length}`.

`displayEvents` is already chain-scoped and timeline-clipped, so it serves as the numerator directly.

## What Does Not Change

- Timeline duration / playback easing (already chain-scoped at lines 372–382, 478–484)
- Marker rendering, clustering, channel/staleness filters
- All-events mode behavior
