# Fix Campaign Story Metrics: 3 Bugs

**Status**: Approved & Implemented  
**Date**: 2026-02-27

## Problem

The Campaign Story narrative (`src/lib/campaignNarrative.ts`) had three metrics defects:

1. **Seeds inflated** — `get_campaign_stats` DB function included simulated tokens (`is_simulated = true`) in level counts. ICE Takedown showed 86 seeds instead of 72.
2. **Sprouts stuck at 1** — The sprout query used `head: true` (count-only mode) and didn't select `token` or `parent_token` fields. The computation also read from `speedRes.data` instead of `sproutsRes.data`.
3. **Views global** — The view count query had no `utm_campaign` filter, returning 651 (all views across all campaigns) instead of 88 (campaign-scoped).

## Fixes

### 1. DB: `get_campaign_stats` — add `is_simulated = false`

Added `AND t.is_simulated = false` to the `token_stats` CTE so level counts exclude simulated tokens. This affects all consumers of the RPC, not just the narrative.

### 2. Code: Sprout query — select actual fields, use correct result set

- Changed sprout query from `select("parent_token", { count: "exact", head: true })` to `select("token, parent_token")` with `utm_campaign` filter
- Changed computation to use `sproutsRes.data` (the actual sprout query result) instead of `speedRes.data`
- Removed the fallback `|| t.token` approximation

### 3. Code: Views query — scope to campaign

- Added `tokens!inner(utm_campaign)` join and `.eq("tokens.utm_campaign", campaignCode)` filter

## Verified Values (ICE Takedown)

| Metric | Before | After | Source |
|--------|--------|-------|--------|
| Seeds (L0) | 86 | 72 | `get_campaign_stats` RPC |
| Sprouts | 1 | 11 | `COUNT(DISTINCT parent_token) WHERE level > 0` |
| Views | 651 | 88 | `url_events JOIN tokens WHERE utm_campaign = 'ice-takedown'` |

## Files Changed

| File | Change |
|------|--------|
| DB migration | `get_campaign_stats`: added `is_simulated = false` filter |
| `src/lib/campaignNarrative.ts` | Fixed sprout query select + data source; added campaign scope to views |
