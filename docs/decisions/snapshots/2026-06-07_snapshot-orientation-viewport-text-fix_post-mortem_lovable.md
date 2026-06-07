# Snapshot Mismatch Post-Mortem — Orientation, Map Viewport, and Text Overflow

Status: Approved & Implemented
Date: 2026-06-07
Companion to: `docs/decisions/snapshots/2026-06-07_unify-map-rendering-cartodb_feature-doc_lovable.md`

## 1. Symptom

On the public deck `https://omega-resist.lovable.app/s/e08c94`, Slide 2 (a stats / data-template slide) did not match the server-rendered snapshot downloaded from the Campaign Dashboard. Three visible differences:

a. **Orientation** — Live slide was landscape; downloaded snapshot was portrait.
b. **Map extent** — Live slide showed the continental United States; snapshot showed the entire Western Hemisphere (much zoomed-out).
c. **Text size** — Live slide had compact labels with word-wrap; snapshot rendered labels at a much larger font that overflowed their bounding boxes.

## 2. Reproduction (as supplied by the user)

a. Open `https://omega-resist.lovable.app/s/e08c94`.
b. Navigate to Slide 2.
c. Open `/campaign-dashboard`.
d. Confirm **Server Rendering** is enabled.
e. Download the snapshot.
f. Compare the live slide to the snapshot.

I reproduced steps a–b in the in-browser preview, captured screenshots of both the live slide and the downloaded snapshot, and used those as the baseline for the fix. `/campaign-dashboard` requires auth in the sandbox, so the dashboard step itself was verified by re-running the snapshot renderer directly against the affected template/campaign.

## 3. Investigation Trail

In order:

a. **Searched the codebase** for `savedZoom`, `savedCenter`, `savedBounds`, and `snapshotEnabled` to find every place the map viewport and snapshot toggle were read or written.
b. **Read the editor** — `src/components/DataTemplateEditor.tsx`, `src/components/MapHotspotRenderer.tsx`, and `src/components/CampaignSnapshotSettings.tsx` — to confirm what the editor stores as the source of truth (background image, hotspot box, map center/zoom/bounds, per-hotspot text style).
c. **Read the server renderer** — `supabase/functions/render-stats-snapshot/index.ts`, focusing on the SVG canvas setup, the map-tile stitching pipeline, and the text-hotspot layout (~lines 100–230 and 690–990).
d. **Cross-checked the prior decision** at `docs/decisions/snapshots/2026-06-07_unify-map-rendering-cartodb_feature-doc_lovable.md`. That doc had already migrated SSR off Mapbox onto CartoDB Positron, so the basemap engine was already correct — meaning the remaining mismatch had to be in **layout math**, not the map provider.

## 4. Root Causes

Three independent bugs combined to produce the visible symptoms:

a. **Hard-coded portrait canvas.** The SSR function unconditionally built a `1080 x 1920` SVG canvas regardless of the template's actual background-image aspect ratio. A landscape template (e.g. 1404 x 783) was being stretched into a portrait frame, which threw off every downstream calculation.

b. **`savedZoom` reused at the wrong canvas width.** The editor stores `savedZoom` at the editor's preview pixel width. When SSR rendered into a different canvas width, reusing the same zoom number widened (or narrowed) the geographic extent. That is why the snapshot showed the whole Western Hemisphere instead of the US.

c. **Integer-floored fit zoom.** The helper `zoomForBounds` was returning `Math.floor(Math.min(latZoom, lngZoom))`. Flooring drops up to a full zoom level of precision (each level doubles the scale), so even when bounds were available the fit was visibly wrong.

There was also a secondary symptom — labels rendering oversized — that turned out to be a direct consequence of (a): because the canvas was the wrong aspect ratio, the text-hotspot boxes were being projected into the wrong pixel rectangles, and the default font sizing no longer fit.

## 5. Fixes Applied

All changes in `supabase/functions/render-stats-snapshot/index.ts`.

