# Image Data Hotspot

**Status:** Approved & Implemented
**Date:** 2026-06-07
**Author:** lovable
**Project Area:** hotspots

## Summary

Adds a fourth Data category — **Image** — to the Full-Resolution Hotspot Editor alongside Live Number, Chart, and Map. Editors paste an image from the clipboard onto the slide; the hotspot locks to the image's natural aspect ratio and can be repositioned and resized (resizing one side auto-adjusts the other). The image renders both in the live viewer (HybridSlide, StatsPageSlide) and in static SVG snapshots produced by the `render-stats-snapshot` edge function.

## Changes

### 1. Type system

a. `src/types/viralTemplates.ts` — added `'image'` to `HotspotActionType` and two optional `Hotspot` fields: `imageSrc?: string` and `imageNaturalRatio?: number`.
b. `src/lib/hotspotClassification.ts` — added `'image'` to `DATA_HOTSPOT_TYPES`. Auto-classification now promotes a slide containing only an image hotspot to `stats_page`, and a mix of actions + images to `hybrid`.
c. `src/lib/hotspotClassification.test.ts` — added regression test for the new type.

### 2. Editor — paste-to-place

a. `src/components/FullResolutionHotspotEditor.tsx`
   - New `image` IconCategory tile in the Data row (with the lucide `Image` icon).
   - Selecting the tile enters **paste mode** instead of showing icon variants. Hint reads: *"Paste an image (⌘V / Ctrl+V) to place it."*
   - Window-level `paste` listener reads the first `image/*` clipboard item, uploads it to the existing public `slides` bucket under `hotspot-images/{uuid}.{ext}`, decodes the blob to read `naturalWidth`/`naturalHeight`, and inserts a hotspot centered on the canvas at 30% width with height computed to preserve the natural aspect ratio in percent space.
   - `image` added to `allowMultiple` so multiple images can coexist on one slide.
   - Canvas branch in `renderDataHotspot` renders `<img>` with `object-fit: contain` and `pointer-events: none`.

### 3. Calibration controls

a. `src/components/ImageCalibrationControls.tsx` (new) — X/Y/W/H sliders with W and H linked via the formula `H% = W% * canvasAspectRatio / imageRatio`. Includes a thumbnail preview, an aspect-ratio readout, and a **Replace** button that re-arms paste mode.
b. Wired into the editor's right panel via `renderDataControls`.

### 4. Runtime viewers

a. `src/components/HybridSlide.tsx` — filters out `image` hotspots and renders them as positioned `<img>` elements with `object-fit: contain`. Pointer-events disabled so they never intercept clicks targeted at action hotspots.
b. `src/components/StatsPageSlide.tsx` — same treatment.

### 5. Snapshot baking

a. `supabase/functions/render-stats-snapshot/index.ts` — excludes `image` hotspots from the text-hotspot pass and renders them as `<image href="..." preserveAspectRatio="xMidYMid meet"/>` SVG elements between the map layer and the text layer. Public Supabase Storage URLs work directly inside `href`; no base64 inlining required.

## Rationale

- Paste-from-clipboard is the fastest way to drop a logo, sticker, or callout illustration onto a stats page without leaving the editor.
- Locking the box to natural aspect ratio prevents the most common authoring mistake (squashed images).
- Reusing the public `slides` bucket avoids a migration; existing admin/manager upload policies already cover this surface.
- Treating image as a data hotspot (rather than an action) reuses the existing data-template promotion path and the existing overlap-skipping behavior for non-interactive elements.

## Out of scope

- Drag-and-drop file picker (paste only, per user direction).
- Cropping, filters, or color adjustments.
- Multi-image galleries inside a single hotspot.

## Files Changed

- `src/types/viralTemplates.ts`
- `src/lib/hotspotClassification.ts`
- `src/lib/hotspotClassification.test.ts`
- `src/components/FullResolutionHotspotEditor.tsx`
- `src/components/ImageCalibrationControls.tsx` (new)
- `src/components/HybridSlide.tsx`
- `src/components/StatsPageSlide.tsx`
- `supabase/functions/render-stats-snapshot/index.ts`
- `docs/decisions/hotspots/2026-06-07_image-data-hotspot_feature-doc_lovable.md` (new — this doc)
