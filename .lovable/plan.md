# Plan: Post-mortem write-up for the snapshot mismatch fix

## 1. New document

Create `docs/decisions/snapshots/2026-06-07_snapshot-orientation-viewport-text-fix_post-mortem_lovable.md` with `Status: Approved & Implemented` header and today's date.

## 2. Sections to include

a. **Symptom** — User-visible mismatch on `/s/e08c94` Slide 2 vs. downloaded snapshot: portrait instead of landscape, Western Hemisphere instead of US-only, oversized text overflowing label boxes.

b. **Reproduction steps** — Exact path the user gave: open public slide, navigate to slide 2, go to `/campaign-dashboard`, confirm Server Rendering enabled, download snapshot, compare. Note that I reproduced live-slide and downloaded-snapshot screenshots in the browser to establish the baseline.

c. **Investigation trail** — In order:
  - Searched codebase for `savedZoom`, `savedCenter`, `savedBounds`, `snapshotEnabled`.
  - Read `DataTemplateEditor.tsx`, `MapHotspotRenderer.tsx`, `CampaignSnapshotSettings.tsx` to understand the editor's source of truth.
  - Read `supabase/functions/render-stats-snapshot/index.ts` lines 791–986 to inspect the SSR canvas + map + text rendering.
  - Cross-checked against the prior CartoDB unification decision doc.

d. **Root causes (three)** —
  - Hard-coded portrait canvas `1080x1920` in the SSR function, regardless of template aspect ratio.
  - `savedZoom` reused verbatim at a different canvas width than the editor's preview, widening the map.
  - `zoomForBounds` floored fractional zoom to an integer, dropping precision.

e. **Fixes applied** (with file + line refs in `supabase/functions/render-stats-snapshot/index.ts`):
  - Canvas now derived from template background via `imagescript` decode (lines 699–728); solid-bg fallback is 1920x1080.
  - `savedBounds` promoted to primary viewport source; `savedZoom` is fallback only (lines 183–222).
  - `zoomForBounds` returns fractional zoom (line 110).
  - Tile fetcher already on CartoDB Positron — no engine change needed; confirmed editor and SSR use the same basemap.

f. **Verification** — Re-rendered template `91cc3329-5eee-409e-bd08-50935277ca90` for the `framing` campaign: SVG is now 1404x783 landscape, US-centered, label sizes match editor. Browser re-check of `/s/e08c94` Slide 2 vs. fresh download confirms the three symptoms are gone.

g. **Why the earlier CartoDB unification didn't catch this** — That decision fixed the *map engine* (Mapbox → CartoDB) but inherited the same hard-coded portrait canvas and integer-zoom math from the legacy Mapbox path. Engine parity ≠ layout parity.

h. **Lessons / guardrails** —
  - SSR canvas must always be derived from the template, never hard-coded.
  - When the editor stores both `savedBounds` and `savedZoom`, bounds win because zoom is canvas-width dependent.
  - Avoid `Math.floor` on zoom values; tile compositing handles fractional zoom via `2^(zoom - tileZ)` scaling.
  - User's diagnosis ("verify same map engine") was a useful pointer even though the engine was already unified — it forced a re-read of the SSR layout math.

i. **Files touched** — list `supabase/functions/render-stats-snapshot/index.ts` and the updated decision doc.

j. **Cross-references** — Link to:
  - `docs/decisions/snapshots/2026-06-07_unify-map-rendering-cartodb_feature-doc_lovable.md` (the doc that now carries the implementation Updates).
  - `docs/SNAPSHOT_CRON_SYSTEM.md` (pipeline context).
  - Memory: `mem://maps/mapbox-to-leaflet-migration-ios-webgl`.

## 3. Conventions

a. Numbered sections, lettered sub-items per project rule.
b. No code changes in this task — documentation only.
c. Per the decision-log rule, this is a **new post-mortem** companion to the existing `2026-06-07_unify-map-rendering-cartodb` feature doc (which already has the Update sections). I am not overwriting that doc; I am adding a sibling post-mortem that tells the debugging story end-to-end.