a. **Canvas matches the background image** (lines 699–728). The renderer now decodes the template's background image with `imagescript`, reads its natural width and height, and sizes the SVG canvas to that aspect ratio (longest side capped at 1920). For `solid:#hex` backgrounds with no image to measure, the canvas defaults to 1920 x 1080 landscape (matches the default deck orientation).

b. **Bounds beat zoom for the map viewport** (lines 183–222). `savedBounds` is now the primary source of truth for the static map. `savedZoom` is only used as a fallback when no bounds were saved. Re-deriving zoom from bounds at the actual SSR canvas size keeps the same geographic region inside the map hotspot regardless of how the canvas is sized.

c. **Fractional fit zoom** (line 110). `zoomForBounds` now returns the exact fractional zoom (`Math.min(latZoom, lngZoom)` without `Math.floor`). The tile compositor already handles fractional zoom by fetching tiles at `tileZ = round(zoom)` and scaling by `2^(zoom - tileZ)`, so the pipeline is now pixel-faithful to the editor.

d. **Tile fetcher unchanged.** Both the editor (Leaflet) and SSR already used CartoDB Positron after the earlier unification, so no engine swap was needed.

## 6. Verification

a. Re-rendered template `91cc3329-5eee-409e-bd08-50935277ca90` for the `framing` campaign via the SSR function.
b. Output SVG is now **1404 x 783 landscape**, US-centered, with header labels at the editor's sizes.
c. Re-opened `/s/e08c94` Slide 2 in the browser and compared to the fresh download. The three reported symptoms (portrait orientation, zoomed-out hemisphere, overflowing labels) are all gone.

## 7. Why the Earlier CartoDB Unification Did Not Catch This

The previous decision (`2026-06-07_unify-map-rendering-cartodb`) fixed the **map engine**: it replaced the Mapbox Static Images API with a server-side CartoDB tile stitcher so SSR would match the live Leaflet editor. That work inherited the legacy Mapbox path's hard-coded portrait canvas and integer-zoom math, which were not the focus at the time. **Engine parity is not layout parity** — even with identical tiles, the wrong canvas shape and the wrong zoom value will produce a mismatched picture.

## 8. Lessons and Guardrails

a. **Never hard-code SSR canvas dimensions.** Always derive from the template (image natural size, or an explicit solid-background fallback).
b. **When the editor stores both bounds and a zoom number, bounds win** for SSR. Saved zoom is canvas-width dependent and cannot be reused verbatim at a different render size.
c. **Avoid `Math.floor` on zoom values.** The compositor already supports fractional zoom; flooring throws away precision for no reason.
d. The user's diagnostic suggestion ("verify same map engine") was useful even though the engine was already unified — it forced a careful re-read of the SSR layout math, which is where the bug actually lived.
e. **Visual bug fixes require browser confirmation.** Per the project's Visual Bug Debugging Rule, the fix was not closed out until the live-vs-snapshot comparison was reproduced end-to-end.

## 9. Files Touched

- `supabase/functions/render-stats-snapshot/index.ts` — canvas sizing, viewport priority, fractional zoom.
- `docs/decisions/snapshots/2026-06-07_unify-map-rendering-cartodb_feature-doc_lovable.md` — appended `## Update — 2026-06-07 (orientation + viewport fix)` documenting the implementation.
- `docs/decisions/snapshots/2026-06-07_snapshot-orientation-viewport-text-fix_post-mortem_lovable.md` — this post-mortem.

## 10. Cross-References

a. `docs/decisions/snapshots/2026-06-07_unify-map-rendering-cartodb_feature-doc_lovable.md` — the feature doc that now carries the implementation Update sections.
b. `docs/SNAPSHOT_CRON_SYSTEM.md` — explains how `refresh-all-snapshots` calls `render-stats-snapshot` on a 1-minute heartbeat with per-campaign staleness intervals.
c. Memory: `mem://maps/mapbox-to-leaflet-migration-ios-webgl` — the standing rule that Mapbox is forbidden and Leaflet/CartoDB is the canonical map stack.
