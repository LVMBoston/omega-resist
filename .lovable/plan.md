

## What's Missing

The `.lovable/plan.md` file contains only Phases 1/1b/1c (Unified Slide Architecture). The entire Anonymous Feedback System plan — including the feedback form configuration via Settings — was discussed and approved in conversation but never committed to either:
- `.lovable/plan.md` (master plan)
- `docs/decisions/forms/2026-03-18_anonymous-feedback-system_feature-doc_lovable.md` (feature doc)

## What I'll Do

**Two files to create/update:**

### 1. `.lovable/plan.md` — Append new section

Add a new entry after Phase 1c:

```
---

# Anonymous Feedback System

**Status:** Implementation Pending
**Date:** 2026-03-18

Anonymous feedback collection via `form_trigger` hotspots. 3-step form (category → message → confirmation)
with silent token/campaign context capture. Admin reporting tab + campaign card badges. Categories and tags
are configurable via Settings page "Feedback" tab (global defaults in `settings` table, future cascade
via `campaign_message_overrides`). See `docs/decisions/forms/2026-03-18_anonymous-feedback-system_feature-doc_lovable.md`.
```

### 2. `docs/decisions/forms/2026-03-18_anonymous-feedback-system_feature-doc_lovable.md` — Create

Full feature doc covering all 8 sections:

1. **Database migration** — `feedback_submissions` table, `submit_feedback` RPC, `get_feedback_counts` RPC, RLS, seed 2 `settings` rows (feedback categories + tags)
2. **Snapshot renderer fix** — add `form_trigger` to `ACTION_TYPES` exclusion set
3. **FeedbackFormPopover component** — 3-step overlay, silent context resolution from `viralToken`, `react-hook-form` + `zod`
4. **InteractiveSlideOverlay wiring** — `form_trigger` opens popover, disables carousel swiping
5. **Admin reporting** — `CampaignFeedback.tsx` (filterable table, CSV export), new tab in `CampaignDetail.tsx`, badge in `CampaignManager.tsx`
6. **Settings page — Feedback tab** — chip-style list editors for global category/tag arrays, uses `useSettings("feedback")` hook
7. **Implementation order** (migration → snapshot fix → popover + wiring → admin UI → settings tab)
8. **Test plan** (automated RPC/RLS checks + guided tour + admin UI verification)

Section 6 explicitly covers the configurable form options:
- Global defaults seeded in migration as `settings` rows
- New "Feedback" tab in Settings page with chip-style add/remove editors
- `FeedbackFormPopover` reads from `useSettings("feedback")` with hardcoded fallback
- Future cascade path via `campaign_message_overrides` noted but not built in v1

