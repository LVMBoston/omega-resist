# Plan

## 1. Reproduce and confirm the mismatch

### a. Public slide verification
Open `https://omega-resist.lovable.app/s/e08c94`, move to Slide 2, and capture the live stats slide as the baseline.

### b. Snapshot path verification
Trace the snapshot URL used by the slide and compare the downloaded snapshot against the live slide for:
- orientation
- map extent / zoom
- text size and overflow

### c. Dashboard blocker note
The public slide is accessible, but `/campaign-dashboard` is behind login in my browser session right now, so I cannot verify the toggle there until the preview is signed in.

## 2. Fix the server renderer so it matches the editor

### a. Remove the hard-coded portrait canvas
Replace the fixed `1080x1920` snapshot canvas with dimensions derived from the template’s real layout, so a landscape template stays landscape.

### b. Use the same map viewport basis as the editor
Make the server map renderer use the exact saved map settings from the editor as the source of truth, and avoid any fallback behavior that widens the view when saved center/zoom are present.

### c. Match text box rendering rules
Update the server text rendering so it respects the editor’s box size and text settings more faithfully, including font size, alignment, clipping, and multi-line behavior, so labels don’t grow and spill outside their boxes.

## 3. Verify with the same workflow you described

### a. Re-render the affected template snapshot
Trigger a fresh server render for the affected campaign/template pair.

### b. Browser re-test
Re-open the public slide, compare Slide 2 to the new downloaded snapshot, and confirm the three visible issues are gone:
- landscape stays landscape
- map shows the same region
- text stays inside its intended box

### c. Dashboard confirmation
If the preview is logged in, verify that Server Rendering is enabled in `/campaign-dashboard`; otherwise I’ll note that the runtime snapshot itself was verified but the settings panel could not be checked because of auth.

## 4. Decision log update

### a. Update the existing decision doc
Append the implementation details and validation results to `docs/decisions/snapshots/2026-06-07_unify-map-rendering-cartodb_feature-doc_lovable.md` rather than creating a new decision file.

## Technical details

- The main bug already visible in code is that the snapshot renderer currently forces every output to portrait with:
  - `width = 1080`
  - `height = 1920`
- That alone explains the portrait output and the wider map extent, because hotspot coordinates and map pixel size are being computed against the wrong canvas shape.
- The text mismatch is also consistent with server-side SVG text layout not matching the browser’s HTML text box behavior.
- The live map already uses Leaflet + CartoDB tiles. The server renderer also uses CartoDB tiles, so the remaining issue is not “Mapbox vs Leaflet” anymore; it is layout math and rendering rules not matching the editor.