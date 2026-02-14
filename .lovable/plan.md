

# Add Documentation for `refresh-all-snapshots` Cron System

## Overview
Create a new doc at `docs/SNAPSHOT_CRON_SYSTEM.md` describing the automatic snapshot refresh architecture, covering both the new `refresh-all-snapshots` orchestrator and the existing `render-stats-snapshot` function it depends on.

## Document Contents

### 1. Purpose
Explain the problem (static SVG snapshots go stale) and the solution (a pg_cron heartbeat that triggers periodic re-renders for enabled campaigns).

### 2. Architecture Diagram (text)
```text
pg_cron (every 1 min)
  --> pg_net HTTP POST
    --> refresh-all-snapshots (orchestrator)
      --> for each enabled campaign with stale snapshots:
        --> render-stats-snapshot (per template+campaign)
          --> builds SVG with live metrics
          --> uploads to slide-snapshots bucket
          --> updates snapshot_rendered_at
```

### 3. Campaign Settings
Document the two database columns that control behavior:
- `campaigns.snapshot_enabled` (boolean) -- master toggle
- `campaigns.snapshot_interval_minutes` (integer) -- minimum minutes between re-renders

### 4. Edge Functions
- **`refresh-all-snapshots`** -- orchestrator: queries enabled campaigns, resolves linked templates via `events_actions` + `slide_items`, checks staleness, calls `render-stats-snapshot` for each stale pair
- **`render-stats-snapshot`** -- renderer: accepts `{ template_id, campaign_code }`, calculates live metrics, generates SVG with embedded background image and map tiles, uploads to storage, updates `viral_slide_configs`

### 5. Metrics Available
List all metric keys populated by `render-stats-snapshot`: `seeds`, `shares`, `opens`, `l01_count`, `l02_count`, `l03_count`, `neighborhoods`, `viral_coefficient`, `campaign_name`, `last_updated`, etc.

### 6. Storage
- Bucket: `slide-snapshots` (public)
- Path pattern: `{template_id}/snapshot-{campaign_code}.svg`
- Cache-control: 300s

### 7. Cron Job Details
- Extension dependencies: `pg_cron`, `pg_net`
- Schedule: `* * * * *` (every minute)
- The orchestrator skips campaigns whose snapshots are still fresh
- JWT verification disabled (called from pg_net, not browser)

### 8. Troubleshooting
- How to check if cron is running (`SELECT * FROM cron.job`)
- How to view job history (`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20`)
- Edge function logs for debugging render failures

---

## Technical Details

**New file:** `docs/SNAPSHOT_CRON_SYSTEM.md`

No code changes -- documentation only.

