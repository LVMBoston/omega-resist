# Campaign XLSX Export — EoA Analysis Layer

Status: Proposed — Not Yet Implemented
Date: 2026-07-09
Scope: `src/lib/exportCampaignXlsx.ts`
See also: [Data-shape-first enhancements](./2026-07-09_data-shape-first_feature-doc_lovable.md)

## 1. Why an EoA layer belongs in the export

Every token already carries `eoa_id`, but the export treats EoAs as opaque UUIDs. That blocks the most common real-world question — **"how did each event / action perform?"** — because a reviewer would have to hand-join UUIDs to human labels in another tool.

Adding EoA context turns the workbook into something you can slice by placement (a specific canvass, a specific mailer, a specific rally) without leaving Excel, and it makes future "week-to-week" story variants trivially filterable by EoA.

## 2. What to add

### 2a. New EoA fetch step

Pull all EoAs for the campaign once (single query — EoAs per campaign are small):

- `id`, `type` (event/action), `title`, `mobilize_code`, `utm_id`, `assigned_deck_slug`
- `site_name`, `city`, `state`, `zip_code`, `timezone`
- `start_date`, `end_date`

Build an `eoaById` map for joins.

### 2b. New "EoAs" tab (one row per EoA)

All aggregates recomputable from the join of EoAs + Tokens + Events tabs (no fabricated metrics, per the data-integrity rule):

- `eoa_id`, `type`, `title`, `mobilize_code`, `utm_id`, `site_name`, `city`, `state`, `zip_code`, `timezone`, `assigned_deck_slug`, `start_date`, `end_date`
- `seed_count` — base L00 tokens minted for this EoA
- `instance_count` — per-scan L00 instance tokens
- `chain_share_count` — L1+ tokens (depth ≥ 1, non-orphan)
- `view_count` — `view` events on any token tied to this EoA
- `broadcast_opens`, `chain_viewers` — same lane classification as the Reference tab, scoped to this EoA
- `unique_zip_count`, `unique_state_count`, `international_country_count`
- `max_depth` reached in this EoA's lineage
- `first_event_at`, `last_event_at`
- `completed_share_count` — L1+ tokens whose `engagement_state = completed`

Every one of these is a `COUNTIFS` / `SUMIFS` away from the Events and Tokens tabs, so a reviewer can verify any number without trusting the export code.

### 2c. Enrich existing Events and Tokens tabs

Add EoA-join columns to both, materialized from `eoaById`:

- `eoa_title`, `eoa_type`, `eoa_mobilize_code`, `eoa_site_name`, `eoa_city`, `eoa_state`

Filters like "show me all events for the Brooklyn canvass" now work without a lookup.

### 2d. Reference tab additions

- **Top EoAs by chain activity** — top N by `chain_share_count`, then `view_count`, then `max_depth`, with title + `mobilize_code` for stability.
- Extend column dictionary with every new column across all three raw tabs.
- Extend cross-check block: for a sample EoA, confirm `sum(eoa.view_count) == events_tab_view_count for that eoa_id`.

### 2e. Composability with the data-shape-first plan

Once EoAs are a first-class dimension, the Stories tab gains an obvious axis:

- Week-over-week **per EoA** (`tblEvents[iso_week]` × `tblEvents[eoa_title]`)
- Lane decay **per EoA type** (event vs action)
- Cohort by EoA `start_date` week

No new mechanism required — Excel Tables + structured references handle it once the columns exist.

## 3. What does not change

- No new backend queries beyond one `select ... from events_actions where campaign_id = ?`
- No changes to `computeCampaignStoryInputs` or the rendered narrative
- No changes to dashboard UI
- Reference tab's existing sections stay byte-identical; EoA content is additive

## 4. Suggested sequencing

1. EoA fetch + `eoaById` + join enrichment on Events and Tokens tabs (smallest, unlocks everything else)
2. New "EoAs" tab with aggregates
3. Reference tab "Top EoAs" section + column-dictionary entries + expanded cross-check
4. (Deferred, per the sibling plan) Excel Tables, LAMBDA library, Stories tab — with EoA as a native pivot dimension

## 5. Risks / open questions

- 5a. **EoA cardinality.** For campaigns with many EoAs, cap the Reference "Top EoAs" list (top 20?) and point at the EoAs tab for the full set.
- 5b. **Simulated data.** Simulator tokens carry a real `eoa_id`. EoA aggregates must respect the export's `dataSource` filter; Reference header should say so.
- 5c. **Deleted EoAs.** `tokens.eoa_id` has `ON DELETE CASCADE` — no orphan-EoA case to handle. Confirmed against schema.
- 5d. **Title collisions.** Two EoAs can share a title; always pivot on `mobilize_code` (or `eoa_id`) as the stable key, and note this on the Reference tab.

## 6. Technical details (for the implementer)

- File: `src/lib/exportCampaignXlsx.ts` only.
- Add `EOA_COLUMNS` dictionary alongside `EVENT_COLUMNS` / `TOKEN_COLUMNS`.
- Add `addTableSheet(wb, "EoAs", …)` between Reference and Events.
- Extend `EVENT_COLUMNS` and `TOKEN_COLUMNS` with joined columns; keep header order and row order in lockstep (existing invariant).
- Aggregation pass: single loop over `lineageRows` and `events`, incrementing per-`eoa_id` counters in a `Map<string, EoaAggregate>`; no extra queries.
- Respect the existing `dataSource` filter — the aggregation loop already only sees filtered rows.
