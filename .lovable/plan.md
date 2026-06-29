# Plan — Chart Hotspot: Selectable Series + Axis Controls

Status: Proposed
Date: 2026-06-29

## 1. What the user will see

In the Chart hotspot's calibration row (today: Chart Type, Data, X/Y/W/H/Z, X-Axis, Y-Axis), add:

a. **Data series** dropdown with 5 choices:
   - Cumulative opens by level *(current default)*
   - Opens per period (non-cumulative)
   - Shares per period
   - Unique viewers per period
   - New L00 seeds per period
b. **Time bucket** dropdown: Day / Week *(default)* / Month
c. **Y scale** dropdown: Linear *(default)* / Log
d. **Y format** dropdown: Integer *(default)* / Compact (e.g. "1.2k")
e. Keep the existing X-Axis and Y-Axis on/off toggles.

Chart type stays "Stacked Bar" for now. The four new series all render as stacked-bar-over-time so we don't open the SSR can of worms in this pass.

## 2. Series definitions

a. **Cumulative opens by level** — current behavior, untouched.
b. **Opens per period** — same level breakdown as today, but each bar is that period's count (not running total).
c. **Shares per period** — count of `tokens.minted_at` per bucket, broken down by **parent level** (so you see "L00 generated 12 shares this week, L01 generated 3"). Excludes L00 seed-mints (those aren't shares).
d. **Unique viewers per period** — distinct `token` with a `view` event in the bucket, broken down by level.
e. **New L00 seeds per period** — count of `tokens` where `level=0`, bucketed by `minted_at`. Single series (no level split — they're all L00).

All series respect `campaigns.official_start_at` exactly like today.

## 3. Technical changes

a. **`src/types/viralTemplates.ts`** — extend `ChartConfig`:
```ts
dataSource: "cumulative_opens_by_level"
          | "opens_per_period"
          | "shares_per_period"
          | "unique_viewers_per_period"
          | "new_l00_seeds_per_period";
timeBucket: "day" | "week" | "month";   // default "week"
yScale: "linear" | "log";                // default "linear"
yFormat: "integer" | "compact";          // default "integer"
```
b. **`src/hooks/useChartData.ts`** — split into per-series fetchers; switch on `config.dataSource` and `config.timeBucket`. Return a normalized `{ bucket, series: Record<string, number> }[]` plus a `seriesKeys` list so the renderer doesn't need to know the shape.
c. **`src/components/ChartHotspotRenderer.tsx`** — drive `<Bar>` elements from `seriesKeys`; apply `YAxis scale={config.yScale}` and a `tickFormatter` for compact format.
d. **`src/components/ChartCalibrationControls.tsx`** — replace the two read-only chips with the four new dropdowns described in section 1.
e. **`supabase/functions/render-stats-snapshot/`** — parity work: the SSR chart renderer must support the same `dataSource` / `timeBucket` / `yScale` / `yFormat` so snapshots match the editor (per our editor-SSR parity rule). This is the biggest chunk of work and is required, not optional.
f. **Backward compatibility** — existing hotspots with no `dataSource` default to `cumulative_opens_by_level` + `week` + `linear` + `integer`, so saved decks render identically.

## 4. Out of scope (would be follow-up plans)

- Chart type picker (line / area / grouped)
- Compare-campaigns overlay
- Date range filter, per-EoA filter, legend toggles
- Annotations (official-start marker, EoA launch lines)
- CSV export

## 5. Risks

a. **SSR parity is the long pole.** Each new series needs a Deno-side implementation in `render-stats-snapshot`. If we skip it, snapshots will silently disagree with the editor.
b. **Log scale + zero values** — Recharts handles `scale="log"` poorly when any bar is 0; we'll clamp display to `max(value, 0.1)` for log mode, or auto-fall-back to linear when the dataset contains zeros.
c. **"Shares per period" double-counting** — must filter out L00 seed-mints (where `parent_token IS NULL`) so we count actual viral shares, not seeding activity.

## 6. Verification

a. Vitest unit tests for the new per-series aggregators in `useChartData`.
b. Browser check: open a deck with a Chart hotspot, cycle through all 5 series + Day/Week/Month + Linear/Log, screenshot each.
c. Parity-harness Live Campaign Mode: confirm editor and SSR panes match for each series.

## 7. Decision log

Confirms this is a **new plan**: `docs/decisions/chart-colors/2026-06-29_chart-series-and-axis-controls_feature-doc_lovable.md` (saved on approval & implementation).
