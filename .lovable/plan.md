
# Finer Map Zoom Controls + Numeric Zoom Display

## Changes

### 1. Reduce chevron fine-step from 0.25 to 0.1
In `MapCalibrationControls.tsx`, change both chevron button `onClick` calls from `0.25` to `0.1`.

### 2. Add numeric zoom level display
- Add a `currentZoom` prop to `MapCalibrationControlsProps`
- Replace the static "Use buttons or scroll on map" text with the live zoom value (e.g., "Zoom: 4.3")

### 3. Expose current zoom from the map
- Add a `getZoom` method to the `MapControls` interface in `MapHotspotRenderer.tsx`
- In `DataTemplateEditor.tsx`, store zoom levels in a `mapZoomMap` record keyed by hotspot ID
- Report zoom changes via a new `onMapZoomChange` callback, triggered on Leaflet's `zoomend` event
- Pass `currentZoom` down to `MapCalibrationControls`

---

## Technical Details

**MapHotspotRenderer.tsx**
- Add `onMapZoomChange?: (zoom: number) => void` prop
- Fire `onMapZoomChange(map.getZoom())` on Leaflet `zoomend` event and on initial ready
- Add `getZoom` to the `MapControls` interface

**DataTemplateEditor.tsx**
- New state: `mapZoomMap: Record<string, number>`
- Pass `onMapZoomChange` callback to `MapHotspotRenderer` instances
- Pass `currentZoom={mapZoomMap[activeHotspot.id]}` to `MapCalibrationControls`

**MapCalibrationControls.tsx**
- New optional prop: `currentZoom?: number`
- Change chevron deltas: `0.25` to `0.1`
- Center text shows `Zoom: {currentZoom?.toFixed(1) ?? "—"}` instead of static hint
