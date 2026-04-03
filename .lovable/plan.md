

# Plan: Scan-Location Timezone in Tooltip + Browser Time Label on Timeline

## What Changes

1. **Tooltip shows time in the scan location's timezone** with "local time" suffix
2. **Timeline control** gets a "browser time" label beneath the time display
3. **Fix `parseNaiveDate` misuse** — `occurred_at` is `timestamptz`, not naive

## Implementation

### 1. Add `timezone` field to `EventPoint` (line 73)
a. Add `timezone?: string | null` to the interface.

### 2. Batch-fetch timezones from `zip_codes` during data load (~line 620)
a. After combining events, collect unique non-null `zip_code` values.
b. Query `zip_codes` table: `SELECT zip_code, timezone FROM zip_codes WHERE zip_code IN (...)`.
c. Build a `Record<string, string>` lookup map (zip → IANA timezone).

### 3. Attach timezone when constructing `EventPoint` (~line 800)
a. Set `timezone: zipTimezoneMap[event.zip_code] || null` on each point.

### 4. Update tooltip to use scan-location timezone (line 965)
a. If `event.timezone` exists, format with `toLocaleString('en-US', { timeZone: event.timezone, ... })` and append the timezone abbreviation + "local time".
b. Fallback (no zip / international): use browser timezone, label "browser time".

### 5. Add "browser time" label to timeline box (line 1393)
a. Add `<div className="text-[9px] text-muted-foreground">browser time</div>` after the time line.

### 6. Replace all `parseNaiveDate(e.occurredAt)` with `new Date(e.occurredAt)` 
a. Lines 331, 344, 347, 351, 420, 422, 459 — these are all `timestamptz` values that should use native `Date` parsing, not naive digit extraction.

### 7. Archive decision document
a. New file: `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md`

## Files Modified
- `src/components/SamizdatMap.tsx` (steps 1–6)
- `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` (step 7, new)

