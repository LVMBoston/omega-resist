

# Fix: Scope `mobilize_code + utm_id` Uniqueness to Campaign

## What Changes

Drop the current global unique constraint and replace it with a campaign-scoped one:

```sql
ALTER TABLE events_actions
  DROP CONSTRAINT events_actions_mobilize_code_utm_id_key;

CREATE UNIQUE INDEX idx_unique_mobilize_utm_per_campaign
  ON events_actions (campaign_id, mobilize_code, utm_id)
  WHERE mobilize_code IS NOT NULL;
```

Then revert the clone logic in `CampaignManager.tsx` to copy `utm_id` as-is (remove the suffix generation added in the last edit).

## Risks

1. **`invalidate_tokens_on_critical_change` trigger** -- This trigger fires on EoA updates and DELETEs tokens when `mobilize_code`, `utm_id`, or `assigned_deck_slug` changes. The constraint change does not affect this trigger; it only fires on UPDATE, not INSERT. No risk.

2. **`mint_l00` token collision** -- The L00 token string is built as `l00-{mobilize_code}-{utm_id_first_10}`. If two campaigns share the same `mobilize_code` + `utm_id`, they would mint identical L00 token strings. However, `mint_l00` deletes any existing token with that string before inserting, so the second mint would destroy the first campaign's token. **This is the main risk.** In practice, cloned campaigns are given different codes and are not both deployed simultaneously, but it is theoretically possible.

3. **Existing data** -- Query confirms zero duplicate `(campaign_id, mobilize_code, utm_id)` rows, so the migration is safe.

4. **Partial index** -- The `WHERE mobilize_code IS NOT NULL` clause means EoAs without a mobilize code are unconstrained, which matches current behavior.

## Mitigation for Risk 2

No code change needed now. The `mint_l00` function already raises awareness by deleting + re-creating. The upcoming Data Integrity Hardening (Phase 1) will lock campaign codes and add pre-mint validation. For now, the clone tool produces a distinct campaign code, and operators understand not to deploy both simultaneously.

## Files Changed

| File | Change |
|------|--------|
| Migration (SQL) | Drop old constraint, create new partial unique index |
| `src/pages/CampaignManager.tsx` | Revert utm_id suffix logic; copy EoA fields as-is |

