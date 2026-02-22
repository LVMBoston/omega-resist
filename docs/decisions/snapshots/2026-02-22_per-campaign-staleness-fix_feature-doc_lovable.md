# Fix: Per-Campaign Snapshot Staleness Check

**Status: Approved & Implemented**  
**Date: 2026-02-22**

## Problem

The `refresh-all-snapshots` orchestrator checked snapshot freshness using `viral_slide_configs.snapshot_rendered_at`, which is a **template-level** timestamp. When multiple campaigns share the same template, rendering for campaign A updated the timestamp, causing campaign B to be skipped as "fresh" — even though campaign B's snapshot file never existed.

This caused 404 errors on iPhone (e.g., `ice-takedown` campaign) because the snapshot SVG was never generated.

## Root Cause

`render-stats-snapshot` updates `viral_slide_configs.snapshot_rendered_at` after each render. Since this column is per-template (not per-campaign), the orchestrator's staleness check (`ageMinutes < intervalMinutes`) incorrectly treated all campaigns as fresh once any single campaign was rendered.

## Fix

Changed the orchestrator to check staleness per **(template, campaign)** pair by querying the actual storage file's `updated_at` metadata via `supabase.storage.from('slide-snapshots').list()`, instead of relying on the shared `snapshot_rendered_at` column.

### Before
```typescript
// Checked template-level timestamp (shared across all campaigns)
const { data: templates } = await supabase
  .from("viral_slide_configs")
  .select("id, snapshot_rendered_at")
  .in("id", templateIds);
```

### After
```typescript
// Check actual storage file age per (template, campaign)
const { data: files } = await supabase.storage
  .from("slide-snapshots")
  .list(templateId, { search: `snapshot-${campaign.code}.svg` });
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/refresh-all-snapshots/index.ts` | Replaced template-level staleness check with per-file storage metadata check |

## Verification

Triggered orchestrator manually. `ice-takedown` template `42485454` was rendered (previously always skipped). Other templates with recent files were correctly skipped.
