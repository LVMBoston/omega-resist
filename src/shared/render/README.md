# `src/shared/render/`

**Purpose:** Pure rendering/formatting logic shared by the in-app editor
(Vite/React) and the SSR snapshot renderer
(`supabase/functions/render-stats-snapshot/`, Deno).

This folder exists to make editor ↔ SSR parity a **structural** property of
the codebase. Any logic duplicated between the two sides drifts; logic
imported from here cannot drift.

## Rules — do not violate

1. **Pure logic only.** No Supabase client, no DOM, no `window`, no
   `Deno.*`, no `process.env`. Inputs in, strings/objects out.
2. **No data fetching.** Callers fetch data; this module formats it.
3. **Importable by both runtimes.** The Vite client imports via
   `@/shared/render/...` or relative path. The Deno edge function imports
   via a relative path like `../../../src/shared/render/...`. Both work
   because Deno's bundler follows relative imports anywhere on disk at
   deploy time.
4. **Add a Vitest test** for every exported formatter so regressions are
   caught at build time, not in production snapshots.

## Migration log (see `docs/BACKLOG.md` item #11)

- 2026-06-26 — step (a)+(b) bundled: created folder + moved campaign-story
  formatter (`campaignStory.ts`). The SSR had drifted from the editor in
  several lines (seed sentence, speed phrasing, view sentence). The
  editor's wording was chosen as the single source of truth because it is
  what users currently see in the live deck preview.
- Next: step (c) collapse `campaignStorySplit.ts` duplication.
