# Chart Hotspot — Selectable Data Series & Axis Controls

**Status:** Approved & Implemented
**Date:** 2026-06-29

## 1. Summary

Expanded the Chart hotspot from a single fixed view ("cumulative opens by level, weekly") to a configurable widget with selectable data series, time bucket, Y-scale, and Y-format.

## 2. User-visible changes

In the Chart hotspot calibration panel:

a. **Data series** dropdown:
   - Cumulative opens by level *(default — original behavior)*
   - Opens per period (non-cumulative)
   - Shares per period (grouped by parent level)
   - Unique viewers per period
   - New L00 seeds per period
b. **Time bucket** dropdown: Day / Week *(default)* / Month
c. **Y scale** dropdown: Linear *(default)* / Log (auto-falls back to linear when data contains zeros)
d. **Y format** dropdown: Integer *(default)* / Compact ("1.2k")
e. X-Axis / Y-Axis show toggles unchanged.

Chart type remains stacked bar.

## 3. Files changed

a. `src/types/viralTemplates.ts` — extended `ChartConfig` with `dataSource` union, `timeBucket`, `yScale`, `yFormat`.
b. `src/hooks/useChartData.ts` — rewrote to dispatch on `dataSource`, support 3 bucket sizes, return normalized `{ points, seriesKeys, seriesLabels }`.
c. `src/components/ChartHotspotRenderer.tsx` — data-driven `<Bar>` rendering from `seriesKeys`, log-scale + compact-format support.
d. `src/components/ChartCalibrationControls.tsx` — 4 new dropdowns replace the read-only chips.

## 4. Backward compatibility

Existing hotspots with no `dataSource` (or only the old single value) fall back to `cumulative_opens_by_level` + `week` + `linear` + `integer`, producing identical output.

## 5. SSR parity note

The snapshot renderer (`render-stats-snapshot`) does **not** render chart hotspots — chart bars only appear in the live editor/viewer, and snapshots skip them entirely. No SSR work was required for this change.

## 6. Out of scope (future)

Chart type picker (line/area/grouped), compare-campaigns overlay, date-range filter, per-EoA filter, annotations, CSV export.
