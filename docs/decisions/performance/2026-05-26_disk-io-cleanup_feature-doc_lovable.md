# Disk IO cleanup — cron history + snapshot heartbeat

Status: Approved & Implemented
Date: 2026-05-26

## Context

Lovable Cloud surfaced an "Instance upgrade recommended" warning with **disk IO at 81%**. Investigation showed app data was tiny (<15 MB total across tokens, url_events, zip_codes) but two infrastructure tables were dominating disk:

- `cron.job_run_details` — 228 MB, ~145,000 rows since 2026-02-14, never pruned
- `net._http_response` — 110 MB on disk for only ~360 live rows (bloat from deleted rows)

Root driver: the `refresh-all-snapshots` cron fired every minute, generating 1,440 history rows/day plus one `pg_net` HTTP request/response per tick.

## Changes implemented

1. **One-time cleanup**
   a. Deleted `cron.job_run_details` rows older than 7 days (145k → 10k rows)
   b. Deleted `net._http_response` rows older than 24 hours (already within window)
   c. `VACUUM FULL` could not run via migration tool (transaction-block restriction); autovacuum will reclaim space over time. Manual `VACUUM FULL` can be run from the Cloud SQL editor for immediate disk reclamation if needed.

2. **Nightly purge jobs** (added to `cron.job`)
   a. `purge-cron-history` — `0 3 * * *` — deletes `cron.job_run_details` >7 days
   b. `purge-http-responses` — `15 3 * * *` — deletes `net._http_response` >24h

3. **Snapshot heartbeat slowed** from `* * * * *` to `*/5 * * * *`. The `refresh-all-snapshots` orchestrator still enforces per-campaign `snapshot_interval_minutes` internally, so no campaign with an interval ≥5 min sees any behavior change — just 5× less cron history and pg_net traffic.

4. **Index added**
   a. `idx_url_events_token_event_type` on `public.url_events (token, event_type)` — speeds per-campaign metric counts used inside `render-stats-snapshot`.

## Items considered and not implemented

- Moving the staleness check earlier inside `refresh-all-snapshots`: re-reading the function showed it already short-circuits on storage file age before doing any token/event queries. The orchestrator is already lean — the only token/url_events reads happen inside `render-stats-snapshot`, which only runs when a snapshot is actually stale. No edit needed.

## Files touched

- Migration: `CREATE INDEX idx_url_events_token_event_type`
- Data ops: cron job schedule + nightly purge jobs (via `cron.alter_job` / `cron.schedule`)
- This decision doc

## Expected outcome

Disk IO budget should drop from 81% toward 20–30% over the next 24 hours as autovacuum reclaims the freed pages. Ongoing growth of cron/pg_net logs is now bounded by the nightly purges.
