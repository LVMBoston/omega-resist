# Campaign Reporting Start Override

## 1. Goal
Let an admin set an **official campaign start date/time** on a campaign. Events that happened before it are bucketed as **"pre-launch / test"** and excluded from headline metrics, narratives, map, and snapshots. When the override is empty, today's behavior (start = first real event) is unchanged.

## 2. UX

a. **Where it lives:** on the Campaign edit form (Campaign Detail / Campaign Manager), **not** the EoA creation page. Rationale: the answer was "per-campaign override," so a single field on the campaign is the right home and avoids confusion about which EoA's value wins.

b. **Control:** one optional `datetime-local` field labeled **"Official start (optional)"** with helper text: *"Events before this time are treated as pre-launch / test and excluded from headline metrics."* A "Clear" button resets it to null (default behavior returns).

c. **Visibility cue:** when set, show a small badge on the dashboard header — `Official start: Jun 26, 2026 9:00 AM` — with a tooltip explaining the bucket.

d. **Pre-launch bucket display:** on Campaign Dashboard, add a muted "Pre-launch / test" row to the summary strip showing counts of excluded scans/views/shares, so nothing feels hidden.

## 3. Data model

a. Add column `campaigns.official_start_at timestamptz null`.
b. No backfill. Null = "use first real event" (current behavior).
c. No change to `url_events` or `tokens` — events are never deleted or rewritten; filtering is purely at read time.

## 4. Reporting changes (read-time filter)

All of these accept the campaign's `official_start_at` and split events into **headline** (>= start) vs **pre-launch** (< start):

a. `useLiveMetrics` — filter event stream by `occurred_at >= official_start_at`; expose `preLaunchCounts` alongside headline counts.
b. `useChartData` — same filter; timeline x-axis begins at `official_start_at` when set.
c. `campaignNarrative.ts` — "earliest event" / "fastest share" / propagation windows use filtered set; narrative skips pre-launch entirely (per Data Integrity Rule, no fabricated content).
d. `SamizdatMap` / `get_campaign_map_events` RPC — add optional `_since timestamptz` parameter; UI passes `official_start_at`. Pre-launch markers omitted from the main map; optional toggle "Show pre-launch events" greyed out by default.
e. `render-stats-snapshot` edge function — read `official_start_at` from the campaign row and apply the same filter to every metric and the map layer, so snapshots match the live dashboard.
f. CSV/PDF exports — same filter; pre-launch counts appear in a separate footer line.

## 5. What does NOT change
- Token minting, short URLs, IP/zip privacy logic, EoA creation flow.
- Historical data is preserved; the override is reversible at any time.
- Per-EoA start dates are not introduced (explicitly rejected to keep semantics simple).

## 6. Technical notes (for the developer)
- Migration: `ALTER TABLE public.campaigns ADD COLUMN official_start_at timestamptz;` plus regenerate types.
- RPC: extend `get_campaign_map_events(_campaign_code text)` → `get_campaign_map_events(_campaign_code text, _since timestamptz default null)`; old callers unaffected.
- Snapshot renderer: reads the new column once per render; no schema changes elsewhere.
- All filtering uses `occurred_at >= official_start_at` (inclusive) so the boundary minute is counted as live.

## 7. Decision log
After implementation, archive this plan to `docs/decisions/campaigns/2026-06-26_campaign-official-start-override_feature-doc_lovable.md` with `Status: Approved & Implemented`. This is a **new plan** (not an update to an existing one).
