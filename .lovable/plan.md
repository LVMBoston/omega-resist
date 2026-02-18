
## Fix: Spawn Filter Applied Unconditionally in All View Modes

### What Is Wrong

In `src/components/SamizdatMap.tsx`, there are two separate filter pipelines:

1. **Stats pipeline** (lines 416-427): `showNoSpawns` is applied correctly — L00 events with no spawns are hidden from viewport statistics.
2. **Marker rendering pipeline** (lines 294-317): `showNoSpawns` is NOT applied at all — L00 events with no spawns are always rendered as markers regardless of the checkbox state.

The previous plan proposed adding the spawn filter to the marker pipeline but carving out a `viewMode !== "chain"` exception. That exception was wrong. If an L00 event has no spawns and the filter is active, it should be invisible — and therefore unclickable — making chain mode on a no-spawn L00 impossible by definition, not by exception.

### The Fix: One Change in One File

**File**: `src/components/SamizdatMap.tsx`

**Change**: Add the spawn filter unconditionally at the top of `filteredEventPoints` (line 294), and add `showNoSpawns` to its dependency array. No chain mode exception.

```tsx
const filteredEventPoints = useMemo(() => {
  let filtered = eventPoints;

  // Apply spawn filter: hide L00 events with no engaged spawns
  if (!showNoSpawns) {
    filtered = filtered.filter(e => e.level !== 0 || (e.spawnCount || 0) > 0);
  }

  // Filter by enabled share mediums (skip in chain mode - show all)
  if (viewMode !== "chain") {
    filtered = filtered.filter(event => enabledChannels.has(getShareMediumShape(event.utmMedium)));
  }

  // Timeline filter...
  ...

  return filtered;
}, [eventPoints, showNoSpawns, timelinePosition, eoaStartDates, enabledChannels, viewMode]);
```

This also unifies the two pipelines: the stats counter and the rendered markers will now both reflect the same filtered set of events.

### Technical Notes

- No database or schema changes required
- No new props required — `showNoSpawns` is already in scope in `SamizdatMap.tsx`
- The now-redundant `spawnFilteredEvents` intermediate variable (lines 416-420) can be simplified to use `filteredEventPoints` directly, eliminating the pipeline split
- The "Events: X / Y" timeline counter will correctly reflect spawn-filtered totals after this fix
