## What's eating your disk

Two things dominate your storage and IO budget — and neither is your app's "real" data:

1. **`cron.job_run_details` = 228 MB.** Your `refresh-all-snapshots` cron fires every minute (1,440 rows/day), and you have ~145,000 rows going back to **Feb 14**. Postgres has never been told to clean them up.
2. **`net._http_response` = 110 MB on disk** for only ~360 live rows. That's table **bloat** — rows got deleted but the disk space was never reclaimed.

For context, your actual app tables (`tokens`, `url_events`, `zip_codes`, etc.) total well under 15 MB combined. The cron infrastructure is **>95% of your disk pressure**.

A third, smaller contributor: every-minute heartbeat means constant writes to `viral_slide_configs.snapshot_rendered_at` (354k updates on 37 rows) and constant scans on `tokens`/`url_events` to compute metrics, even when nothing changed.

---

## Plan

### 1. One-time cleanup (biggest, fastest win — frees ~330 MB)

a. Truncate `cron.job_run_details` (keep only the last 7 days for debugging).
b. `VACUUM FULL net._http_response` to reclaim the 110 MB of bloat.
c. `VACUUM FULL cron.job_run_details` after truncation.

Expected result: disk IO budget drops from 81% to roughly 20–30%.

### 2. Stop the bleeding (prevent it from coming back)

a. Add a nightly cron job that deletes `cron.job_run_details` older than 7 days.
b. Add a nightly cron job that deletes `net._http_response` older than 24 hours (responses aren't useful after that).

### 3. Slow the snapshot heartbeat (optional, reduces ongoing write load)

a. Change `refresh-all-snapshots` schedule from `* * * * *` (every minute) to `*/5 * * * *` (every 5 minutes). The orchestrator already enforces per-campaign `snapshot_interval_minutes` internally, so a slower heartbeat doesn't change refresh behavior for any campaign whose interval is ≥5 min — it just cuts cron history growth and pg_net traffic by 5×.
b. If you want even less load and your fastest campaign uses the default 60-min interval, go to `*/10`.

### 4. Reduce repeated full-table reads inside the orchestrator (smaller, ongoing win)

The `refresh-all-snapshots` edge function re-queries `tokens` and `url_events` for every enabled campaign on every tick. On your current data sizes that's cheap, but with the every-minute schedule it adds up (1.68B tuples read from `tokens`, 627M from `url_events` lifetime). Two easy changes:

a. Inside `refresh-all-snapshots`, **skip campaigns whose `snapshot_rendered_at` is still fresh** *before* doing any token/event queries — currently the staleness check happens after some work.
b. Add a composite index on `url_events (token, event_type)` if not already present — speeds the per-campaign metric counts.

### 5. What this won't fix

- Disk **size** (storage) and disk **IO budget** are separate quotas in Lovable Cloud. This plan targets IO + size together, but if you later see "out of compute / memory" warnings, that's a different instance-upgrade conversation.
- If campaign volume grows 10× (lots of new tokens/url_events), you'll eventually want pagination and an archive strategy for old `url_events`. Not urgent today.

---

## Technical details (for reference)

Migrations involved:
- `TRUNCATE` + `VACUUM FULL` on the two bloated tables (one-time, run inside a migration so it's auditable).
- `SELECT cron.schedule('purge-cron-history', '0 3 * * *', $$ DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days' $$);`
- `SELECT cron.schedule('purge-http-responses', '15 3 * * *', $$ DELETE FROM net._http_response WHERE created < now() - interval '24 hours' $$);`
- `SELECT cron.alter_job(jobid, schedule := '*/5 * * * *') FROM cron.job WHERE jobname = 'refresh-all-snapshots';`
- `CREATE INDEX IF NOT EXISTS idx_url_events_token_event_type ON public.url_events (token, event_type);`

Edge function edit:
- `supabase/functions/refresh-all-snapshots/index.ts` — move the `snapshot_rendered_at` staleness check to before per-campaign metric queries.

Decision log:
- New plan. Will be archived to `docs/decisions/performance/2026-05-26_disk-io-cleanup_feature-doc_lovable.md` after approval and implementation.

---

## What I need from you

Approve and I'll execute in order: 1 (cleanup) → 2 (purge jobs) → 3 (slower heartbeat) → 4 (orchestrator + index). If you want to skip step 3 (keep minute-level snapshots), say so and I'll leave the schedule alone.