# Campaign XLSX Export — Data-Shape-First Enhancements

Status: Proposed — Not Yet Implemented
Date: 2026-07-09
Scope: `src/lib/exportCampaignXlsx.ts`
See also: [EoA analysis layer](./2026-07-09_eoa-analysis-layer_feature-doc_lovable.md)

## Guiding principle

Invest in **data shape** first, interactivity later. A well-shaped workbook (rich derived columns + Excel Tables + a small formula library) lets a reviewer author "story variants" (week-over-week, cohort, lane decay, campaign-vs-campaign) with native Excel — no VBA required, no macro-friction, works in Excel for the web and on Mac.

VBA / `.xlsm` was explicitly deferred as a possible power-user layer added on top later, not the foundation.

## 1. Enrich derived columns

Computed in `exportCampaignXlsx.ts` from already-fetched data — no new backend queries.

- 1a. **Events tab** additions: `iso_week`, `days_since_campaign_start`, `days_since_parent_event`, `hour_of_day`, `day_of_week`
- 1b. **Tokens tab** additions: `descendant_count`, `subtree_depth`, `path_to_root`, `first_event_at`, `last_event_at`, `days_active`
  - (`root_token` already present via `token_lineage`)

## 2. Convert Events and Tokens to Excel Tables

- 2a. Use `openpyxl.worksheet.table.Table` to create `tblEvents` and `tblTokens`.
  - Note: the current export uses SheetJS (`xlsx`) client-side, not openpyxl. Either switch to a lib that emits real Excel Tables, or do the Table promotion via a server-side render step. Decide before build.
- 2b. Structured references (`tblTokens[token]`, `tblEvents[iso_week]`) disambiguate shared column names without manual named ranges.
- 2c. Requirement: no fully-blank header cells and no fully-blank rows inside the table range.

## 3. Small LAMBDA helper library (Excel 2021+ / 365)

Stored on a hidden "Lib" sheet via `Name Manager`; documented on the Reference tab.

- 3a. `WALK_TO_ROOT(token)` — returns the path from a token to its root.
- 3b. `DESCENDANTS_OF(token)` — returns all descendants (uses `tblTokens[parent_token]`).
- 3c. `WOW_CHANGE(metric_range, week)` — week-over-week delta helper.
- 3d. `COHORT_COUNT(cohort_week, event_week)` — cell for cohort pivots.
- 3e. Fallback: on older Excel, formulas return `#NAME?`; Reference tab notes the version requirement.

## 4. "Stories" tab — worked examples (templates, not final analyses)

Two or three seeded pivots the reviewer can duplicate and adapt:

- 4a. Week-over-week: `tblEvents[iso_week]` × `event_type`.
- 4b. Lane decay: `tblTokens[lane]` × week bucket.
- 4c. Cohort table: rows = first-scan week, columns = subsequent weeks.

The curated narrative on the Reference tab remains the "official" story; the Stories tab is a sandbox.

## 5. Reference tab polish

- 5a. Bold section headings.
- 5b. Preamble noting all four tabs (Reference, Events, Tokens, Stories) and the Excel 365 requirement for the Stories tab and LAMBDA library.

## 6. Out of scope

- 6a. VBA and `.xlsm` output (macro-friction, corporate blocks, no web Excel, Mac gaps, binary blob maintenance).
- 6b. New backend queries.
- 6c. Changes to the curated narrative or dashboard.

## 7. Suggested sequencing

1. Derived columns (Events + Tokens)
2. Excel Tables
3. Reference tab polish
4. LAMBDA library (needs a design pass — confirm the exact four helpers)
5. Stories tab (depends on 1–3 landing first)
