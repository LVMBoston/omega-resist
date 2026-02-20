

# Fix: Real-time Map Not Updating with New Events

## Problem
The Real-time Map (SamizdatMap) fetches event data **once** when the selected EoA IDs change, but has **no realtime subscription**. New events appear in the Events tab (which uses React Query + a Supabase realtime channel) but the map never re-fetches.

## Root Cause
- `CampaignDashboard.tsx` (line 337) subscribes to `url_events` changes but only invalidates `eventsV2` and `eventCounts` queries.
- `SamizdatMap.tsx` fetches data in a `useEffect` keyed on `eoaIdsKey` (line 473-475) -- a plain fetch, not a React Query, so invalidation has no effect on it.

## Solution
Add a `refreshKey` prop to `SamizdatMap` that increments whenever the realtime channel fires. This triggers the existing fetch effect to re-run without adding a second realtime subscription.

### Step 1: Extend the realtime handler in CampaignDashboard
- Add a `mapRefreshKey` state counter.
- Increment it inside the existing realtime callback (alongside the query invalidations).
- Pass it to `<SamizdatMap refreshKey={mapRefreshKey} />`.

### Step 2: Accept and use `refreshKey` in SamizdatMap
- Add `refreshKey?: number` to the props interface.
- Add `refreshKey` to the dependency array of the data-fetching `useEffect` (line 475), so the map re-fetches whenever it changes.

### Files Changed
| File | Change |
|------|--------|
| `src/pages/CampaignDashboard.tsx` | Add `mapRefreshKey` state; increment in realtime callback; pass as prop |
| `src/components/SamizdatMap.tsx` | Add `refreshKey` prop; include in fetch effect dependencies |

### Why Not a Separate Realtime Subscription?
Adding a second subscription to `url_events` in SamizdatMap would create duplicate channels and unnecessary database load. A simple counter prop is lighter and keeps the single-source-of-truth pattern.

