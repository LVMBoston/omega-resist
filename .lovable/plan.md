

# Map Hotspot Implementation Plan

## Overview

Add a **map hotspot type** to Data Templates that renders a view-only Samizdat map showing campaign viral spread. The map can be positioned and resized alongside live metrics, charts, and other elements on a single slide.

## Interaction Design

### Toggle Mechanism (Hand/Lock Icons)
- **Lock icon** (default): Map is locked, touch gestures pass through to deck navigation
- **Hand icon** (unlocked): Map is interactive, gestures control the map

### Zoom Behavior (when unlocked)
- **Single tap**: Zoom in one level, centered on tap location
- **Long-press (~0.5s)**: Zoom out one level
- **Pan**: Standard drag gesture to move the map

### Visual Feedback
- Semi-transparent overlay badge in corner showing current mode
- Subtle border glow when in interactive mode

```
┌─────────────────────────────────────┐
│                              🔒     │  ← Lock icon (deck nav mode)
│                                     │
│        [Map Content]                │
│                                     │
│                                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│                              ✋     │  ← Hand icon (map interactive)
│                                     │
│        [Map Content]                │  ← Blue glow border
│                                     │
│                                     │
└─────────────────────────────────────┘
```

---

## Technical Implementation

### Phase 1: Type System Updates

**File: `src/types/viralTemplates.ts`**

Add `map` to the hotspot action types and create a new `MapConfig` interface:

- Add `'map'` to `HotspotActionType` union
- Create `MapConfig` interface with:
  - `mapStyle`: `'channel_colors'` (future: level colors, single color)
  - `showClustering`: boolean
  - `savedBounds`: optional object with north/south/east/west coordinates

---

### Phase 2: Core Map Component

**New File: `src/components/MapHotspotRenderer.tsx`**

A lightweight, embeddable map component derived from SamizdatMap logic but simplified for hotspot use:

**Includes:**
- Leaflet map initialization with CartoDB Positron tiles
- Event fetching for the specified campaign
- Marker rendering with channel colors (QR navy, Email blue, SMS light blue)
- Optional clustering via leaflet.markercluster
- Lock/Hand toggle button in corner
- Touch gesture handling (tap zoom in, long-press zoom out, pan)
- Apply saved bounds on mount if configured

**Excludes (compared to full SamizdatMap):**
- EoA selector
- Time filter buttons
- Channel toggle checkboxes
- Viewport stats table
- Event story panel
- Chain view mode

**Props:**
```
campaignCode: string
config: MapConfig
width: number (pixels)
height: number (pixels)
isEditorMode?: boolean
onBoundsChange?: (bounds) => void  // For editor "save view" feature
```

---

### Phase 3: Editor Integration

**File: `src/components/DataTemplateEditor.tsx`**

Add alongside existing "Add Hotspot" and "Add Chart" buttons:
- New "Add Map" button with Map icon
- Creates map hotspot with default configuration
- Map hotspots use the campaign from the Campaign dropdown

**New File: `src/components/MapCalibrationControls.tsx`**

Editor controls panel when a map hotspot is selected:
- Toggle clustering on/off
- "Save Current View" button to capture current map bounds
- Display current saved bounds if set
- Same layout pattern as existing calibration controls

---

### Phase 4: Overlay Updates

**File: `src/components/DraggableHotspotOverlay.tsx`**

Add rendering branch for map hotspots in the editor:
- If campaign is selected: render live MapHotspotRenderer
- If no campaign: render placeholder with Map icon and "Select Campaign" text
- Same drag/resize behavior as other hotspot types
- Index badge in corner for identification

---

### Phase 5: Runtime Rendering

**File: `src/components/StatsPageSlide.tsx`**

Add map hotspot rendering alongside existing live_number and chart hotspots:
- Filter hotspots by type `'map'`
- Calculate pixel position from percentage coordinates
- Render MapHotspotRenderer with resolved campaign code
- Apply saved bounds from hotspot config

---

## Data Flow

**Editor Mode:**
```
Campaign Dropdown → campaignCode stored in editor state
                           ↓
MapHotspotRenderer fetches EoAs for campaign
                           ↓
Fetches tokens + url_events with coordinates
                           ↓
Renders markers with channel colors
                           ↓
User adjusts view → "Save Current View" captures bounds
                           ↓
Bounds saved to hotspot.mapConfig.savedBounds
```

**Runtime Mode:**
```
DeckViewer loads slide with map hotspot
                           ↓
StatsPageSlide resolves campaignCode from token/deck
                           ↓
MapHotspotRenderer initializes with saved bounds
                           ↓
Fetches campaign events once on mount
                           ↓
User taps Lock → Hand to enable interaction
                           ↓
Tap/long-press/pan to explore map
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/types/viralTemplates.ts` | Modify | Add `map` type and `MapConfig` interface |
| `src/components/MapHotspotRenderer.tsx` | Create | Core embeddable map component |
| `src/components/MapCalibrationControls.tsx` | Create | Editor controls for map settings |
| `src/components/DataTemplateEditor.tsx` | Modify | Add "Add Map" button |
| `src/components/DraggableHotspotOverlay.tsx` | Modify | Render map hotspots in editor |
| `src/components/StatsPageSlide.tsx` | Modify | Render map hotspots at runtime |

---

## Technical Notes

1. **Touch Event Handling**: When locked, map container has `pointer-events: none` so gestures pass to deck. When unlocked, map intercepts touch events.

2. **Long-Press Detection**: Use `touchstart`/`touchend` timing. If touch duration > 500ms without significant movement, trigger zoom out.

3. **Clustering**: Reuse existing leaflet.markercluster setup from SamizdatMap but simplified.

4. **Saved Bounds**: Store as `{ north, south, east, west }` and apply via `map.fitBounds()` on initialization.

5. **Performance**: Map initializes once on mount. No auto-refresh (load once per your preference).

6. **Marker Colors**: Use existing channel color constants (QR #000099, Email #0066ff, SMS #99ccff).

