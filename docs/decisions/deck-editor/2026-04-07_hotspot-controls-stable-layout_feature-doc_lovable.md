# Stabilize & Regroup HotspotCalibrationControls Layout

**Date:** 2026-04-07  
**Author:** lovable  
**Status:** Approved & Implemented  
**Project Area:** deck-editor

## Summary

The `HotspotCalibrationControls` component had two UX issues:
1. Selecting "Manual Entry" conditionally inserted a Label textarea, pushing all controls below it and causing disorientation.
2. Controls were not logically grouped (e.g., Font was far from Size/Weight).

## Changes

### `src/components/HotspotCalibrationControls.tsx`

- **Stable Label field**: The Label textarea is now always rendered. When `metricKey !== "manual_entry"`, it appears as `disabled` with `opacity-40`, keeping the grid layout stable.
- **Logical grouping**: Controls reordered into semantic rows:
  - Row 1: Metric | Label
  - Row 2: Size | Weight | Font (3-column)
  - Row 3: X | Y
  - Row 4: W | H
  - Row 5: H-Align | V-Align
  - Row 6: Text Color | BG Color
  - Row 7: Preview
- **Size control**: Converted from `SliderWithButtons` to a compact number input to fit the 3-column row with Weight and Font.

## Rationale

Keeping the Label field always present prevents layout shifts when toggling metric types. Grouping Size/Weight/Font together and pairing alignment controls makes the panel scannable and predictable.

## Update — 2026-04-07: Fine Zoom Controls for Map Hotspots

### Problem
The mouse scroll wheel zoom on map hotspots is too coarse for precise framing.

### Changes

#### `src/components/DraggableHotspotOverlay.tsx`
- Added `mapControlsRef` to store `MapControls` instances keyed by hotspot ID.
- When a map hotspot is **unlocked**, +/− buttons appear below the lock toggle (right edge), each zooming by 0.5 levels for fine control.
- The `onMapReady` callback now stores controls locally in addition to forwarding them upstream.

### Rationale
Fractional zoom (±0.5) provides much finer framing control than the default scroll wheel (±1 level per tick).

## Update — 2026-04-07: TZ Offset Note Metric

### Problem
Hotspot #11 uses static manual text ("Note: ET = UTC - 5 hours") that becomes incorrect during Daylight Saving Time (UTC-4 in EDT).

### Changes

#### `src/types/viralTemplates.ts`
- Added `'tz_offset_note'` to the `LiveMetricKey` union.

#### `src/hooks/useLiveMetrics.ts`
- Added `tz_offset_note: "Timezone Offset Note"` to `METRIC_LABELS`.
- After the `campaign_story` block, computes the current Eastern Time abbreviation via `Intl.DateTimeFormat` and pushes the formatted note.

#### `supabase/functions/render-stats-snapshot/index.ts`
- Same `Intl.DateTimeFormat` logic added to `calculateMetrics` so SVG snapshots reflect the correct seasonal label.

#### `src/components/HotspotCalibrationControls.tsx`
- Added `{ value: "tz_offset_note", label: "🕐 TZ Offset Note" }` to `METRIC_OPTIONS`.

#### `src/components/SlidePreviewOverlay.tsx`
- Added `tz_offset_note: "TZ Note"` to `METRIC_LABELS` and `Clock` to `METRIC_ICONS`.

#### `src/pages/DataTemplateTestHarness.tsx`
- Added `tz_offset_note: "Timezone Offset Note"` to `METRIC_LABELS`.

### Core Logic (shared client + server)
```typescript
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'short',
}).formatToParts(new Date());
const abbr = parts.find(p => p.type === 'timeZoneName')?.value || 'EST';
const offset = abbr === 'EDT' ? 4 : 5;
const tzNote = `Note: ${abbr} = UTC - ${offset} hours`;
```

### Rationale
Hardcoded "ET = UTC - 5" is wrong during EDT. Using `Intl.DateTimeFormat` with `America/New_York` auto-detects the current DST state and produces the correct abbreviation and offset.

### Possible Future Feature: Generalized Viewer-Local Timezone Support

Currently, the `tz_offset_note` metric (and all timestamp formatting in snapshots) is hardcoded to `America/New_York`. A future enhancement could make snapshots timezone-aware for any viewer:

1. **Client passes timezone**: When `DeckViewer` or `StatsPageSlide` requests a snapshot refresh, include `Intl.DateTimeFormat().resolvedOptions().timeZone` (e.g., `"America/Chicago"`, `"Europe/London"`) in the request body.
2. **Server uses viewer timezone**: `render-stats-snapshot` validates the IANA timezone string via `new Intl.DateTimeFormat('en-US', { timeZone })` (catch → fallback to `"America/New_York"`) and uses it for all `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` calls.
3. **Batch/cron jobs**: Automated snapshot refreshes (e.g., `refresh-all-snapshots`) would default to `"America/New_York"` since there is no viewer context.
4. **Per-campaign preference**: A `timezone` column on the `campaigns` table could store the campaign owner's preferred timezone, used as the default when no viewer timezone is provided.

This approach is documented in detail in `docs/decisions/snapshots/2026-03-06_timezone-passthrough-snapshots_feature-doc_lovable.md`.
