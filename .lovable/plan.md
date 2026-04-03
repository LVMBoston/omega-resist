# Plan: Map Magnifier Loupe

## Overview
Add a magnifying glass ("loupe") overlay to the Real-time Map that shows a zoomed-in circular view of the area under the cursor, without changing the map's actual viewport.

## Behavior

1. **Activation**: A toggle button (🔍 icon) in the bottom-right controls overlay enters/exits loupe mode.
2. **Zoom levels**: While in loupe mode, pressing **2**, **3**, or **4** on the keyboard sets the magnification to 2×, 3×, or 4× respectively. Default: 2×.
3. **Loupe appearance**: A circular overlay (150px at 2×, 250px at 3×, 350px at 4×) follows the cursor, showing the magnified map tiles + markers beneath.
4. **Implementation**: Uses a second hidden Leaflet map instance synced to the cursor position at higher zoom, rendered inside a circular clipped `div` that tracks `mousemove`.
5. **Exit**: Click the toggle button again, or press **Escape**.

## Files

| # | File | Change |
|---|------|--------|
| 1 | `src/components/MapMagnifier.tsx` | **New** — loupe component: hidden Leaflet map, circular clip, mouse tracking, key listeners |
| 2 | `src/components/SamizdatMap.tsx` | Add magnifier toggle button to controls overlay; render `<MapMagnifier>` when active; pass map ref + container ref |
| 3 | `docs/decisions/deck-editor/2026-04-03_scan-location-timezone-display_feature-doc_lovable.md` | Append `## Update — 2026-04-03 (Map Magnifier Loupe)` section |

## Technical Approach

### a. `MapMagnifier.tsx`
- Props: `parentMap: L.Map`, `containerRef: RefObject<HTMLDivElement>`, `magnification: number`, `loupeSize: number`
- Creates a second Leaflet `L.map` in a hidden container, same tile layer, zoom = parentMap.zoom + log2(magnification)
- On `mousemove` over the parent container, positions the loupe circle at cursor and sets the hidden map's center to the lat/lng under the cursor
- The loupe div uses `overflow: hidden; border-radius: 50%; pointer-events: none;` and clips the hidden map
- Renders a subtle border ring and crosshair

### b. Key listener
- `useEffect` in `SamizdatMap` listens for keydown `2`/`3`/`4` when loupe is active, updating `magnification` state
- Small badge on the loupe shows current level (e.g., "3×")

### c. Toggle button
- Added next to existing controls (e.g., near the fullscreen button area)
- Uses `Search` or `ZoomIn` icon from lucide-react with active state styling

## Verification
- Browser test: click loupe toggle, move mouse over map, confirm magnified circle follows cursor
- Press 2/3/4 and confirm size + zoom changes
- Press Escape or click toggle to exit
- Confirm underlying map doesn't pan/zoom during loupe use
