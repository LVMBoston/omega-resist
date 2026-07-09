## Status
Proposed — archives both brainstormed plans as future-feature docs. Neither will be built as part of this approval; approval only creates the two markdown files.

## What gets saved

Two files under `docs/decisions/campaign-xlsx-export/`, both marked **Status: Proposed — Not Yet Implemented** with today's date (2026-07-09) in the header and filename. This deviates slightly from the decision-log rule's default "Approved & Implemented" wording because these are backlog captures, not implemented work — the rule's structure (dated filename, topic folder, preserved content) is followed.

### 1. `docs/decisions/campaign-xlsx-export/2026-07-09_data-shape-first_feature-doc_lovable.md`

Captures the earlier plan:

- 1a. Enrich derived columns on Events (`iso_week`, `days_since_campaign_start`, `days_since_parent_event`, `hour_of_day`, `day_of_week`) and Tokens (`descendant_count`, `subtree_depth`, `path_to_root`, `first_event_at`, `last_event_at`, `days_active`)
- 1b. Convert Events and Tokens to Excel Tables (`tblEvents`, `tblTokens`) via `openpyxl.worksheet.table.Table`
- 1c. Small LAMBDA library (Excel 2021+/365): `WALK_TO_ROOT`, `DESCENDANTS_OF`, `WOW_CHANGE`, `COHORT_COUNT`
- 1d. "Stories" tab with 2–3 worked examples (week-over-week pivot, lane decay, cohort table)
- 1e. Reference tab polish (bold headings, preamble)
- 1f. Out of scope: VBA/.xlsm, new backend queries, curated-narrative changes
- 1g. Suggested sequencing 1→5

### 2. `docs/decisions/campaign-xlsx-export/2026-07-09_eoa-analysis-layer_feature-doc_lovable.md`

Captures the EoA plan just drafted:

- 2a. Why EoA context belongs in the export
- 2b. New EoA fetch step + `eoaById` map
- 2c. New "EoAs" tab with per-EoA aggregates (seed_count, instance_count, chain_share_count, view_count, broadcast_opens, chain_viewers, unique_zip/state/international counts, max_depth, first/last_event_at, completed_share_count)
- 2d. Enriched Events + Tokens tabs with `eoa_title`, `eoa_type`, `eoa_mobilize_code`, `eoa_site_name`, `eoa_city`, `eoa_state`
- 2e. Reference tab "Top EoAs by chain activity" section + expanded cross-check
- 2f. Composability note — Stories tab from plan #1 gains EoA as a native pivot dimension
- 2g. Risks / open questions (cardinality cap, simulator scoping, title collisions)
- 2h. Technical details for the implementer

### 3. Cross-link

Each doc gets a one-line "See also" pointing at the other, so a future revisit picks up both at once.

## What does not change

- No code changes to `src/lib/exportCampaignXlsx.ts` or anywhere else
- No changes to existing decision docs
- No new folder outside `docs/decisions/campaign-xlsx-export/`

## Confirmation

This is a **new** pair of plan documents, not an update to an existing one. Nothing in `docs/decisions/campaign-xlsx-export/` (or elsewhere) is being modified.
