

# Fix Test EoA Auto-Flagging: Pattern Mismatch + Retroactive Patch

**Status**: Plan
**Date**: 2026-02-27

## Problem

The database triggers that auto-flag test data as simulated use `LIKE 'TEST-%'` (requiring a hyphen after TEST), but the actual `mobilize_code` in the database is `TEST` (no hyphen). Additionally, matching should be case-insensitive per the original intent. This means:

- 15 TEST tokens currently show `is_simulated = false`
- All associated url_events also show `is_simulated = false`
- These TEST events appear in "real" data views on the Campaign Dashboard

## Root Cause

```text
Trigger pattern:   mobilize_code LIKE 'TEST-%'   (requires hyphen)
Actual value:      mobilize_code = 'TEST'         (no hyphen)
```

## Fix (3 parts, single migration)

### 1. Update trigger function: broaden pattern + case-insensitive

Replace `LIKE 'TEST-%'` with `ILIKE 'test%'` in `mark_test_eoa_tokens()` so it matches `TEST`, `TEST-rally`, `test-foo`, etc.

### 2. Update events trigger for consistency

The `mark_test_token_events()` trigger is fine logically (it checks `tokens.is_simulated`), but only works if tokens are correctly flagged first. No change needed here.

### 3. Retroactive data patch

Run UPDATE statements to fix existing data:

- Set `is_simulated = true` on all tokens whose `eoa_id` points to a `mobilize_code ILIKE 'test%'`
- Set `is_simulated = true` on all url_events whose token is in that set

## Files Changed

| Area | Change |
|------|--------|
| Database migration | ALTER trigger function + UPDATE existing rows |
| Decision doc | Save to `docs/decisions/` |

## Technical Detail

### Migration SQL (single statement block)

```sql
-- 1. Fix the trigger function pattern
CREATE OR REPLACE FUNCTION mark_test_eoa_tokens()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.events_actions
    WHERE id = NEW.eoa_id
      AND mobilize_code ILIKE 'test%'
  ) THEN
    NEW.is_simulated := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 2. Patch existing tokens
UPDATE tokens SET is_simulated = true
WHERE eoa_id IN (
  SELECT id FROM events_actions WHERE mobilize_code ILIKE 'test%'
) AND is_simulated = false;

-- 3. Patch existing url_events
UPDATE url_events SET is_simulated = true
WHERE token IN (
  SELECT token FROM tokens
  WHERE eoa_id IN (
    SELECT id FROM events_actions WHERE mobilize_code ILIKE 'test%'
  )
) AND is_simulated = false;
```

### No UI changes needed

The Campaign Dashboard already filters by `is_simulated`. Once the data is patched, TEST events will correctly disappear from "real" views and appear under "simulated".

