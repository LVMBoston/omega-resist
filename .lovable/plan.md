## Goal

Change the Server-Side Rendering "Refresh Interval" choices to: 1 minute, 5 minutes, 1 hour, 12 hours, 1 day, 1 week — and show a clearly-labelled "(legacy)" entry for any campaign whose saved value isn't in the new list.

This is safe. The cron heartbeat runs every minute regardless; `refresh-all-snapshots` only compares the snapshot file's age against `snapshot_interval_minutes`. Larger values simply mean "skip more often". The column is a plain integer, so 720 / 1440 / 10080 store fine.

## 1. Interval options

a. In `src/components/CampaignSnapshotSettings.tsx`, replace `INTERVAL_OPTIONS` (currently 1 / 2 / 5 / 10 / 15 / 30 / 60) with:

```text
1      1 minute
5      5 minutes
60     1 hour
720    12 hours
1440   1 day
10080  1 week
```

## 2. Legacy entry (chosen approach)

a. Compute the options list at render time: if the campaign's stored `snapshot_interval_minutes` is not one of the six values above, prepend a single extra option for that value.

b. Label it with a human-readable duration plus a marker — e.g. `2 minutes (legacy)`, `30 minutes (legacy)`, `10 minutes (legacy)`. A small helper formats any minute count into minutes / hours / days / weeks so the label is always readable.

c. Nothing is written to the database on load. The stored value stays untouched until the user actively picks a new option; once they do, the legacy entry disappears on the next render.

d. Result: the dropdown trigger never renders blank, and the user can see exactly what their campaign is currently set to.

## 3. Status badge

a. `SnapshotStatusBadge` uses `intervalMinutes` only for the fresh / stale / very-stale colour thresholds, and prints relative time via `formatDistanceToNow`, which already reads well in hours, days, and months. No change needed to the text.

b. The thresholds scale automatically: with a 1-week interval, "fresh" means under 7 days, "stale" under ~17 days. That is the intended meaning, so this stays as is.

## 4. Not changed

- The cron schedule (`* * * * *`) — it is just a heartbeat.
- `refresh-all-snapshots`, the storage-age staleness check, `render-stats-snapshot`.
- The database default (`2`) and the `?? 2` fallback in the component. A campaign still on the default will now display as `2 minutes (legacy)`, which is accurate and self-explanatory.

## 5. Verification

a. Open `/campaign-dashboard` for nk3-invitation, screenshot the dropdown open showing the six new options.
b. Confirm a campaign with a legacy value (e.g. 2) shows `2 minutes (legacy)` in the trigger rather than a blank.
c. Select "1 day", reload, confirm the trigger reads "1 day" and the legacy entry is gone.

## 6. Decision log

This is a new plan (not an update to an existing one). On completion it will be archived at `docs/decisions/snapshots/2026-07-27_snapshot-refresh-interval-options_feature-doc_lovable.md`.
