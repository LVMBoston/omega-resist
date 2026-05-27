## Problem

When you isolate a chain (e.g., `ea5509…`), the timeline still reads `Events: X / 117` — the denominator is the entire campaign, and the numerator (`filteredEventPoints.length`) also includes non-chain events. It should report against just the 6 events that belong to the isolated instance.

## Fix

In `src/components/SamizdatMap.tsx`:

1. **Counter (line 1777)** — when `viewMode === "chain"` and `selectedL00Instance` is set, render `Events: {displayEvents.length} / {chainTotalEvents}` instead of using `filteredEventPoints` / `eventPoints`.
   - a. `displayEvents` is already scoped to the chain (line 463) and to the timeline cutoff (via `filteredEventPoints`), so the numerator becomes the visible chain events.
   - b. `chainTotalEvents` = count of `eventPoints` where `l00Instance === selectedL00Instance` (memoize alongside the existing chain memos).

2. **No changes** to playback speed, slider range, or `totalDurationMs` — those are already chain-scoped (lines 372–382, 478–484).

## What does not change

- All-events mode behavior
- Timeline duration / playback easing
- Marker filtering, clustering, channel filters

## Decision log

New plan: `docs/decisions/chart-colors/2026-05-27_chain-isolated-timeline-counter_feature-doc_lovable.md` (new file).