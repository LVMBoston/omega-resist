# Regression Test Suite

Living index of automated regression tests, organized by the bug or feature each test guards against. Add a row whenever you ship a fix worth protecting.

## How to run

| Runner | Scope | Command |
|---|---|---|
| Vitest | Frontend (`src/**/*.test.{ts,tsx}`) | `npm test` |
| Deno | Edge functions (`supabase/functions/**/*.test.ts`) | Use the `supabase--test_edge_functions` tool, or `deno test --allow-net --allow-env supabase/functions/<name>/` |

Tests are co-located with the code they cover (per `CONTRIBUTING-v0.md` §1).

## Naming convention

- Frontend: `<module>.test.ts` next to `<module>.ts`
- Edge functions: `<helper>.test.ts` next to `<helper>.ts` inside `supabase/functions/<fn>/`
- Each test file starts with a comment linking back to the bug report or decision doc it guards.

## Current coverage

### 1. Snapshot renderer (`render-stats-snapshot`)

| ID | Test file | Guards against |
|---|---|---|
| 1a | `supabase/functions/render-stats-snapshot/canvas.test.ts` | Canvas aspect ratio must match background image (landscape stays landscape, portrait stays portrait) |
| 1c | `supabase/functions/render-stats-snapshot/geo.test.ts` | `zoomForBounds` must return a fractional zoom — flooring caused hemisphere-wide maps |
| 1d | `supabase/functions/render-stats-snapshot/geo.test.ts` | Same bounds at different canvas widths must produce different zooms (bounds are size-independent, savedZoom is not) |
| 1e | `supabase/functions/render-stats-snapshot/canvas.test.ts` | Solid-background templates default to landscape 16:9, never portrait |

Post-mortem: [`docs/decisions/snapshots/2026-06-07_snapshot-orientation-viewport-text-fix_post-mortem_lovable.md`](decisions/snapshots/2026-06-07_snapshot-orientation-viewport-text-fix_post-mortem_lovable.md)

### 4. Hotspots

| ID | Test file | Guards against |
|---|---|---|
| 4a | `src/lib/hotspotValidation.test.ts` | Overlap detection excludes data hotspots (map/chart/live_number) — only action-vs-action collisions warn |
| — | `src/lib/hotspotClassification.test.ts` | Auto-classification: hotspot mix determines `display_only` / `interactive_share` / `stats_page` / `hybrid` |

Decision doc: [`docs/decisions/hotspots/2026-04-07_skip-data-hotspot-overlap_feature-doc_lovable.md`](decisions/hotspots/2026-04-07_skip-data-hotspot-overlap_feature-doc_lovable.md)

### Frontend — existing

| Test file | Guards against |
|---|---|
| `src/components/VimeoSlide.test.tsx` | Vimeo iOS fullscreen / native controls integration |

## Backlog

Tests proposed but not yet written (see chat decision log):

- **1b** Solid-background snapshot path renders a rect, not an `<image>` tag (integration-level)
- **1f** Snapshot staleness — per-campaign cache key invalidation
- **2b** `mint_share` rejects level > 3 (Deno test against deployed RPC)
- **2f** RLS tripwire: direct INSERT into `url_events` must fail for `anon`
- **5a** Template deletion blocked when `slide_items.template_id` references it
- **6c** Campaign clone copies full structure but not analytics events
- **7c** `useLiveMetrics` saves both `savedBounds` and `savedZoom` together

## Adding a new test

1. Reproduce the bug in a failing test first.
2. Co-locate the file next to the code under test.
3. Open the file with a comment linking to the bug report or decision doc.
4. Add a row to the table above with a fresh ID.
5. For edge-function tests, prefer extracting pure helpers into a sibling module (see `geo.ts` / `canvas.ts`) so tests don't need to boot Supabase.
