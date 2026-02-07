
# Plan: Unassign Campaigns and Fix iOS Rendering Race Condition

## Part 1: Unassign `no-kings` and `ra-intro` from the `why-protest` Deck

This is a database update that sets `assigned_deck_slug = NULL` for all EOAs from those two campaigns.

**SQL Migration:**
```sql
UPDATE events_actions
SET assigned_deck_slug = NULL, updated_at = NOW()
WHERE assigned_deck_slug = 'why-protest'
  AND campaign_id IN (
    SELECT id FROM campaigns WHERE code IN ('no-kings', 'ra-intro')
  );
```

**Result**: Only the `bugtest` campaign (EOA: "L00=em Copy") will remain assigned to `why-protest`.

---

## Part 2: Fix iOS Text Metrics Not Rendering

### The Problem
When iOS falls back to dynamic rendering (because the snapshot failed to load), there's a race condition:
- Hotspots render when `imageLoaded && imageDimensions.width > 0`
- But `metricsMap` may still be incomplete

Numeric metrics (like `seeds_with_spawns`) appear because they're resolved first in the async chain. Text/timestamp metrics (`campaign_name`, `earliest_active`, `latest_active`) are added later and may not be ready.

### The Solution
Modify `StatsPageSlide.tsx` to wait for metrics to fully load before rendering hotspots:

1. **Add a `metricsResolved` state** that tracks when `useLiveMetrics` has completed
2. **Gate hotspot rendering** on both `imageLoaded` AND `metricsResolved` (or `!metricsLoading`)
3. **Show a loading indicator** while waiting for metrics

### Code Changes

**File: `src/components/StatsPageSlide.tsx`**

```text
Current (line 323):
  {imageLoaded && imageDimensions.width > 0 && liveNumberHotspots.map((hotspot) => {

New:
  {imageLoaded && imageDimensions.width > 0 && !metricsLoading && liveNumberHotspots.map((hotspot) => {
```

This ensures hotspots only render once ALL metrics are fully resolved, preventing the partial render where numeric values appear but text/timestamps don't.

---

## Technical Details

### Why This Race Condition Occurs

The `useLiveMetrics` hook builds metrics sequentially:
1. Lines 156-231: Numeric metrics (seeds, opens, shares, etc.) - **fast**
2. Lines 233-234: `campaign_name` from `campaign.title` - requires campaign lookup
3. Lines 243-256: `earliest_active` and `latest_active` - requires filtering/sorting events

On iOS, the component may trigger a render after step 1 completes but before steps 2-3 finish.

### Files to Modify
- `src/components/StatsPageSlide.tsx` - Add loading gate for metrics

### Verification
- Test on iOS device with the `bugtest` campaign URL
- Confirm that Name, Activity period, AND numeric metrics all appear together
- Check that the "Loading metrics..." indicator shows briefly before content appears

---

## Sequence of Actions

1. **Create migration** to unassign `no-kings` and `ra-intro` from `why-protest`
2. **Update `StatsPageSlide.tsx`** to gate hotspot rendering on `!metricsLoading`
3. **Test on iOS** to verify all fields render correctly
