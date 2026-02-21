# Test EoA via Mobilize Code Convention + Auto-Purge

## Concept

Instead of adding a new database column, identify test EoAs by a **naming convention** in the `mobilize_code` field: any EoA whose `mobilize_code` starts with `TEST-` is treated as a test EoA. Tokens minted for these EoAs are automatically flagged `is_simulated = true`, and a nightly cron job purges their data.

## How It Works

1. Create an EoA with `mobilize_code` starting with `TEST-` (e.g., `TEST-rally1`)
2. Database triggers automatically set `is_simulated = true` on all tokens and events for that EoA
3. The map and dashboard filter these out by default (existing `is_simulated = false` filters)
4. A scheduled job purges test tokens and events older than 24 hours
5. To see test data on the map/dashboard, use the existing "simulated" or "both" data source toggle

## Why mobilize_code Instead of a New Column

- No schema migration needed for a new `is_test` column
- `mobilize_code` already flows into token identity (`l00-{mobilize_code}-{utm_id}`) so it's naturally traceable
- The `TEST-` prefix is human-readable in every table and dashboard view
- Existing unique constraint `(campaign_id, mobilize_code, utm_id)` still works normally

## Spawn Coverage

All spawns (L01, L02, L03) are covered because:
- `mint_share()` inherits `eoa_id` from the parent token
- The `trg_mark_test_eoa_tokens` trigger fires on every token insert and checks the `eoa_id`
- The purge query filters by `eoa_id IN (SELECT id FROM events_actions WHERE mobilize_code LIKE 'TEST-%')`, catching the entire viral tree

## Implementation Steps

### Step 1 — Database Triggers (Migration)

Two BEFORE INSERT triggers that detect the `TEST-` prefix and auto-flag data as simulated:

```sql
-- Trigger 1: Flag tokens for test EoAs
CREATE OR REPLACE FUNCTION mark_test_eoa_tokens()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM events_actions
    WHERE id = NEW.eoa_id
      AND mobilize_code LIKE 'TEST-%'
  ) THEN
    NEW.is_simulated := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_mark_test_eoa_tokens
  BEFORE INSERT ON tokens
  FOR EACH ROW
  EXECUTE FUNCTION mark_test_eoa_tokens();

-- Trigger 2: Flag events whose token is simulated
CREATE OR REPLACE FUNCTION mark_test_token_events()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tokens
    WHERE token = NEW.token AND is_simulated = true
  ) THEN
    NEW.is_simulated := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_mark_test_token_events
  BEFORE INSERT ON url_events
  FOR EACH ROW
  EXECUTE FUNCTION mark_test_token_events();
```

### Step 2 — Scheduled Purge (pg_cron via SQL insert)

A `pg_cron` job that runs nightly and deletes all test data (tokens + events) older than 24 hours:

```sql
SELECT cron.schedule(
  'purge-test-eoa-data',
  '0 4 * * *',
  $$
    DELETE FROM url_events
    WHERE is_simulated = true
      AND occurred_at < now() - interval '24 hours'
      AND token IN (
        SELECT token FROM tokens
        WHERE eoa_id IN (
          SELECT id FROM events_actions
          WHERE mobilize_code LIKE 'TEST-%'
        )
      );

    DELETE FROM tokens
    WHERE is_simulated = true
      AND minted_at < now() - interval '24 hours'
      AND eoa_id IN (
        SELECT id FROM events_actions
        WHERE mobilize_code LIKE 'TEST-%'
      );
  $$
);
```

### Step 3 — UI: Visual Badge in EoA Manager

Update `CampaignEoaManager.tsx` mobilize_code column to show a "TEST" badge next to any EoA whose `mobilize_code` starts with `TEST-`.

### Step 4 — Pass dataSource Filter to SamizdatMap

Update `SamizdatMap.tsx` to accept a `dataSource` prop (`"real"` | `"simulated"` | `"both"`) and replace the hardcoded `.eq("is_simulated", false)` calls with conditional filtering. Wire the existing dashboard `dataSource` state into this prop.

### Step 5 — Hint Text in EoaForm

Add a helper note under the Event Code field explaining the `TEST-` prefix convention.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Two triggers (functions + triggers) |
| `supabase--insert` | pg_cron purge job schedule |
| `src/pages/CampaignEoaManager.tsx` | "TEST" badge on rows with `TEST-` mobilize_code |
| `src/components/SamizdatMap.tsx` | Accept `dataSource` prop, conditional `is_simulated` filtering |
| `src/pages/CampaignDashboard.tsx` | Pass `dataSource` to SamizdatMap |
| `src/components/EoaForm.tsx` | Add hint text about `TEST-` prefix |
