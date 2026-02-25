# Unified Slide Architecture & GitHub Branching Strategy

- **Status:** Approved & Implemented (decision document saved)
- **Date:** 2026-02-25
- **Author:** Lovable AI + project owner

---

## Part A — Unified Slide Architecture

### Problem Statement

Every slide in `slide_items` carries a `type` column with two values:

| Value | Rendering path |
|-------|---------------|
| `image` | Plain `<img>` tag |
| `spread-word` | `ViralSlide` component → loads hotspot configs, template type, snapshot logic |

This hard fork surfaces in **6+ files** (DeckEditor, DeckViewer, DeckManager, DeckManagement, CampaignManager, InteractiveTemplates). Users must consciously choose "Add Interactive Slide" vs uploading an image, adding cognitive load and code complexity.

### Proposed Model: Image-First, Auto-Detect

1. All slides start as `type: "image"`.
2. User selects any slide → clicks "Add Hotspot" → places hotspots.
3. On **save**, the system examines hotspots and auto-sets the type:

```
Hotspots present                    → template_type
────────────────────────────────────────────────────
Only action (sms/email/social)      → interactive_share
Only data (live_number/chart/map)   → stats_page
Both action + data                  → hybrid
No hotspots                         → image (display_only)
```

4. `slide_items.type` still stores `spread-word` vs `image` under the hood (backward compatible).

### Auto-Demotion Logic

If a user **removes all hotspots** from a slide that was previously promoted:

1. Set `slide_items.type` back to `"image"`.
2. Clear `slide_items.template_id` to `null`.
3. Delete the orphaned `viral_slide_configs` row (if it was a per-slide config, not a shared template).

This prevents orphaned configuration rows and keeps the "image-first" model clean.

### Deletion Handling (Three Code Paths)

#### DeckEditor — `handleDelete` + `handleSaveChanges`

- Queues slides for deletion in a `pendingDeletes` array.
- On save, iterates pending deletes: if `slide.type === 'spread-word'` **and** `slide.template_id` points to a per-slide config (not a shared template), deletes the `viral_slide_configs` row first, then deletes the `slide_items` row.
- **No change needed** for the unified model — this logic already handles promoted slides correctly.

#### DeckViewer — `handleDeleteInteractive`

- "Remove Interactivity" action from the viewer.
- Deletes the `viral_slide_configs` row (per-slide config only).
- Sets `slide_items.type` back to `"image"` and clears `template_id`.
- **Compatible** with the unified model — this is essentially the same as auto-demotion.

#### DeckManagement — `handleRemoveInteractive` + `handleDelete`

- `handleRemoveInteractive(slug)`: bulk-removes all interactive slides from a deck.
  - Fetches all `spread-word` slides for the deck.
  - For each, deletes the per-slide `viral_slide_configs` row.
  - Updates `slide_items.type` to `"image"` and clears `template_id`.
- `handleDelete(slug)`: deletes entire deck.
  - Cascade handles `slide_items` via FK.
  - Per-slide `viral_slide_configs` rows must be deleted first (no cascade FK).
- **No structural change needed** — existing logic already handles the distinction between shared templates and per-slide configs.

### Shared vs Per-Slide Configs

A `viral_slide_configs` row is considered:

- **Shared template**: `slide_id IS NULL` — lives in the template library, referenced by many slides via `slide_items.template_id`.
- **Per-slide config**: `slide_id IS NOT NULL` — belongs to exactly one slide, safe to delete when the slide is deleted or demoted.

**Rule**: Never delete a shared template when deleting/demoting a slide. Only delete per-slide configs.

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaks existing decks | No data migration; existing `spread-word` slides work as-is |
| ViralSlide rendering pipeline | Zero changes (DeckViewer, ViralSlide, StatsPageSlide, HybridSlide untouched) |
| Snapshot/edge function pipeline | Untouched; triggers on `spread-word` type |
| Hotspot editor | Reuse `FullResolutionHotspotEditor` — already handles all types |

### Files That Would Change

| File | Change |
|------|--------|
| `src/pages/DeckEditor.tsx` | Remove separate "Add Interactive Slide" flow; allow hotspot editing on any slide; auto-detect type on save; auto-demote on hotspot removal |
| `src/pages/InteractiveTemplates.tsx` | Rename UI to "Reusable Slides" or "Slide Library" |
| `src/pages/DeckManager.tsx` | Simplify "Add Spread the Word" into "Apply Template" |
| `src/components/FullResolutionHotspotEditor.tsx` | May add auto-type badge display |

### Files That Do NOT Change

- `slide_items` table schema (no migration)
- `viral_slide_configs` table schema
- `src/pages/DeckViewer.tsx` rendering logic
- `src/components/ViralSlideV2.tsx`, `HybridSlide`, `StatsPageSlide`, `InteractiveShareSlide`
- All edge functions (snapshot rendering, deploy-template-snapshots, etc.)
- Token minting, viral tracking, analytics

### Implementation Phases

**Phase 1 — Editor UX**: Allow adding hotspots to any slide; auto-set type on save; auto-demote when hotspots removed. ~3–4 files changed.

**Phase 2 — Template Library rename**: Cosmetic rename to "Reusable Slides." UI-only.

**Phase 3 (optional) — Remove type column**: Migrate `type` to be fully derived from hotspot presence. Higher risk; defer until Phase 1 is proven stable.

---

## Part B — GitHub Branch Workflow

### Current State

This project is already connected to GitHub. Branches can be used to safely develop the unified slide architecture without risking production.

### Setup Steps

1. **Enable Branch Switching**: Account Settings → Labs → toggle on **GitHub Branch Switching**.
2. **Create feature branch on GitHub**: repo branch dropdown → type `unified-slides` → "Create branch from main."
3. **Switch Lovable to branch**: Project Settings → GitHub → select `unified-slides`.

### Day-to-Day Workflow

```
Need a production fix?
  1. Switch to main (Project Settings → GitHub)
  2. Make the fix
  3. Changes auto-push to GitHub main
  4. Click "Update" in publish dialog to deploy

Resume experiment?
  1. Switch to unified-slides
  2. Continue building
  3. Changes auto-push to GitHub unified-slides
```

### Merge via Pull Request

1. Open a **Pull Request** on GitHub from `unified-slides` → `main`.
2. Review the diff (or have a collaborator review).
3. Merge the PR.
4. Lovable auto-syncs the merged code.
5. Click "Update" in publish dialog to deploy.

### Backend Caveat

| Item | Branch-aware? |
|------|--------------|
| Frontend code | ✅ Yes — each branch has its own code |
| Database migrations | ❌ No — apply immediately to all branches |
| Edge functions | ❌ No — deploy immediately to all branches |

Since the unified slide architecture is **frontend-only** (no DB migrations, no edge function changes), branch switching is safe and ideal.

### Important Notes

- Branch switching is an experimental Labs feature.
- Only one branch is active in Lovable at a time.
- The project owner tells the AI which branch to work on.
