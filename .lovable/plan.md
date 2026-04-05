

## Plan: Split L3 from L3+ to Show Full Cascade

### Goal
Replace the current "L3+" aggregate with an explicit L3 column, clearly showing the viral cascade L0 → L1 → L2 → L3 across all campaign stats displays.

### Changes

**1. Database migration — update `get_campaign_stats` RPC**
   a. Add `l3_count bigint` as a new return column: `COUNT(*) FILTER (WHERE t.level = 3)`
   b. Change `l3_plus_count` to `COUNT(*) FILTER (WHERE t.level >= 4)` (captures any tokens beyond L3)
   c. Return signature becomes: `..., l2_count, l3_count, l3_plus_count`

**2. Update `src/pages/CampaignDetail.tsx`**
   a. Add `l3Count: number` to the `CampaignStats` interface
   b. Map `row.l3_count` in the stats query
   c. Change label from "Viral Depth: L0 / L1 / L2 / L3+" to "Viral Depth: L0 / L1 / L2 / L3"
   d. Display `stats.l3Count` in place of `stats.l3PlusCount`
   e. If `l3PlusCount > 0`, append a subtle `L4+: N` indicator

**3. Update `src/pages/CampaignManager.tsx`**
   a. Add `l3Count: number` to the `CampaignStats` interface
   b. Map `l3_count` from the RPC response in `calculateCampaignStats`
   c. Change the "Viral Depth" label and values to show `L0 / L1 / L2 / L3`
   d. Same `L4+` overflow indicator if non-zero

**4. Update `src/lib/campaignNarrative.ts`** (if it uses `l3_plus_count`)
   a. Adjust to use the new `l3_count` field for narrative generation

**5. Decision doc**
   a. New file: `docs/decisions/chart-colors/2026-04-05_l03-cascade-column_feature-doc_lovable.md`

### What Does Not Change
- The RPC still returns `l3_plus_count` for backward compatibility (now meaning L4+)
- No schema/table changes — only the RPC function signature
- Chart components (`useChartData.ts`) already handle L03 separately

### Technical Detail
The `types.ts` file will auto-regenerate after the migration to include the new `l3_count` return field.

