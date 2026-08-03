# Map Animation Date Range Control

Status: Approved & Implemented
Date: 2026-08-03

## 1. Summary

The Real-time map's timeline playback now accepts an explicit start/end date range, so a
recording can cover exactly the days chosen instead of always spanning go-live to latest event.

## 2. Behavior

a. New row in the playback panel: `From [mm/dd/yyyy] To [mm/dd/yyyy]` plus an `Auto` reset button.
b. Empty fields = prior behavior (auto range from EoA go-live dates to latest event).
c. Start anchors to 12:00 AM local; end anchors to 11:59:59.999 PM local, so the full end day is included.
d. Date readout, slider, elapsed-time label, and the `Events: x / y` counter all follow the chosen range.
e. If the range excludes all events, the map shows no markers and the counter reads `0 / total`. No fabricated data.
f. If start is after end, the inputs show an error state and playback falls back to the auto range.
g. Chain mode applies the range on top of the chain's own window.
h. Range is UI-only state — not persisted, not written to the database.

## 3. Technical detail

Single file: `src/components/SamizdatMap.tsx`.

a. New state `rangeStart` / `rangeEnd` (`yyyy-mm-dd`), derived `rangeStartMs` / `rangeEndMs`,
   and `rangeInvalid` guard producing `effStartOverride` / `effEndOverride`.
b. `filteredEventPoints` applies a hard lower and upper bound from the overrides before the
   playback cutoff, and uses the overrides when computing `goLive` / `latest`.
c. The `goLiveTime / latestEventTime / totalDurationMs` memo applies the same overrides, keeping
   the marker pipeline and the viewport-stats pipeline in sync.
d. Changing either date pauses playback and sets `timelinePosition` to 1 (whole selected window visible); the reset button still rewinds to 0.

## 4. Plan lineage

New plan (Animation date range control for the Real-time map). Not an update to an existing decision document.
