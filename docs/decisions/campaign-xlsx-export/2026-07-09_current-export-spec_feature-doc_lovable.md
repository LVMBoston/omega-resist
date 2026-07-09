# Campaign XLSX Export — Current Shipped Spec (As-Built)

Status: Approved & Implemented
Date: 2026-07-09
Scope: `src/lib/exportCampaignXlsx.ts` (single file, 603 lines)
Entry point: `exportCampaignXlsx(campaignId, campaignCode, dataSource)` — invoked from `src/pages/CampaignDashboard.tsx`
See also:
- [Data-shape-first enhancements (proposed)](./2026-07-09_data-shape-first_feature-doc_lovable.md)
- [EoA analysis layer (proposed)](./2026-07-09_eoa-analysis-layer_feature-doc_lovable.md)

## 1. Purpose

A single downloadable `.xlsx` workbook that captures **everything a reviewer needs to trust the Campaign Story narrative**: the rendered narrative itself, every summary metric it references, and the raw rows the metrics were computed from — with an in-workbook recipe for recomputing each metric.

## 2. Data-integrity contract

- 2a. Every summary number on the Reference tab must be recomputable using **only** the Events and Tokens tabs. New summaries require a supporting raw column.
- 2b. Zero-valued metrics are still displayed (they are meaningful signal). Zero-row sections are omitted (per data-integrity rule — no fabricated placeholders).
- 2c. Lane classification (`broadcast` / `chain` / `orphan`) uses the shared predicate in `@/shared/render/lineageClassify` — the same one the metric layer uses. No second copy in this file.
- 2d. Depth uses `public.token_lineage.true_depth` (un-clamped edge-walked depth). `stored_level` is included for audit but `true_depth` is authoritative.
- 2e. `dataSource` = `real | simulated | all`. When set to `all`, the metric layer is still called with `real` (simulator noise stays isolated from headline metrics).

## 3. Workbook shape (three tabs)

### 3a. Reference tab

Human-readable guide with these blocks in order:

1. Header (campaign code, data source, generated timestamp, row counts)
2. **Block A — Events guide** (column dictionary for Tab 2)
3. **Block B — Tokens guide** (column dictionary for Tab 3)
4. **Block C — Campaign Story summary** (metric, value, source tab, recompute recipe)
   - Seeds, Broadcast opens, Chain shares, Chain viewers, Completed shares
   - Conversion rate, Any-hop completion rate (blended)
   - Views (all lanes), Zip codes opened in, US states opened in, International countries
   - Max chain depth, Orphan count, Last share
5. Per-hop conversion table (from_depth → to_depth, counts, rate)
6. Depth histogram (`true_depth`, non-orphan)
7. Data anomalies line (orphan count callout)
8. **Metric-layer vs recomputed-from-raw cross-check** (three rows: broadcast opens, chain viewers, orphans — each shows metric-layer value, recomputed value, OK/MISMATCH)
9. Campaign Story rendered narrative paragraph (identical text to the in-app hotspot)

### 3b. Events tab

One row per `url_events` row. Row 1 = headers, row 2+ = data. Columns:

- `event_id`, `token`, `true_depth`, `root_token` (joined from `token_lineage`)
- `event_type`, `occurred_at`, `location_source`, `zip_code`, `region`, `country`, `is_simulated`
- `lane` — `broadcast | chain | orphan` from the shared classifier

### 3c. Tokens tab

One row per token. Row 1 = headers, row 2+ = data. Columns:

- `token`, `stored_level`, `true_depth`, `level_depth_mismatch`
- `parent_token`, `root_token`, `is_seed`, `is_orphan`, `is_simulated`
- `minted_via` (`mint_l00` / `instantiate_l00_token` / `maybe_reinstantiate_l00` / `mint_share`)
- `created_at`, `eoa_id`
- `utm_medium`, `utm_content`, `utm_campaign`
- `engagement_state` (`none | intent | completed`) — mirrors SamizdatMap border rules

## 4. Data pipeline

1. Call `computeCampaignStoryInputs(supabase, { campaignCode, campaignId, dataSource: metricSource })` for the Reference summary block and the rendered narrative.
2. Fetch `token_lineage` rows for the campaign (paged via shared `fetchAll` helper — 1000-row batches to work around Supabase pagination limits).
3. Fetch `tokens.utm_content` in 500-token chunks and join by token id.
4. Fetch `url_events` for those tokens in 500-token chunks (paged inside each chunk).
5. Build:
   - `lineageByToken` map for the Events tab join
   - `viewedTokens` set (tokens with any `view` event) for engagement-state computation
   - `laneByToken` map from `classifyLane`
   - `engagement` map (`computeEngagementStates`) — a token is `completed` when any child has a view event, `intent` when any child exists, otherwise `none`
6. Single pass over `events` and `lineageRows` to compute recomputed-from-raw counters used by the Reference cross-check.
7. Render narrative via `formatCampaignStory(...)` using the metric-layer inputs.
8. Write workbook via SheetJS (`xlsx`) client-side; filename `${campaignCode}-YYYY-MM-DD-HHmm.xlsx`.

## 5. Non-goals (explicitly out)

- 5a. Excel Tables, LAMBDA helpers, "Stories" tab — deferred (see sibling proposed doc).
- 5b. EoA-level analysis — deferred (see sibling proposed doc).
- 5c. VBA / `.xlsm` output.
- 5d. Server-side rendering — export runs entirely in the browser from the dashboard.

## 6. Files touched

- `src/lib/exportCampaignXlsx.ts` — the entire export.
- `src/pages/CampaignDashboard.tsx` — invocation only.

Shared modules reused:
- `@/shared/render/campaignStoryInputs` (`computeCampaignStoryInputs`)
- `@/shared/render/campaignStory` (`formatCampaignStory`)
- `@/shared/render/lineageClassify` (`classifyLane`, `isOrphanRow`)

## 7. Invariants worth preserving

- 7a. Column-order dictionaries (`EVENT_COLUMNS`, `TOKEN_COLUMNS`) are the **single source of truth** for header order. Body-builder loops rely on this — add columns in both places or the row shape drifts.
- 7b. The Reference tab's "How to recompute" column is the contract with the reviewer. Every new metric added there must be reproducible from the raw tabs alone.
- 7c. Lane / orphan classification must never be re-implemented in this file — always call the shared classifier.
