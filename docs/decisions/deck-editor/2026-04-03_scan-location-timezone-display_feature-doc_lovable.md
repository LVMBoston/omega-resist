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
