# Scan-Location Timezone Display in Map Tooltip + Browser Time Label on Timeline

**Status: Approved & Implemented**  
**Date: 2026-04-03**

## Summary

Map marker tooltips now display the event time in the **scan location's timezone** (resolved from `zip_codes.timezone` via the event's `zip_code`) with a "local time" suffix. The timeline playback control shows a "browser time" label for clarity. All `parseNaiveDate` calls on `timestamptz` values were replaced with native `new Date()` to fix epoch drift.

## What Changed

### 1. Tooltip — scan-location local time
- If the event has a `zip_code` with a known IANA timezone in `zip_codes.timezone`, the tooltip formats time using `toLocaleString('en-US', { timeZone })` and appends the timezone abbreviation + "local time" (e.g., "Jun 15, 3:42 PM EDT local time").
- If no timezone is available (international events, missing zip), falls back to browser time labeled "browser time".

### 2. Timeline control — browser time label
- Added `<div className="text-[9px] text-muted-foreground">browser time</div>` below the time display in the timeline playback box.

### 3. Timezone data fetch
- After combining view events, unique zip codes are batch-queried against `zip_codes` to build a `Record<string, string>` (zip → IANA timezone) lookup map.
- Each `EventPoint` gets a `timezone?: string | null` field populated from this map.

### 4. `parseNaiveDate` → `new Date()` fix
- `occurred_at` is `timestamptz` (UTC), not a naive floating time. Using `parseNaiveDate` caused ~4-12 hour drift in the staleness filter and timeline epoch calculations.
- All 7 occurrences in `SamizdatMap.tsx` replaced with `new Date(e.occurredAt)`.
- Removed unused `parseNaiveDate` import.

## Files Modified
- `src/components/SamizdatMap.tsx` — all changes
- `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` — this document (new)

## Update — 2026-04-03

### 5. Spawn count shown only on intent/completed markers
- The tooltip spawn count (e.g., "1 spawn") is now hidden on white-bordered ("opened") markers where `engagementState === 'none'`.
- Only markers with amber (intent) or cyan (completed) borders display the spawn count, where it is contextually meaningful.

### 6. Timeline control persists after animation completes
- Removed the `timelinePosition < 1` guard from the timeline date/time box rendering condition.
- The timeline control now remains visible when playback reaches the end, allowing users to see events that haven't passed the 2-day staleness threshold.

## Update — 2026-04-03 (Staleness Toggle Fix)

### 7. Fixed inverted "No Spawns" toggle semantics
- The map's "No Spawns" switch (now renamed **"Hide stale opens"**) had inverted logic: when ON, it skipped the 48-hour staleness filter instead of activating it.
- Root cause: the parent dashboard checkbox "Show events having no spawns" uses `checked=true` to mean "show all" (filter OFF). The map synced this value directly into `showNoSpawnsLocal`, but the filter guard `if (!showNoSpawnsLocal)` treated `false` as "activate filter" — meaning the filter only ran when the parent said "show all."
- Fix: invert the sync point (`setShowNoSpawnsLocal(!showNoSpawns)`) so parent-checked (show all) → map-unchecked (don't hide) and parent-unchecked (hide) → map-checked (hide). The filter guard now reads `if (showNoSpawnsLocal)` — ON means active.
- The staleness tick interval guard was similarly inverted and corrected.

### 8. Unified timeline epoch computation
- The staleness filter previously computed `goLive` and `latestEvent` from channel-filtered events, while the display date/time box computed from all `eventPoints`. This caused the displayed date to diverge from the actual staleness reference time.
- Fix: the filter now computes its epoch from all `eventPoints` (matching the display), ensuring the displayed timestamp and the staleness cutoff are always consistent.

### 9. Renamed toggle label
- Map switch label changed from "No Spawns" to "Hide stale opens" to clarify that enabling it hides markers with no engagement older than 48 hours.
