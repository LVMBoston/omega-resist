

# Leaflet classList Cleanup Fix + Change Log Documentation

## Step 1: Fix the Leaflet cleanup crash

**File:** `src/components/MapHotspotRenderer.tsx` (lines 332-338)

Replace the current cleanup function with a guarded version:

```text
return () => {
  try {
    if (mapRef.current) {
      mapRef.current.off();
      if (mapContainerRef.current && mapContainerRef.current.parentNode) {
        mapRef.current.remove();
      }
    }
  } catch (e) {
    console.warn("MapHotspotRenderer: cleanup suppressed:", e);
  }
  mapRef.current = null;
  clusterGroupRef.current = null;
  markersLayerRef.current = null;
  setMapReady(false);
};
```

**What this does:**
- Detaches Leaflet event listeners before removal
- Only calls `map.remove()` if the container DOM node still exists
- Wraps everything in try/catch as a final safety net
- Eliminates the "Cannot read properties of null (reading 'classList')" toast error

## Step 2: After verification, document changes

Once you confirm the fix works, I will append a change history section to `docs/investigations/hotspot/2026-01-31_valign-insufficient-movement_bug-report_lovable.md` (or a new companion MD file -- your preference) recording:

- The "Update Template" button removal
- The `overflow-visible` change in StatsPageSlide
- This Leaflet cleanup guard fix
- (Later) The center+zoom deterministic rendering fix

Each entry will include date, what changed, why, and which files were modified.

