# Editor ↔ SSR Shared-Render Module — Step f (plain-text extraction + parity harness §3)

Status: Approved & Implemented
Date: 2026-06-26

## Summary

Extracted the standard-hotspot SVG text generation out of the
`render-stats-snapshot` edge function into a shared module so the
Deck Editor and the SSR snapshot renderer cannot drift on word-wrap,
vertical alignment, padding, or XML-escaping behavior. Extended the
existing Parity Harness with a §3 "Plain-text hotspots" section that
exercises the new shared helper alongside an editor-side CSS mirror.

## Files

- `supabase/functions/_shared/render/plainText.ts` — new canonical
  `renderPlainTextSvg(text, box, style, clipIdPrefix)`. Pure logic, no
  Deno or DOM APIs. Consumes the existing `textLayout.ts` helpers.
- `src/shared/render/plainText.ts` — thin re-export for the Vite client
  (parity harness + future editor-side parity tests).
- `src/shared/render/plainText.test.ts` — 7 Vitest cases covering
  single-line rendering, wrapping, XML escaping, left/right anchor
  geometry, clipPath wrapping, and explicit newlines.
- `supabase/functions/render-stats-snapshot/index.ts` — the standard-
  hotspot branch (≈60 lines of inlined text-anchor + wrap + tspan math)
  is replaced with a single call to `renderPlainTextSvg`.
- `src/pages/ParityHarness.tsx` — new §3 section with 7 plain-text
  fixtures (short metric, label, wrapping timestamp, right-align bottom,
  multi-line via `\n`, multi-line wrap, XML special chars). Routed via
  `?section=3`.
- `docs/BACKLOG.md` item 11.i annotated as "Partially shipped" with a
  pointer to the remaining harness coverage (campaign-story segments,
  custom-style live_number, email and map-legend hotspots).

## Verification

- `bunx vitest run src/shared/render/` → 44/44 passing (added 7 cases
  for `plainText`, existing 37 untouched).
- `supabase functions deploy render-stats-snapshot` → success.
- Parity harness §3 renders SSR (right) and CSS-mirror editor (left)
  side-by-side at the preview route `/parity-harness?section=3`.

## What this does not change

- Editor components themselves (`HybridSlide.tsx`, `StatsPageSlide.tsx`)
  still rely on browser CSS box layout for plain text — the harness
  acts as the parity gate; live editor components are not refactored
  to call `renderPlainTextSvg` directly.
- Campaign-story two-column rendering, live-number custom styles, and
  email/map-legend hotspots are still covered only by the SSR side and
  the editor; harness fixtures for them remain in backlog item 11.i.
