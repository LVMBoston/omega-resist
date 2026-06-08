# Snapshot Map — Proportional Markers & Activity Counts

Status: Approved & Implemented
Date: 2026-06-08

## 1. Problem

The server-side snapshot map (`render-stats-snapshot`) drew every view as the same 5px dot. Because snapshots are static images (no zoom, no clustering), a ZIP centroid with 1 view looked identical to one with 50. Volume was invisible.

## 2. Decision

Adopt **proportional-symbol mapping** for the SSR map, plus inline count labels:

a. Aggregate `url_events` by rounded coordinate (~1km grid, 2-decimal lat/lng) so events sharing a ZIP centroid merge.
b. Radius scales as `BASE_R + K * sqrt(count - 1)`, capped at `MAX_R`. Single events render at base size, large clusters grow visibly but never dominate.
c. Multi-event circles use a 2px stroke ring + slight fill translucency so overlapping clusters remain readable.
d. The dominant `utm_medium` per cluster picks the fill color from `MEDIUM_COLORS_HEX`. Green stroke still indicates any token in the cluster has spawned children.
e. Clusters with `count >= 2` and radius `>= 8px` get a small white-boxed count label centered on the circle.

## 3. Tradeoffs

a. Aggregation key is a fixed ~1km grid rather than true ZIP boundaries. Acceptable: ZIP centroids collide at the same lat/lng so the grouping is exact for centroid data, and minor jitter still merges sensibly.
b. Count label uses imagescript's `drawText` if present; if unavailable the white box still acts as a visual emphasis chip.
c. Dominant-medium coloring loses minority-medium signal within a cluster. Acceptable for a static overview; per-event detail lives in the live dashboard.

## 4. Honoring constraints

a. No ranking/leaderboard language — labels are bare counts.
b. ZIP centroids only; no polygons.
c. Still uses CartoDB tiles, no Mapbox.

## 5. Files touched

- `supabase/functions/render-stats-snapshot/index.ts` — `renderStaticMap()` marker section rewritten.
