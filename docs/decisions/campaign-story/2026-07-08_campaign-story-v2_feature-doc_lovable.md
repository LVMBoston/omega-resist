# Campaign Story v2 — depth semantics, two-lane metrics, consolidated export

Status: Approved & Implemented
Date: 2026-07-08

## 1. What changed

a. **Depth-corrected `token_lineage` view.** Recursive CTE walks
`parent_token` from the roots. Per-scan L00 instance edges
(child token matches `^l00-.+:.+$`) contribute `0` to `true_depth`;
every other edge contributes `1`. Provenance is keyed on immutable
token shape written by the mint functions — never on `stored_level`
or `minted_via`, both of which can drift.

b. **Two-lane metric layer** (`computeCampaignStoryInputs`).
   - Lane A — **Broadcast opens** = tokens where `true_depth = 0`
     (base L00 templates + per-scan L00 instances). Inflated by
     design; labeled "opens", never "viewers".
   - Lane B — **Approximate unique viewers** = tokens where
     `true_depth ≥ 1`, orphans excluded.
   - Orphans (`parent_token IS NULL` AND not L00-shaped) are excluded
     from both lanes and surfaced separately as **Data anomalies**.
   - `perHopConversion` reports d→d+1 rates starting at **1→2**
     (0→1 is broadcast conversion, reported in the lanes above).
   - `anyHopCompletionRate` = chain tokens that produced any child
     divided by chain tokens (labeled as a blend).

c. **Consolidated XLSX export** (`exportCampaignXlsx`). One workbook,
three tabs — Reference (metric summary + anomalies), Events, Tokens.
Reference tab shows all metrics including zeros (evidence); the
narrative renderer continues to omit empty blocks. The dashboard
now surfaces a single "Export XLSX" button.

## 2. Coupling / naming invariant

Correctness depends on the token-shape invariant across these four
functions. If any changes the shape, update the CTE and this doc:

- `generate_token` — bare 8-hex ids.
- `mint_share` — preserves the parent's shape category.
- `instantiate_l00_token` / `maybe_reinstantiate_l00` — emit
  `<base>:<6-hex>` (this is the per-scan L00 instance shape).

## 3. Out of scope

Not touched in this change: `mint_l00`, `mint_share`,
`instantiate_l00_token`, `maybe_reinstantiate_l00`, the anon grant on
`get_campaign_map_events`, any RLS, and orphan resolution in
`fal-nkd` / `res-sis` / `res-sis-live` (flagged, not fixed).

## 4. Verification

- Migration applied; depth histogram confirmed 176 tokens moved from
  stored_level=1 to true_depth=0 (per-scan L00 instances).
- Existing sprout-count regression test still passes.
- New guardrail test `two-lane metrics` asserts: orphans excluded
  from both lanes; `perHopConversion` has no `0→1` entry and reports
  `1→2` correctly.
- Export path uses batched `range()` pagination (`fetchAll`) so
  campaigns larger than 1000 tokens/events export completely.
