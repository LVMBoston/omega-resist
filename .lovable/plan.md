

# Add `tz_offset_note` Metric — DST-Aware Timezone Label

## Summary
Add a new computed metric `tz_offset_note` that dynamically outputs `"Note: EDT = UTC - 4 hours"` or `"Note: EST = UTC - 5 hours"` based on the current DST state, replacing static manual text.

## Plan

### 1. Add metric key (`src/types/viralTemplates.ts`)
   a. Add `| 'tz_offset_note'` to the `LiveMetricKey` union with comment `// Dynamic ET offset note (DST-aware)`.

### 2. Client-side resolution (`src/hooks/useLiveMetrics.ts`)
   a. Add `tz_offset_note: "Timezone Offset Note"` to `METRIC_LABELS`.
   b. After the `campaign_story` block (~line 363), add:
      - Use `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })` to extract `"EDT"` or `"EST"`.
      - Derive offset (EDT → 4, EST → 5).
      - Push `{ key: "tz_offset_note", value: "Note: EDT = UTC - 4 hours", source: "current" }`.

### 3. Server-side resolution (`supabase/functions/render-stats-snapshot/index.ts`)
   a. After the campaign story block (~line 340), add the same `Intl.DateTimeFormat` logic to `calculateMetrics` so SVG snapshots reflect the correct seasonal label.

### 4. Metric dropdown (`src/components/HotspotCalibrationControls.tsx`)
   a. Add `{ value: "tz_offset_note", label: "🕐 TZ Offset Note" }` to `METRIC_OPTIONS`.

### 5. Preview label/icon maps (`src/components/SlidePreviewOverlay.tsx`)
   a. Add `tz_offset_note: "TZ Note"` to `METRIC_LABELS`.
   b. Add `tz_offset_note: Clock` to `METRIC_ICONS`.

### 6. Test harness labels (`src/pages/DataTemplateTestHarness.tsx`)
   a. Add `tz_offset_note: "Timezone Offset Note"` to `METRIC_LABELS`.

### 7. Decision document
   a. Append a new `## Update — 2026-04-07: TZ Offset Note Metric` section to `docs/decisions/deck-editor/2026-04-07_hotspot-controls-stable-layout_feature-doc_lovable.md`, including a **Possible Future Feature** subsection describing the generalized approach:
      - Client passes `Intl.DateTimeFormat().resolvedOptions().timeZone` to `render-stats-snapshot`.
      - Server uses that IANA timezone for all `toLocaleString` calls.
      - Batch/cron jobs default to `America/New_York`.
      - Per-campaign timezone preference stored in `campaigns` table.
      - References the existing plan in `docs/decisions/snapshots/2026-03-06_timezone-passthrough-snapshots_feature-doc_lovable.md`.

## Core logic (both client and server)
```typescript
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'short',
}).formatToParts(new Date());
const abbr = parts.find(p => p.type === 'timeZoneName')?.value || 'EST';
const offset = abbr === 'EDT' ? 4 : 5;
const tzNote = `Note: ${abbr} = UTC - ${offset} hours`;
```

## Files changed
- `src/types/viralTemplates.ts`
- `src/hooks/useLiveMetrics.ts`
- `supabase/functions/render-stats-snapshot/index.ts`
- `src/components/HotspotCalibrationControls.tsx`
- `src/components/SlidePreviewOverlay.tsx`
- `src/pages/DataTemplateTestHarness.tsx`
- `docs/decisions/deck-editor/2026-04-07_hotspot-controls-stable-layout_feature-doc_lovable.md`

