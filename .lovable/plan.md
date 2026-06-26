# Plan: Real-Campaign Mode for the Parity Harness

## 1. Why this is possible

Today `/parity-harness` runs on hand-built fixtures (sample hotspots, fake numbers). But the editor (`HybridSlide`) and the SSR renderer (`render-stats-snapshot`) both already accept the **same inputs** in production:

   a. a deck + slide config (background, aspect ratio, hotspots)
   b. a campaign's live metrics (numbers, story text, map markers)

So we can swap the fixtures for **real data** and compare exactly what a viewer/SSR snapshot would show — no schema changes required.

## 2. What "real-campaign mode" looks like

Add a new **§5 "Live Campaign"** section to `/parity-harness` with:

   a. A campaign picker (dropdown of campaigns the signed-in user can see).
   b. A slide picker (lists slides in that campaign's deck).
   c. Side-by-side render of the chosen slide:
       - Left: editor `HybridSlide` driven by `useLiveMetrics(campaignId)`.
       - Right: SSR SVG fetched from `render-stats-snapshot` for the same campaign + slide.
   d. A 50% opacity overlay toggle (same diff tool we use for fixtures).
   e. A "Refresh" button so you can re-pull metrics without reloading the page.

## 3. What this catches that fixtures miss

   a. **Real story lengths** — actual campaigns produce stories that wrap differently than the canned fixtures.
   b. **Real marker counts** — high-density maps expose clustering / z-order bugs.
   c. **Edge-case hotspot configs** — overrides, locked maps, `email_support`, `manualHtml` that only exist in production data.
   d. **Per-campaign settings** — `official_start_at`, timezone, aspect ratio overrides flow through both renderers.

## 4. What does NOT change

- No new tables, no migrations, no edge-function changes.
- Fixture sections (§1–§4) stay as-is for fast regression checks.
- No public exposure — harness stays behind the existing auth.

## 5. Scope of this step

   a. Add the campaign/slide pickers and the live-data fetch to `src/pages/ParityHarness.tsx`.
   b. Re-use existing `useLiveMetrics` and the existing SSR endpoint — no new APIs.
   c. Add a short doc in `docs/decisions/snapshots/` explaining how to use the new mode.

## 6. Out of scope (future, if useful)

   - Automated pixel-diff scoring across every slide of every campaign.
   - A "nightly parity report" that emails drift warnings.
   - Public sharing of harness output.

## 7. Decision-doc note

This is a **new** plan (not an update to an earlier one). On approval it will be archived as `docs/decisions/snapshots/2026-06-26_parity-harness-live-campaign-mode_feature-doc_lovable.md`.
