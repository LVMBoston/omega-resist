## Plan: Image Data Hotspot

A new **Image** data category alongside Live Number, Chart, and Map. Editors paste an image from their clipboard onto the slide; the hotspot locks to the image's natural aspect ratio and can be repositioned and resized (resizing one side auto-adjusts the other). The image renders both in the live viewer and in static snapshots.

### 1. New hotspot type `image`

a. Add `'image'` to `HotspotActionType` in `src/types/viralTemplates.ts` and to the inline union in `FullResolutionHotspotEditor.tsx`.
b. Extend `Hotspot` with two optional fields:
   - `imageSrc?: string` — public URL of the uploaded image.
   - `imageNaturalRatio?: number` — width / height, used to lock resizing.
c. Add `'image'` to `DATA_HOTSPOT_TYPES` in `src/lib/hotspotClassification.ts` so classification, overlap-skipping, and the existing "data" UI grouping pick it up automatically. Update `hotspotClassification.test.ts`.

### 2. Editor: paste-to-add flow

a. Add a new Data category tile **Image** (icon: `ImageIcon` from lucide) next to Live Number / Chart / Map in `FullResolutionHotspotEditor.tsx`.
b. Selecting the tile does **not** drop a placeholder. Instead it puts the editor into "awaiting paste" mode and shows a single-line hint: "Paste an image (⌘V / Ctrl+V) to place it."
c. A window-level `paste` listener (active only while the Image tile is selected) reads the first `image/*` item from `e.clipboardData.items`, uploads it (see §3), then inserts a new hotspot with:
   - `type: 'image'`, `iconId: 'image-paste'`
   - `imageSrc`, `imageNaturalRatio` from the decoded blob
   - Default size: 30% width, height computed from the ratio so the box matches the image
   - Centered on the canvas (`x = 50 - width/2`, `y = 50 - height/2`)
d. After insertion, the category auto-resets to neutral so a second paste does not duplicate.

### 3. Upload to existing `slides` bucket

a. Reuse the public `slides` bucket (already used for slide backgrounds) under path prefix `hotspot-images/{deckSlug or 'standalone'}/{uuid}.{ext}`.
b. Upload via `supabase.storage.from('slides').upload(...)` then `getPublicUrl(...)`; store the public URL in `imageSrc`. No DB schema change — the hotspot record lives inside the slide's existing `hotspots` JSON.
c. Decode the blob with `URL.createObjectURL` + `new Image()` to read `naturalWidth` / `naturalHeight` and compute `imageNaturalRatio` before placement.
d. Surface upload errors via the existing `useToast`.

### 4. Canvas rendering in the editor

a. In the hotspot render switch inside `FullResolutionHotspotEditor.tsx`, add a branch for `type === 'image'`: render an `<img>` filling the hotspot box with `object-fit: contain` and `pointer-events: none` (drag/resize handled by the standard wrapper).
b. Because the box itself is sized from the locked ratio, `contain` and `fill` look identical — using `contain` is safer against rounding drift.

### 5. Locked aspect-ratio resize

a. New `ImageCalibrationControls` component (mirrors `ChartCalibrationControls` layout — X, Y, W, H sliders, plus a read-only "Aspect ratio" pill and a **Replace image** button that re-arms paste mode).
b. When W changes, H is recomputed as `W / ratio * canvasRatio` (in percent space, accounting for canvas aspect so the on-screen box stays visually proportional). Same for H → W. This matches how `MapCalibrationControls` constrains its bounds today.
c. Drag-corner resize in the draggable wrapper: intercept the resize handler for `image` hotspots and project the user's drag onto the locked-ratio diagonal so freehand resizing also preserves the ratio.

### 6. Live viewer rendering

a. `HybridSlide` / `StatsPageSlide` (whichever currently iterates over data hotspots) gain an `'image'` branch that renders an `<img src={h.imageSrc}>` at the hotspot's percent coords with `object-fit: contain`.
b. No metric subscription, no live data — it's a static image, just like a background but scoped to a hotspot box.

### 7. Snapshot rendering (`supabase/functions/render-stats-snapshot/index.ts`)

a. Add an `image` case to the per-hotspot renderer that emits an `<image>` SVG element with `href={imageSrc}`, `preserveAspectRatio="xMidYMid meet"`, and the percent-derived x/y/width/height.
b. Because images are baked into the SVG via a URL reference (the same pattern used for the slide background), no additional fetching is required.

### 8. Classification & validation

a. Auto-classification already promotes a slide to `hybrid` / `stats_page` whenever a `DATA_HOTSPOT_TYPES` member is present — adding `image` to that set is sufficient.
b. Overlap detection already skips data hotspots (see `2026-04-07_skip-data-hotspot-overlap`), so an image hotspot freely overlaps anything.

### 9. Decision doc

a. Save the plan to `docs/decisions/hotspots/2026-06-07_image-data-hotspot_feature-doc_lovable.md` with `Status: Approved & Implemented` and today's date. This is a **new** plan (not an update to an existing one).

### Out of scope

- Drag-and-drop file picker (paste only, per your direction).
- Image cropping / filters.
- Multi-image galleries.
- Cropping the upload bucket — files persist with the slide.

### Technical notes

- Reusing the public `slides` bucket avoids a migration and storage policy work; access is already public-read.
- The natural-ratio lock is purely client-side math; the saved hotspot stays in the same `hotspots` JSON column the editor already writes, so no schema change is needed.
- Snapshot renderer reads `imageSrc` as a normal URL — SVG `<image href>` handles cross-origin public URLs without extra CORS work.
