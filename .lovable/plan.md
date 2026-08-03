# Animation date range control for the Real-time map

Add an explicit start/end date range to the map's timeline playback, so a recording can cover exactly the days you choose instead of always spanning first-event to latest-event.

## 1. What you'll see

a. In the playback box (bottom right of the map), a new compact row: `From [mm/dd/yyyy] To [mm/dd/yyyy]` plus a small `Auto` reset button.
b. Empty fields = today's behavior (range derived from go-live to latest event). Filling either one overrides that side.
c. Start date is anchored at 12:00 AM of that day; end date is anchored at 11:59 PM of that day, so the full end day is included.
d. The date readout box, slider, elapsed-time label, and the "Events: x / y" counter all follow the chosen range.
e. Play/Pause/Reset/speed behave the same; a full 1x playthrough still takes ~30 seconds across whatever range is set.

## 2. Behavior rules

a. If the chosen range excludes all events, the map shows no markers and the counter reads `0 / total` — no fabricated data.
b. If start is after end, the control shows the fields in an error state and falls back to auto until corrected.
c. In chain mode the range still applies; it simply narrows the chain's own window.
d. The range is UI-only state (not persisted, not saved to the database).

## 3. Technical detail

Single file: `src/components/SamizdatMap.tsx`.

a. New state: `rangeStart: string | null`, `rangeEnd: string | null` (raw `yyyy-mm-dd` from `<input type="date">`, rendered as mm/dd/yyyy by the browser locale; a plain text input with mm/dd/yyyy placeholder is used if the native picker is undesirable).
b. Derive `effectiveStartMs` / `effectiveEndMs` in the existing `goLiveTime / latestEventTime / totalDurationMs` memo: use the override when valid, otherwise the current computed values. Start parses to local midnight, end parses to local 12:00.
c. The two places that recompute the cutoff independently — the `filteredEventPoints` memo and the `timeFilteredEvents` memo — must both read the same derived start/end so markers and viewport stats stay in sync.
d. Also clamp the lower bound: events before `effectiveStartMs` are filtered out (currently only an upper cutoff exists).
e. Changing either date pauses playback and resets `timelinePosition` to 0.
f. Existing helpers `parseNaiveDate` / `formatElapsedTime` in `src/lib/dateUtils.ts` are reused; no new date library.

## 4. Documentation

a. New decision doc at `docs/decisions/campaigns/2026-08-03_map-animation-date-range_feature-doc_lovable.md` with `Status: Approved & Implemented`.
b. This is a new plan, not an update to an existing decision document; the closest prior record, `docs/investigations/hotspot/2026-02-15_timeline-playback-samizdat.md`, will get a pointer line to the new doc.
