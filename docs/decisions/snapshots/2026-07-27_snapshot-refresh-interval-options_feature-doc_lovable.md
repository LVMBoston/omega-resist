# Snapshot Refresh Interval Options

**Status: Approved & Implemented**
**Date: 2026-07-27**

## Change

The Server-Side Rendering "Refresh Interval" dropdown now offers:

| Value (minutes) | Label |
|---|---|
| 1 | 1 minute |
| 5 | 5 minutes |
| 60 | 1 hour |
| 720 | 12 hours |
| 1440 | 1 day |
| 10080 | 1 week |

Previously: 1 / 2 / 5 / 10 / 15 / 30 / 60.

## Why this is safe

The `pg_cron` heartbeat still runs every minute. `refresh-all-snapshots` compares the
snapshot file's storage age (minutes) against `campaigns.snapshot_interval_minutes`
and skips when fresh. Larger values simply mean "skip more often". The column is a
plain integer, so 720 / 1440 / 10080 store without issue.

## Legacy values

Campaigns saved with a value no longer in the list (2, 10, 15, 30) would render a
blank Radix Select trigger. Instead, the component prepends a single labelled entry
for the stored value, e.g. `2 minutes (legacy)`, formatted by a `formatMinutes`
helper (minutes / hours / days / weeks). Nothing is written to the database on load;
the legacy entry disappears once the user picks a listed option.

## Files changed

| File | Change |
|------|--------|
| `src/components/CampaignSnapshotSettings.tsx` | New `INTERVAL_OPTIONS`, `formatMinutes` helper, render-time legacy option |

## Not changed

- Cron schedule (`* * * * *`)
- `refresh-all-snapshots`, `render-stats-snapshot`, the storage-age staleness check
- Database default (`2`) and the `?? 2` fallback
- `SnapshotStatusBadge` — its thresholds scale off `intervalMinutes` automatically and
  `formatDistanceToNow` already reads well in hours/days

## Verification

Browser check on `/campaign-dashboard?campaign=nk3-invitation`:

- Trigger text: `2 minutes (legacy)` (not blank)
- Options listed: `['2 minutes (legacy)', '1 minute', '5 minutes', '1 hour', '12 hours', '1 day', '1 week']`

## Decision log note

This is a new plan, not an update to an existing one.
