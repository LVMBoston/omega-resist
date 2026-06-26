# Extend Official Start cutoff to all user-visible reports

## 1. Background
On 2026-06-26 we added a per-campaign `official_start_at` override. It is currently honored by:
- `useLiveMetrics` (headline numbers)
- `useChartData` (weekly chart)
- `campaignNarrative` (story narratives)
- `MapHotspotRenderer` / `get_campaign_map_events` RPC (deck map on shared link)
- `render-stats-snapshot` edge function (snapshots)
- `CampaignEoaManager` Start Date/Time column

It is **not** honored anywhere else. Below is the audit of every user-visible report that still shows pre-launch / test events when an override is set, and the proposed fix.

## 2. Reports still showing pre-launch events

### 2a. Campaign Dashboard — Real-time Map (`SamizdatMap.tsx`)
The "Real-time map" on `/campaign-dashboard` is `SamizdatMap`, which queries `url_events` directly (lines ~664, 675, 734) with no cutoff. Pre-launch markers, chain animation, and counts all include test events.

### 2b. Campaign Dashboard — Event Listing tab (`CampaignDashboard.tsx` `fetchEvents` / `fetchEventsV2`)
The Events table, CSV/clipboard export, and the auto-computed default date range (line 762, `allDates = eventsV2Data.map(...)`) all ignore the override. The min-date pill therefore reports a pre-launch date.

### 2c. Campaign Dashboard — summary counters
The header KPI strip and per-EoA totals reuse the unfiltered `events` array. Without the cutoff they double-count test scans.

### 2d. Campaign Analytics page (`CampaignAnalytics.tsx`)
Viral coefficient, conversion funnel, amplification, engagement, and cycle-time queries all read `url_events` (or RPCs that do) without filtering on `official_start_at`.

### 2e. Shared public dashboard (`SharedDashboardMap.tsx`, `SharedDashboard.tsx`)
External `/shared/:code` viewers see pre-launch markers and pre-launch event counts.

### 2f. Activity Monitor (`ActivityMonitor.tsx` + `ActivityMap.tsx`)
Admin-facing live view. Per backlog 10b we previously chose to leave this unfiltered for debugging; this plan adds a toggle (default = honor cutoff, "Show pre-launch events" reveals them) instead of leaving the inconsistency.

### 2g. Event Story panels (`EventStoryPanel.tsx`, `EventStoryDialog.tsx`)
"First share", "fastest hop", "active since" anchors read raw `url_events`. They mis-report the campaign's start moment.

### 2h. PDF & CSV exports (`campaignPdfExport.ts`, `exportCampaignData.ts`)
Both pull raw events; printed reports and downloaded CSVs include pre-launch rows with no marker.

### 2i. Virality Dashboard (`virality/analytics.ts`, `virality/queries.ts`, `ViralityDashboard.tsx`)
Cross-campaign aggregates ignore each campaign's cutoff, so the "fastest first share" / "earliest L01" leaderboards can be won by a test event.

### 2j. Campaign Dashboard header — missing badge
There is no visible indicator that an override is active, so an operator looking at a filtered chart has no cue why numbers differ from the raw DB.

## 3. Proposed fix (shared shape)

a. **Shared helper.** Add `src/lib/officialStart.ts` exporting:
   - `applyOfficialStartFilter(events, officialStartAt)` — pure client-side filter on `occurred_at`.
   - `useOfficialStart(campaignIdOrCode)` — react-query hook that returns `{ officialStartAt, preLaunchPredicate, headlinePredicate }`.
   - `splitEvents(events, officialStartAt)` → `{ headline, preLaunch }` so any panel can show a muted "Pre-launch / test: N" counter (item 4 of the original plan).

b. **Server-side filter for RPCs.** Extend the analytics RPCs used by `CampaignAnalytics` and `ViralityDashboard` with an optional `_since timestamptz` parameter (same pattern already used by `get_campaign_map_events`). Default `NULL` preserves legacy callers.

c. **`SamizdatMap`.** Accept `officialStartAt` as a prop from `CampaignDashboard` and filter the three `url_events` selects + chain-derivation sort. Markers excluded by the cutoff are dropped entirely (not greyed) to match the deck map's behavior.

d. **`CampaignDashboard`.** Fetch `campaigns.official_start_at` alongside the campaign row; pass it to `SamizdatMap`, apply it inside `fetchEvents` / `fetchEventsV2`, and derive the default date-range min from headline events only. Show a small badge in the header (`Official start: Jun 24, 2026 12:00 AM`) and a muted "Pre-launch / test: N excluded" chip when N > 0.

e. **`CampaignAnalytics`.** Pass the cutoff into every RPC call and into client-side aggregations. No UI change beyond the same header badge.

f. **`SharedDashboard*`.** Cutoff already exists on the campaign row available to public viewers (read via the existing public RPC); apply it to the shared map and KPI strip.

g. **`ActivityMonitor`.** Add an admin-only "Show pre-launch events" switch in the filter bar; default off when the selected campaign has an override, on otherwise.

h. **`EventStoryPanel` / `EventStoryDialog`.** Use `splitEvents` so "first share", "fastest hop", and timeline anchors are computed only from headline events.

i. **`campaignPdfExport` / `exportCampaignData`.** Filter rows before render/serialization; append a footer line `Pre-launch / test events excluded: N` whenever the override is set.

j. **`virality/analytics.ts` & `queries.ts`.** Join `campaigns.official_start_at` and apply the cutoff per campaign in the aggregation step.

## 4. What does NOT change
- No schema changes beyond optional `_since` parameters on existing RPCs.
- `url_events` rows are never deleted or rewritten. The override remains reversible.
- Per-EoA overrides (backlog 10d) remain deferred.

## 5. Verification (per Visual Bug Debugging Rule)
For each surface above, in a browser session on a campaign with `official_start_at` set in the future-of-some-events:
- Confirm pre-launch markers/rows disappear from headline views.
- Confirm the "Pre-launch / test: N" counter equals the count of excluded rows.
- Confirm clearing the override restores the prior numbers.
- Take screenshots of: Campaign Dashboard map + Event listing, Campaign Analytics, Shared Dashboard, and a fresh SSR snapshot.

## 6. Decision log
On approval and implementation, archive this plan as:
`docs/decisions/reporting-start/2026-06-26_official-start-cutoff-rollout_feature-doc_lovable.md`
with `Status: Approved & Implemented`. This is an **update** to the existing plan recorded at `docs/decisions/campaigns/2026-06-26_campaign-official-start-override_feature-doc_lovable.md`; append it there as a `## Update — 2026-06-26` section as well, per the Decision Log Rule. Backlog item #10 (a, b, c, e) is fully resolved by this work; 10d (per-EoA override) and 10f (decision archive) remain.
