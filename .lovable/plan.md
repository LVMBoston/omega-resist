
# ✅ COMPLETED: Scope `mobilize_code + utm_id` Uniqueness to Campaign

**Completed**: 2026-02-20

## What Changed

Dropped the global unique constraint and replaced it with a campaign-scoped partial unique index:

```sql
ALTER TABLE events_actions
  DROP CONSTRAINT events_actions_mobilize_code_utm_id_key;

CREATE UNIQUE INDEX idx_unique_mobilize_utm_per_campaign
  ON events_actions (campaign_id, mobilize_code, utm_id)
  WHERE mobilize_code IS NOT NULL;
```

Reverted the clone logic in `CampaignManager.tsx` to copy `utm_id` as-is (removed the suffix generation).

## Known Risk

**`mint_l00` token collision**: If two campaigns share the same `mobilize_code` + `utm_id`, they mint identical L00 token strings (`l00-{mobilize_code}-{utm_id_first_10}`). The second mint destroys the first campaign's token. Mitigated by operational practice (cloned campaigns get distinct codes, not deployed simultaneously). Will be fully addressed by Data Integrity Hardening Phase 1.
