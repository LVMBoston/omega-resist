# Parity Harness — Live Campaign Mode (Step 11.f extension)

Status: Approved & Implemented
Date: 2026-06-26

## What this adds

`/parity-harness?section=5` — a new tab that swaps the canned fixtures for
real campaign data. Pick a campaign, optionally pick a deck, pick a slide,
then compare the editor render against the freshly-generated SSR snapshot.

## How to use

1. Open `/parity-harness?section=5` (or click the **§5 live campaign** chip).
2. Choose a campaign. Deck and slide pickers populate automatically.
3. Click **Render SSR** to invoke `render-stats-snapshot` for the chosen
   `template_id` + `campaign_code`. The returned SVG is shown on the right.
4. Toggle **Overlay SSR @ 50%** to superimpose the SSR output on top of the
   editor render at half opacity — any pixel drift is immediately visible.
5. Click **Re-render SSR** after data changes (e.g. new opens, new story
   text) to refresh the right pane.

## What it catches that fixtures miss

- Real story lengths and wrap behavior.
- High-density real map marker layouts.
- Per-campaign settings (`official_start_at`, timezone, aspect ratio).
- Edge-case hotspot configs only present in production data
  (`email_support`, locked maps, `manualHtml` blocks, overrides).

## What did NOT change

- No new tables, no migrations.
- No new edge functions; reuses `render-stats-snapshot` as-is.
- Fixture sections §1–§4 unchanged.
- Auth scope unchanged — RLS limits the campaign list to what the signed-in
  user can already see.

## Files

- `src/pages/parity/LiveCampaignSection.tsx` (new)
- `src/pages/ParityHarness.tsx` (new §5 button + mount)
