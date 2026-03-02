# Update L00 Color Scheme: Dark/Light Blue Split

**Status:** Approved & Implemented  
**Date:** 2026-03-02

## Problem
Both L00 sub-categories used the same blue (`hsl(221, 83%, 53%)`), making them visually indistinguishable in the stacked bar chart.

## Change

a. **`src/hooks/useChartData.ts`** — Updated `LEVEL_COLORS`:
   - `L00_seeds`: `hsl(221, 83%, 35%)` (darker blue — seeds with no spawns)
   - `L00_spawns`: `hsl(221, 83%, 65%)` (lighter blue — seeds with spawns)

b. **`src/components/ChartHotspotRenderer.tsx`** — Updated the `<Bar>` for `L00_spawns` to use `LEVEL_COLORS.L00_spawns` instead of the hardcoded green.

## Rationale
- Dark-to-light within the same hue family keeps L00 visually grouped while distinguishing sub-segments.
- Green (`hsl(142, 71%, 45%)`) stays reserved for L01.
