# Manual-Entry Rich Text Editor with Auto-Fit + Snapshot Parity

**Status:** Approved & Implemented
**Date:** 2026-06-08
**Author:** lovable
**Project Area:** hotspots

## Summary

Replaces the plain `<textarea>` used for the `manual_entry` Live Number metric with a small rich-text editor (TipTap). Editors can apply bold, italic, bullet/numbered lists, and per-paragraph alignment. The text auto-shrinks to always fit inside the hotspot box, and the same formatting is reproduced by the server-side snapshot renderer so saved PNG snapshots match the live viewer.

## What changes for the user

a. In the hotspot calibration panel, the "Label" field for a Manual Entry metric now shows a toolbar (Bold, Italic, Bullets, Numbered list, Left/Center/Right align) above a small rich-text input.
b. On the slide, manual-entry text is rendered through `ManualEntryRenderer`, which measures the content and scales the font size down in 5% steps (100% → 40% floor) until it fits the box. No more silent clipping unless the content exceeds the floor.
c. Rendered snapshots (PNGs produced by `render-stats-snapshot`) show the same bold/italic/list/alignment formatting and use the same auto-fit algorithm.

## Data model

a. New optional field `Hotspot.manualHtml: string` — sanitized HTML produced by TipTap and re-sanitized with DOMPurify on save.
b. `Hotspot.manualLabel` is retained as a plain-text fallback so existing data keeps rendering and so snapshots that don't have HTML stay on the current code path.
c. Both fields are written together on every edit: TipTap reports the HTML and a plain-text version. No DB migration; the field is stored inside the existing `viral_slide_configs.hotspots` JSON column.

## Sanitization whitelist

Tags: `p, br, strong, em, ul, ol, li, span`.
Attributes: `style, class` (the editor only emits `text-align` styles).
Sanitization runs on save inside `ManualEntryEditor` and again on render inside `ManualEntryRenderer` (defense in depth).

## Auto-fit (client)

`ManualEntryRenderer` runs a `useLayoutEffect` that mutates the font size directly on the content node, measures `scrollHeight`/`scrollWidth` versus the container, and decrements by 5% until the content fits or the 40% floor is hit. Re-runs whenever the box size, base font size, or content changes.

## Auto-fit + parity (snapshot)

`supabase/functions/render-stats-snapshot/index.ts` adds:

a. `parseManualHtml(html)` — a small regex-based parser that walks the constrained HTML and returns blocks (`paragraph`, `li_bullet`, `li_number`) with inline runs carrying `{bold, italic}` and per-paragraph alignment.
b. `wrapRuns(runs, maxChars)` — wraps a logical line into visual lines using an estimated character width of `fontSize * 0.55` (matches the existing `wordWrap` heuristic).
c. `renderManualHtml(html, box, style)` — tries scales 1.0 → 0.4 in 0.05 steps using the same constants as the client; the first scale whose laid-out height fits within the box wins. Emits SVG `<text>`/`<tspan>` with `font-weight` and `font-style` per run, a clip path matching the hotspot box, and bullet/number prefixes for lists.
d. A new branch at the top of the per-hotspot SVG builder routes to `renderManualHtml` whenever `hotspot.metricKey === "manual_entry"` and `manualHtml` is non-empty; the legacy plain-text branch remains for everything else.

## Risk / parity notes

a. Word-wrap points will not be pixel-identical between the browser (real font metrics) and the snapshot (character-width estimate). Same content and roughly the same line count; minor wrap-point differences are acceptable.
b. Auto-fit uses the same step size and floor on both sides so the chosen scale matches within one step.
c. `dangerouslySetInnerHTML` is required for the client renderer; DOMPurify on save and on render keeps the surface tight.

## Files Changed

- `src/types/viralTemplates.ts` — added `Hotspot.manualHtml?: string`.
- `src/lib/manualEntryHtml.ts` (new) — sanitize whitelist, plain→HTML upgrade, HTML→plain helper, shared auto-fit constants.
- `src/components/ManualEntryEditor.tsx` (new) — TipTap-based rich-text editor with a compact toolbar.
- `src/components/ManualEntryRenderer.tsx` (new) — sized container that runs the auto-fit shrink loop.
- `src/components/HotspotCalibrationControls.tsx` — swaps the textarea for `ManualEntryEditor` when the metric is `manual_entry`.
- `src/components/HybridSlide.tsx` — routes manual-entry hotspots with `manualHtml` to `ManualEntryRenderer`.
- `src/components/StatsPageSlide.tsx` — same routing.
- `src/index.css` — compact paragraph/list styles inside `.manual-entry-box` so the auto-fit math is correct.
- `supabase/functions/render-stats-snapshot/index.ts` — `parseManualHtml`, `wrapRuns`, `renderManualHtml`, and the new branch.
- `docs/decisions/hotspots/2026-06-08_manual-entry-rich-text_feature-doc_lovable.md` (this doc).

## Out of scope

- Color / highlight pickers (color stays driven by `liveNumberStyle.color`).
- Headings, tables, images inside text (images already have their own hotspot type).
- Per-character font-family changes.
