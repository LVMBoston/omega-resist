

# Fix "Data as of:" Timezone Display

## Problem
The "Data as of:" time shows "8:08 PM" (UTC) instead of "3:08 PM ET" (your local time). This happens because the server-side snapshot renders timestamps using UTC, and the client-side `last_updated` metric is never populated.

## Root Causes
1. **Server-side snapshot** (`render-stats-snapshot` edge function): Uses `new Date()` on the Deno server, which runs in UTC. The resulting SVG bakes in UTC times with no timezone label.
2. **Client-side live rendering** (`useLiveMetrics` hook): The `last_updated` metric key is defined but never actually populated with a value -- it falls back to "--".

## Fix (Two Parts)

### Part 1: Add `last_updated` to client-side metrics
**File:** `src/hooks/useLiveMetrics.ts`

After the `current_time` metric (around line 313), add a `last_updated` metric that combines date and time in the viewer's local timezone:

```
// last_updated (combined date + time for "Data as of:" hotspots)
metricResults.push({
  key: "last_updated",
  label: METRIC_LABELS.last_updated,
  value: formatInTimeZone(now, viewerTz, "h:mm a zzz"),
  source: "current",
});
```

This ensures that when the live rendering path is used (desktop, non-snapshot mode), the "Data as of:" hotspot shows the correct local time with a timezone indicator.

### Part 2: Add "UTC" label to server-side snapshot times
**File:** `supabase/functions/render-stats-snapshot/index.ts`

Update the time formatting (lines 236-238) to append "UTC" so viewers of the static SVG know it's not local time:

```
metrics.current_date = now.toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
});
metrics.current_time = now.toLocaleTimeString('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true
}) + ' UTC';
metrics.last_updated = `${metrics.current_date} ${metrics.current_time}`;
```

This makes the SSR snapshot honestly show "8:08 PM UTC" instead of bare "8:08 PM".

### Part 3: Add "UTC" to SSR activity timestamps
**File:** `supabase/functions/render-stats-snapshot/index.ts`

Update `earliest_active` and `latest_active` formatting (lines 228-229) to also append "UTC":

```
metrics.earliest_active = earliest.toLocaleDateString(...) + ' UTC';
metrics.latest_active = latest.toLocaleDateString(...) + ' UTC';
```

## Result
- **Live rendering (desktop)**: Shows accurate local time with timezone label (e.g., "3:08 PM EST")
- **SSR snapshot (mobile/cached)**: Shows "8:08 PM UTC" so it's clear the time isn't localized

## Files Changed
- `src/hooks/useLiveMetrics.ts` -- add `last_updated` metric population
- `supabase/functions/render-stats-snapshot/index.ts` -- append "UTC" to all time strings

