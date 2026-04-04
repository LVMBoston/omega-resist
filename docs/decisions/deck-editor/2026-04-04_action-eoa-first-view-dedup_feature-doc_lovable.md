# Deduplicate Map Markers for Action-Type EoAs + Return Visit Narrative

**Date**: 2026-04-04
**Author**: lovable
**Status**: Approved & Implemented
**Project Area**: Samizdat Map / Event Story

## Summary

For Action-type EoAs, the Samizdat map now shows only the **first view event per token**, collapsing return visits into a single marker. The Event Story narrative for that marker includes how many times the recipient opened the message and over what time period.

## Context

Action-type EoAs represent persistent distribution points (e.g., a flyer posted on a bulletin board). When the same person re-opens the link days or weeks later, that's a **return visit** — a positive retention signal. However, on the map, each return visit previously generated an overlapping marker at the same jittered location, creating visual noise without conveying new geographic information.

Event-type EoAs are not affected: every scan at an Event represents a unique person (the `maybe_reinstantiate_l00` function ensures each scan gets a fresh instance token).

## What Changed

### 1. Map deduplication (`src/components/SamizdatMap.tsx`)

- Added `type` to the EoA select query.
- Built an `eoaTypes` lookup mapping EoA ID → type.
- After sorting events chronologically, filter to keep only the first view per token for Action-type EoAs. Event-type EoAs retain all markers.
- Downstream processing (ZIP lookup, engagement states, point building) uses the deduplicated event list.

### 2. Return visit stats in narrative (`src/components/EventStoryPanel.tsx`)

- Added `returnVisitCount` and `returnVisitSpan` state.
- For Action-type L00 tokens, fetches all view events for the token to compute total opens and time span between first and last.
- In `generateNarrative()`, when the event is the first view and the EoA is Action-type with return visits, appends: "The recipient opened this message N times over [span], indicating they held onto it."

## Related

- Companion doc: `2026-04-04_return-visit-narrative-reframe_feature-doc_lovable.md` (campaign-level narrative copy change)
- `maybe_reinstantiate_l00` DB function: ensures Event-type EoAs always get fresh instance tokens per scan (no dedup needed)
