# Phase 1 Unified Slide Architecture — Risk & Simplification Analysis

- **Status:** Analysis Complete
- **Date:** 2026-04-03
- **Predecessor:** [Phase 1 — Unified Slide Architecture: Editor UX](2026-03-07_unified-slide-editor-phase1_feature-doc_lovable.md)
- **Related:**
  - [Unified Slide Model](2026-02-25_unified-slide-model_feature-doc_lovable.md)
  - [Hybrid Templates PRD](../../PRD_Hybrid_Templates.md)
  - [Interactive Slide Templates](../../INTERACTIVE_SLIDE_TEMPLATES.md)
  - [Data Template Editor Refactor Plan](../../PLAN_DataTemplateEditor_Refactor.md)

---

## 1. What the Plan Accomplished

The plan successfully moved auto-classification into `DeckEditor.tsx`, so when a user edits hotspots on any slide, the system infers the `template_type` from hotspot content. This is working correctly in the save path. The classification logic is clean and correct:

```typescript
const classifyHotspots = (hotspots: any[]): { slideType: string; templateType: string } => {
  if (!hotspots || hotspots.length === 0) return { slideType: 'image', templateType: 'display_only' };
  const hasAction = hotspots.some((h: any) => ACTION_TYPES.has(h.type));
  const hasData = hotspots.some((h: any) => DATA_TYPES.has(h.type));
  if (hasAction && hasData) return { slideType: 'spread-word', templateType: 'hybrid' };
  if (hasData) return { slideType: 'spread-word', templateType: 'stats_page' };
  return { slideType: 'spread-word', templateType: 'interactive_share' };
};
```

---

## 2. Risk Assessment

| # | Risk | Severity | Status |
|---|------|----------|--------|
| 1a | **Orphaned per-slide configs on auto-demote** | Medium | The delete guard `.not('slide_id', 'is', null)` is correct — it only deletes per-slide configs, never shared templates. ✅ Safe. |
| 1b | **Lost linkage on auto-promote** | Medium | When creating a per-slide config, it correctly links via `template_id`. But if the slide *already* had a shared `template_id`, the new per-slide config replaces it. The original shared template is preserved (not deleted), but the slide loses its link to it. This is intentional but **irreversible** — there's no "revert to shared template" path. |
| 1c | **Dual editor inconsistency** | High | `FullResolutionHotspotEditor` (used in DeckEditor) only supports **action** hotspot types (`sms`, `email`, `social`, `external_link`, `email_links`, `vimeo`). It has **no UI for data hotspots** (`live_number`, `chart`, `map`). So auto-classification can produce `stats_page` or `hybrid` types, but the editor used to *create* those hotspots in the Deck Editor doesn't support it. The `classifyHotspots` function recognizes data types it can never actually produce through the inline editor. |
| 1d | **Cascade delete via `assigned_deck_slug` trigger** | Low | The plan doesn't modify EoA fields, so the `invalidate_tokens_on_critical_change` trigger is not at risk. ✅ |

---

## 3. Backward Compatibility

| # | Concern | Assessment |
|---|---------|------------|
| 3a | **Existing shared templates** | Fully backward compatible. The query `.is('slide_id', null)` in both `InteractiveTemplates.tsx` and `DeckEditor.tsx` continues to filter correctly. Shared templates are never modified by auto-classify. ✅ |
| 3b | **Existing per-slide configs** | The `loadHotspotsForSlide` priority chain (staged → per-slide → shared template) is correct and handles all legacy states. ✅ |
| 3c | **Rendering pipeline** | No rendering components were changed. `ViralSlideV2`, `HybridSlide`, `StatsPageSlide`, and `InteractiveShareSlide` all read from the same `viral_slide_configs` structure. ✅ |
| 3d | **Snapshot pipeline** | `render-stats-snapshot` and `deploy-template-snapshots` query by `template_id` and `campaign_code` — unaffected by auto-classify. ✅ |

---

## 4. Does It Simplify the Interactive Templates Repository?

**No — and this is the plan's biggest gap.**

| # | Problem | Evidence |
|---|---------|----------|
| 4a | **`InteractiveTemplates.tsx` was not touched** | The plan explicitly states "Files NOT Changed: InteractiveTemplates.tsx". The repository page remains 1,324 lines with all its pre-existing complexity. |
| 4b | **Two completely separate editor paths persist** | Action templates use a `Dialog` + `FullResolutionHotspotEditor`. Data/Hybrid templates use `DataTemplateDialog` + `DataTemplateEditor`. These are entirely different UX flows with different state management, different save paths, and different validation logic. |
| 4c | **Three creation buttons still exist** | "+ New Action Template" (blue), "+ New Data Template" (green), and the implicit "Add Data Layer" (purple) upgrade path. The user must still understand the taxonomy *before* creating a template. Auto-classification only helps in the DeckEditor, not here. |
| 4d | **The hybrid "upgrade" workflow adds complexity** | The `hybridSourceTemplate` state and the conditional logic in `handleDataTemplateSave` add ~100 lines of special-case code that wouldn't be needed if the repository used the same auto-classify approach as the DeckEditor. |
| 4e | **Duplicate classification logic** | `isActionTemplate()`, `isDataTemplate()`, `isHybridTemplate()` in `InteractiveTemplates.tsx` duplicate the intent of `classifyHotspots()` in `DeckEditor.tsx`, but use `template_type` metadata rather than hotspot content. These can diverge. |

---

## 5. Structural Assessment

The plan is **correct for its stated scope** (DeckEditor only) but creates an **architectural split**:

- **DeckEditor**: "Image-first, auto-detect" — smart, content-driven classification.
- **InteractiveTemplates**: "Category-first, manually-typed" — three separate creation flows, three color-coded categories, explicit `template_type` selection.

This means the same template, if edited in DeckEditor, would be auto-classified by content — but if edited in the Repository, it's manually typed. The two systems don't share classification logic.

---

## 6. Recommendations

| # | Recommendation | Impact |
|---|---------------|--------|
| 6a | **Unify the editor**: Replace the three creation paths in InteractiveTemplates with a single "New Template" button that opens a unified editor where hotspot type determines classification on save — mirroring what DeckEditor already does. | High — eliminates ~300 lines and removes the "choose your category upfront" UX burden. |
| 6b | **Extract `classifyHotspots` to a shared utility**: Move it from DeckEditor to `src/lib/hotspotClassification.ts` and use it in both DeckEditor and InteractiveTemplates save paths. | Medium — ensures consistent classification everywhere. |
| 6c | **Either add data hotspot support to `FullResolutionHotspotEditor`, or acknowledge it can't produce data templates**: Currently the DeckEditor's "Edit Hotspots" button opens `FullResolutionHotspotEditor` which only supports action types. The classification code handles data types that the editor can't create. This is either dead code or a Phase 2 gap that should be documented. | Medium — prevents confusion about what the inline editor can actually do. |
| 6d | **Retire the "Add Data Layer" upgrade workflow**: If auto-classify works, a hybrid template is just one that has both action and data hotspots. The explicit promotion ceremony is unnecessary. | Low-medium — simplifies the mental model. |

---

## 7. Summary Verdict

Phase 1 is **well-implemented for DeckEditor** — the classification, promotion, and demotion logic is correct and safe. But it **did not simplify the Repository** and in fact widened the gap between two parallel systems. The Repository remains a 1,324-line file with three distinct editor workflows, duplicate type-checking, and manual category selection — exactly the complexity that auto-classification was meant to eliminate.
