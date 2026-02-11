

# Fix Campaign Resolution and Snapshot Reliability

## Problems Being Fixed

1. **Duplicate campaign resolution logic** -- Two independent `useEffect` hooks race against each other, potentially resolving to different campaigns
2. **Non-deterministic fallback query** -- `limit(1)` without `ORDER BY` when resolving campaign from deck slug
3. **Inconsistent snapshot loading across iOS devices** -- `<img onLoad/onError>` behaves differently on iPad vs iPhone, causing one to show stale snapshots and the other to fall back to dynamic rendering
4. **Dead debug overlay** -- CSS `position: fixed` is trapped by carousel transforms and never displays

## Changes (all in `src/components/StatsPageSlide.tsx`)

### 1. Merge duplicate campaign resolution into one effect

Remove the second `useEffect` (lines ~243-285) that independently resolves campaign code. Consolidate into the existing effect (lines ~96-144) so that campaign resolution, `setCampaignCode`, `resolveMetrics`, and `setCampaignResolved` all happen in a single sequential flow with no race condition.

### 2. Add deterministic ordering to fallback query

Change the `events_actions` fallback from `.limit(1)` to `.order("created_at", { ascending: false }).limit(1)`. This ensures every device resolves to the same campaign for a given deck, even when multiple EOAs share the deck.

### 3. Replace img onLoad/onError with fetch-based pre-check

Add a new `validatedSnapshotUrl` state. When a `campaignSnapshotUrl` is computed on mobile, run `fetch(url, { mode: 'cors' })` first:
- HTTP 200: set `validatedSnapshotUrl` and render the snapshot image
- Any failure: set `snapshotLoadFailed = true` and fall back to dynamic rendering immediately

This eliminates device-specific differences in how iOS Safari handles cross-origin image loading.

### 4. Remove dead debug overlay

Delete the `snapshotStatus` state variable and all debug overlay markup from both snapshot and dynamic render paths.

## What stays the same

- Snapshot file naming (`snapshot-{campaignCode}.png`)
- The `viralToken` resolution path (already deterministic via `utm_campaign` column)
- The server-side `render-stats-snapshot` edge function
- The snapshot storage and caching infrastructure

