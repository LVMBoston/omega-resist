# Fix Test EoA Auto-Flagging: Pattern Mismatch + Retroactive Patch

**Status**: Approved & Implemented  
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

## No UI changes needed

The Campaign Dashboard already filters by `is_simulated`. Once the data is patched, TEST events will correctly disappear from "real" views and appear under "simulated".
