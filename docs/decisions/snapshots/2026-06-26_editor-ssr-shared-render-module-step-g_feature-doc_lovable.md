---
Status: Approved & Implemented
Date: 2026-06-26
---

# Editor ↔ SSR shared-render module — Step g

Builds on `2026-06-26_editor-ssr-shared-render-module-step-f_feature-doc_lovable.md`.

## Goal

Finish the migration started in steps a–f: consolidate the last duplicated
piece of rendering logic (map marker rules) and round out the visual parity
harness with campaign-story segment fixtures.

## What shipped

1. **Shared map-marker rules** — `supabase/functions/_shared/render/mapMarkerRules.ts`
   (canonical, Deno-safe) + `src/shared/render/mapMarkerRules.ts` (editor re-export).
   - a. Exposes `MEDIUM_COLORS` (hex) and `MEDIUM_COLORS_RGB` (`[r,g,b]` tuples) so
     the live editor's SVG markers and the SSR's pixel-blit pipeline share one
     palette.
   - b. Exposes `SPAWN_STROKE` / `DEFAULT_STROKE` (hex + RGB) for the green
     "this seed propagated" cue and the white "no spawns" stroke.
   - c. Helper functions `resolveMarkerFill`, `resolveMarkerFillRgb`,
     `resolveMarkerStroke`, `resolveMarkerStrokeRgb` for both consumers.

2. **Editor wired in** — `src/components/MapHotspotRenderer.tsx` deletes its
   local `MEDIUM_COLORS` / `DEFAULT_COLOR` constants and its hard-coded
   `"#22c55e" : "white"` ternary; it now calls `resolveMarkerFill` and
   `resolveMarkerStroke`.

3. **SSR wired in** — `supabase/functions/render-stats-snapshot/index.ts`
   deletes the local `MEDIUM_COLORS_HEX` / `DEFAULT_COLOR_HEX` / `SPAWN_STROKE`
   / `DEFAULT_STROKE` constants and imports the same names from
   `_shared/render/mapMarkerRules.ts`. SSR redeployed.

4. **ParityHarness §4** — new "Campaign-story segment split" tab in
   `src/pages/ParityHarness.tsx` renders three fixtures side-by-side as
   `full | first | second` columns, driven by `splitCampaignStoryAtMidpoint`.
   Lets us visually confirm:
   - a. The `__TITLE__…__TITLE__` block is pinned to `first`.
   - b. A trailing `Date of this report:` paragraph is pinned to `second`.
   - c. Middle paragraphs balance by character count.

5. **Tests** — `src/shared/render/mapMarkerRules.test.ts` adds 6 cases:
   - a. Hex/RGB palette parity per medium.
   - b. Default color and stroke hex/RGB parity.
   - c. `resolveMarkerFill` known + fallback paths.
   - d. `resolveMarkerStroke` spawn-state flip.

   Full suite: **50 tests passing** across 6 shared-render files.

## Why this matters

Marker color was the last place the editor and SSR could silently disagree on
a visual fundamental. A bad palette change in either file is now a one-line
fix that propagates to both renderers automatically, and the test suite fails
if the hex and RGB tables ever drift.

## Files touched

- `supabase/functions/_shared/render/mapMarkerRules.ts` (new)
- `src/shared/render/mapMarkerRules.ts` (new)
- `src/shared/render/mapMarkerRules.test.ts` (new)
- `src/components/MapHotspotRenderer.tsx` (use shared helpers)
- `supabase/functions/render-stats-snapshot/index.ts` (import shared palette)
- `src/pages/ParityHarness.tsx` (§4 story-split section)
- `docs/BACKLOG.md` (mark item 11.f shipped, 11.i complete)

## What did not change

Map-marker geometry (radius, stroke-width = 2, circle shape) is still inlined
in `MapHotspotRenderer.tsx`'s `getMarkerSVG` — the SSR doesn't draw an SVG
circle, it blits pixels. Geometry could move to the shared module in a future
step if it ever changes, but today it is stable and trivially in sync.
