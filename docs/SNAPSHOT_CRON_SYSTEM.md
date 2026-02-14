# Snapshot Cron System

Automatic refresh of server-rendered SVG snapshots for campaigns with live metrics.

## Problem

Data Template snapshots are static SVGs. Once rendered, they go stale as new scans, shares, and views accumulate. Without periodic re-rendering, embedded metrics fall behind.

## Solution

A `pg_cron` heartbeat (every 1 minute) triggers an orchestrator edge function that checks each enabled campaign's staleness and re-renders only when the configured interval has elapsed.

## Architecture

```text
pg_cron (every 1 min)
  └─ pg_net HTTP POST
       └─ refresh-all-snapshots (orchestrator)
            └─ for each enabled campaign with stale snapshots:
                 └─ render-stats-snapshot (per template + campaign)
                      ├─ builds SVG with live metrics
                      ├─ uploads to slide-snapshots bucket
                      └─ updates snapshot_rendered_at
```

## Campaign Settings

Two columns on the `campaigns` table control behavior:

| Column | Type | Description |
|--------|------|-------------|
| `snapshot_enabled` | `boolean` | Master toggle. When `false`, the campaign is skipped entirely. |
| `snapshot_interval_minutes` | `integer` | Minimum minutes between re-renders. The orchestrator compares `now()` against `snapshot_rendered_at` and skips if the snapshot is still fresh. |

## Edge Functions

### `refresh-all-snapshots` (orchestrator)

1. Queries all campaigns where `snapshot_enabled = true`.
2. For each campaign, resolves linked templates:
   - `events_actions` (by `campaign_id`) → gets `assigned_deck_slug`
   - `slide_items` (by `deck_slug` + non-null `template_id`) → gets template IDs
3. For each unique template, fetches `snapshot_rendered_at` from `viral_slide_configs`.
4. Compares age against `snapshot_interval_minutes`. If stale → calls `render-stats-snapshot`.
5. Returns JSON summary: `{ rendered: [...], skipped: [...], errors: [...] }`.

**JWT verification:** Disabled (`verify_jwt = false`). Called from `pg_net`, not a browser.

### `render-stats-snapshot` (renderer)

Accepts `{ template_id, campaign_code }` and:

1. Calculates live metrics from `tokens` and `url_events`.
2. Generates an SVG with the template's background image, hotspot-positioned metric values, and optional map tiles.
3. Uploads to storage bucket `slide-snapshots`.
4. Updates `viral_slide_configs.snapshot_rendered_at` and `cached_snapshot_path`.

### `deploy-template-snapshots` (manual trigger)

A separate function for on-demand rendering across all campaigns using a given template. Useful after template edits. Not involved in the cron pipeline.

## Metrics Available

The following metric keys are populated by `render-stats-snapshot`:

| Key | Description |
|-----|-------------|
| `seeds` | Count of L00 tokens (unique QR scans) |
| `shares` | Count of share events |
| `opens` | Count of view events |
| `l01_count` | Level 1 token count |
| `l02_count` | Level 2 token count |
| `l03_count` | Level 3+ token count |
| `neighborhoods` | Distinct zip codes from url_events |
| `viral_coefficient` | `(l01 + l02 + l03) / seeds` |
| `campaign_name` | Campaign title |
| `last_updated` | Timestamp of render |

## Storage

| Property | Value |
|----------|-------|
| Bucket | `slide-snapshots` (public) |
| Path pattern | `{template_id}/snapshot-{campaign_code}.svg` |
| Content type | `image/svg+xml` |
| Cache-control | `max-age=300` (5 minutes) |

## Cron Job Details

| Property | Value |
|----------|-------|
| Extension dependencies | `pg_cron`, `pg_net` |
| Schedule | `* * * * *` (every minute) |
| Job name | `refresh-all-snapshots` |

The 1-minute heartbeat is intentionally fast. The orchestrator itself enforces per-campaign intervals via `snapshot_interval_minutes`, so campaigns are never re-rendered more frequently than their configured minimum.

### Scheduling SQL

```sql
SELECT cron.schedule(
  'refresh-all-snapshots',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/refresh-all-snapshots',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Troubleshooting

### Check if cron job is registered

```sql
SELECT jobid, schedule, command, nodename
FROM cron.job
WHERE jobname = 'refresh-all-snapshots';
```

### View recent execution history

```sql
SELECT jobid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Check edge function logs

View logs for `refresh-all-snapshots` in the Lovable Cloud backend to see:
- Which campaigns were evaluated
- Which templates were rendered vs skipped
- Any errors from downstream `render-stats-snapshot` calls

### Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Snapshots never update | `snapshot_enabled` is `false` | Toggle on in Campaign Settings |
| Snapshots update too slowly | `snapshot_interval_minutes` is high | Lower the interval |
| Cron job not firing | Extensions not enabled | Ensure `pg_cron` and `pg_net` are active |
| Render errors in logs | Template misconfiguration | Check hotspot config in `viral_slide_configs` |
