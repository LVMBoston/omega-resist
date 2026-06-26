# Editor ↔ SSR shared-render module — step e (textLayout + manualHtml)

Status: Approved & Implemented
Date: 2026-06-26
Backlog item: #11 (sub-step e)

## What changed

1. `supabase/functions/render-stats-snapshot/manualHtml.ts` moved to `supabase/functions/_shared/render/manualHtml.ts`. The parity harness import path updated accordingly.
2. New `supabase/functions/_shared/render/textLayout.ts` is the single source of truth for:
   - a. `wordWrap(text, maxChars)` — greedy wrap, never breaks single words.
   - b. `maxCharsForWidth(pixelWidth, fontSize, ratio?)` — character budget per line.
   - c. `normalizeVAlign(raw, fallback)` — maps `middle → center`, defaults applied.
   - d. `freeSpaceOffset(contentHeight, boxHeight, vAlign)` — story-block vertical offset.
   - e. `tspanStartY(...)` — first-baseline y for standard hotspot `<tspan>` stacks.
   - f. Constants `AVG_CHAR_WIDTH_RATIO = 0.52`, `LINE_HEIGHT_RATIO = 1.2`, `STORY_LINE_HEIGHT_RATIO = 1.25`.
3. `supabase/functions/render-stats-snapshot/index.ts` now imports the helpers and the inlined `wordWrap`, vertical-alignment switch, and `0.52` / `1.2` literals were removed.
4. `src/shared/render/textLayout.ts` and `src/shared/render/manualHtml.ts` re-export the canonical modules for editor-side parity tooling.
5. 16 new Vitest cases in `src/shared/render/textLayout.test.ts`. Full suite 66/66 passing.
6. `render-stats-snapshot` redeployed.

## Why

Continues item #11 in `docs/BACKLOG.md`: collapse duplicated render logic so editor and SSR cannot drift. Step e was the last big chunk of text math that lived in only one place.

## What this does not change

- a. Editor still relies on CSS box layout for wrapping; the shared helpers are imported by SSR and the parity harness only.
- b. Map marker rules (`mapMarkerRules.ts`) remain unshared — that is step f.
