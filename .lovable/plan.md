

## Update L00 Color Scheme: Dark/Light Blue Split

### 1. Problem
Currently both L00 sub-categories use the same blue (`hsl(221, 83%, 53%)`), making them visually indistinguishable in the stacked bar.

### 2. Change

a. **`src/hooks/useChartData.ts`** — Update `LEVEL_COLORS`:
   - `L00_seeds`: `hsl(221, 83%, 35%)` (darker blue — seeds with no spawns)
   - `L00_spawns`: `hsl(221, 83%, 65%)` (lighter blue — seeds with spawns)

b. **`src/components/ChartHotspotRenderer.tsx`** — Update the `<Bar>` for `L00_spawns` to use `LEVEL_COLORS.L00_spawns` instead of the hardcoded `"hsl(142, 71%, 45%)"` it currently has.

### 3. Rationale
- Dark-to-light within the same hue family keeps L00 visually grouped as one "level" while clearly distinguishing the two sub-segments.
- The green (`hsl(142, 71%, 45%)`) stays reserved for L01, avoiding confusion.

### 4. Files touched
- `src/hooks/useChartData.ts` (2 lines in `LEVEL_COLORS`)
- `src/components/ChartHotspotRenderer.tsx` (1 line — `fill` prop on `L00_spawns` Bar)

