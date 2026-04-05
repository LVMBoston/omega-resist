# L03 Cascade Column — Split L3 from L3+

**Status: Approved & Implemented**  
**Date: 2026-04-05**

## Summary

Updated the `get_campaign_stats` RPC and all UI consumers to explicitly show L3 as its own column in the viral depth display, making the full cascade L0 → L1 → L2 → L3 visible at a glance.

## Changes

### 1. Database — `get_campaign_stats` RPC
- Added `l3_count bigint` return column: `COUNT(*) FILTER (WHERE t.level = 3)`
- Changed `l3_plus_count` to: `COUNT(*) FILTER (WHERE t.level >= 4)` (L4+ overflow)
- Required `DROP FUNCTION` + recreate due to return type change

### 2. CampaignDetail.tsx
- Added `l3Count` to `CampaignStats` interface
- Label changed from "L0 / L1 / L2 / L3+" to "L0 / L1 / L2 / L3"
- Subtle `L4+: N` indicator shown only when non-zero

### 3. CampaignManager.tsx
- Same interface and display updates as CampaignDetail
- Stats mapping updated to include `l3_count` from RPC

### 4. campaignNarrative.ts
- L3 count now sums `l3_count + l3_plus_count` for narrative generation (preserves total depth reporting)

## What Does Not Change
- RPC still returns `l3_plus_count` for backward compatibility (now means L4+)
- No schema/table changes — only RPC function signature
- Chart components (`useChartData.ts`) already handle L03 separately
