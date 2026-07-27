## Goal

On `/campaign-config`, show at a glance which campaigns have Server-Side Rendering turned on, and how often those snapshots refresh.

## 1. Where the data comes from

a. `CampaignManager.tsx` already loads campaigns with `.from("campaigns").select("*")`, so `snapshot_enabled` and `snapshot_interval_minutes` are **already in the fetched rows** — no extra query, no extra round trip.

b. The local `Campaign` interface (line 27) currently lists only `id`, `code`, `title`, `description`, `created_at`. Add `snapshot_enabled: boolean | null` and `snapshot_interval_minutes: number | null` so the fields are typed.

## 2. The indicator

a. In the campaign card header (`SortableCard`, next to the title / `utm_campaign` line), render a small badge **only when `snapshot_enabled` is true**:

```text
[⟳ SSR · 1 day]
```

b. Contents: a refresh icon, the label `SSR`, and the interval formatted as a readable duration (1 minute / 5 minutes / 1 hour / 12 hours / 1 day / 1 week, and any legacy value rendered honestly, e.g. `2 minutes`).

c. Campaigns with SSR off show **no badge at all** — absence is the signal, keeping the grid uncluttered. (Alternative if you'd prefer explicit: a muted "SSR off" badge on every card. Say the word and I'll do that instead.)

d. Styling uses existing semantic tokens (`Badge` with `variant="secondary"` plus muted foreground), consistent with the amber badge already used elsewhere on this page.

e. A `title` tooltip on the badge reads: "Server-side rendering enabled — snapshots refresh every {interval}."

## 3. Shared duration formatter

a. The `formatMinutes` helper written last turn currently lives inside `src/components/CampaignSnapshotSettings.tsx`. Move it to `src/lib/dateUtils.ts` (exported) and import it in both places, so the config page and the settings panel can never disagree about how "10080" is spelled.

b. No behaviour change to the settings panel — same function, new home.

## 4. Files touched

| File | Change |
|------|--------|
| `src/lib/dateUtils.ts` | Export shared `formatMinutes` helper |
| `src/components/CampaignSnapshotSettings.tsx` | Import the helper instead of defining it locally |
| `src/pages/CampaignManager.tsx` | Extend `Campaign` interface; render the SSR badge in `SortableCard` |

## 5. Not changed

- No new database queries, columns, or migrations.
- No change to the cron pipeline, `refresh-all-snapshots`, or `render-stats-snapshot`.
- Toggling SSR stays where it is today (the campaign dashboard's Server-Side Rendering panel). This badge is read-only.

## 6. Verification

a. Browser check on `/campaign-config`: screenshot the campaign grid showing the badge present on SSR-enabled campaigns and absent on the rest.
b. Cross-check the badge's interval text against the value shown in the campaign's Server-Side Rendering panel for at least one campaign.

## 7. Decision log

This is a new plan. On completion it will be appended as an `## Update — 2026-07-27` section to `docs/decisions/snapshots/2026-07-27_snapshot-refresh-interval-options_feature-doc_lovable.md`, since it extends that same refresh-interval work.
