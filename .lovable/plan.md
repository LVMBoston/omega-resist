
# Archive: Editor ↔ SSR shared-render module → BACKLOG #11

Append a new item #11 to `docs/BACKLOG.md`. No code changes, no implementation now.

## Entry to add

**11. Editor ↔ SSR shared-render module (general regression prevention)**

- Observation: Editor and SSR keep drifting because shared logic is duplicated. Recent regressions: narrative wording mismatch (2026-06-26), font-size multiplier, default style drift, manual-HTML alignment. Existing parity rule is enforced only by discipline.
- Goal: Make parity structural, not disciplinary.
- Deferred work (lettered a–l):
  - a. Create `src/shared/render/` — pure-logic module imported by both Vite client and Deno SSR. No Supabase/DOM/runtime-specific APIs. Header comment on each file.
  - b. Move `formatNarrative` to shared first (fixes today's bug).
  - c. Collapse duplicated `campaignStorySplit.ts` into shared.
  - d. Move hotspot defaults (font size, family, weight, color, padding, line-height, text-align, vertical-align) into `hotspotDefaults.ts`.
  - e. Move `textLayout.ts` and `manualHtml.ts` into shared.
  - f. Move `mapMarkerRules.ts` last.
  - g. Keep data-fetching split; both sides produce same `NarrativeData` shape — that shape is the contract.
  - h. Add ESLint rule / CI grep that fails on redeclared shared symbols.
  - i. Expand `ParityHarness.tsx` fixtures: every hotspot type, both orientations, every story segment, edge cases.
  - j. Add Vitest gate comparing shared formatter outputs across fixtures; fails build on drift.
  - k. Each migration step ships independently; hidden divergences become separate decisions.
  - l. Archive design decision under `docs/decisions/snapshots/<YYYY-MM-DD>_editor-ssr-shared-render-module_feature-doc_lovable.md` when implementation starts.
- What it does not fix: query-layer divergence, font-metric differences between browser and SVG.
- Related memory: `mem://standards/editor-ssr-render-parity`.

## Files touched
- `docs/BACKLOG.md` — append item #11 only. Nothing else.
