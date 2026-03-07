

# Phase 1 — Unified Slide Architecture: Editor UX

**Date:** 2026-03-07

---

## 1. Current State

The DeckEditor has a **dual-path UX**:
- **"Add Slide(s)"** button → uploads an image as `type: "image"`
- **"Interactive"** button → opens a template picker, adds as `type: "spread-word"` with a `template_id`

There is no way to add hotspots directly to a plain image slide. The hotspot editor exists (`FullResolutionHotspotEditor`) but has no trigger button in the current UI for non-template slides.

---

## 2. What Changes

### 2a. Add "Edit Hotspots" button to any selected slide

In the right sidebar properties panel (lines 1382–1450), add an "Edit Hotspots" button that opens `FullResolutionHotspotEditor` for the currently selected slide — regardless of whether it's `image` or `spread-word`. This is the core UX change: any slide can receive hotspots.

For `spread-word` slides that already have hotspots (via a shared template), load existing hotspots from `hotspotChanges[slideId]` first, then fall back to fetching from `viral_slide_configs` (per-slide config) or the linked template.

### 2b. Auto-classify slide type on save

In `handleSaveChanges` (around line 972–1013), after persisting hotspot changes to `viral_slide_configs`, determine the slide type from hotspot content:

```text
ACTION_TYPES = {sms, email, social, external_link, app_download, email_links, vimeo}
DATA_TYPES   = {live_number, chart, map}

hotspots present?
  ├─ only action  → template_type = 'interactive_share', slide type = 'spread-word'
  ├─ only data    → template_type = 'stats_page',        slide type = 'spread-word'
  ├─ both         → template_type = 'hybrid',            slide type = 'spread-word'
  └─ none         → slide type = 'image' (auto-demote)
```

Update `slide_items.type` accordingly. If promoting from `image` → `spread-word`, create a `viral_slide_configs` row (per-slide, `slide_id IS NOT NULL`). If template_type changed, update the existing row.

### 2c. Auto-demote on hotspot removal

If a user saves hotspots as an empty array for a slide that was previously `spread-word`:
- a. Set `slide_items.type` back to `"image"`.
- b. Clear `slide_items.template_id` to `null`.
- c. Delete the per-slide `viral_slide_configs` row (only if `slide_id IS NOT NULL` — never delete shared templates).

### 2d. Load existing hotspots into the editor

When opening the hotspot editor for a `spread-word` slide, fetch its current hotspots:
- a. Check `hotspotChanges[slideId]` (staged, unsaved edits).
- b. Else query `viral_slide_configs` where `slide_id = slideId`.
- c. Else, if `slide_items.template_id` is set, fetch hotspots from that shared template (read-only reference — edits create a per-slide copy).

Pass these as `initialHotspots` to `FullResolutionHotspotEditor`.

### 2e. Keep the template picker as a shortcut

The "Interactive" button and template dialog remain as a convenience for applying a pre-built template. No removal.

---

## 3. Files Changed

| # | File | Change |
|---|------|--------|
| 3a | `src/pages/DeckEditor.tsx` | Add "Edit Hotspots" button in properties panel; load existing hotspots; auto-classify in `handleSaveChanges`; auto-demote logic |

No database migrations, no edge function changes, no schema changes.

---

## 4. Files NOT Changed

- `viral_slide_configs` table schema
- `slide_items` table schema
- All rendering components (`ViralSlideV2`, `HybridSlide`, `StatsPageSlide`, `InteractiveShareSlide`, `DisplayOnlySlide`)
- All edge functions (snapshot rendering, deploy-template-snapshots)
- `FullResolutionHotspotEditor` component itself
- `InteractiveTemplates.tsx` (template repository — Phase 2 cosmetic rename deferred)

---

## 5. Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 5a | Accidentally deleting a shared template on demotion | High | Guard: only delete `viral_slide_configs` rows where `slide_id IS NOT NULL` |
| 5b | Hotspot editor not loading existing hotspots for template-linked slides | Medium | Fetch chain: staged changes → per-slide config → shared template |
| 5c | `template_type` not in allowed enum values | Low | Use exact strings matching the `valid_template_type` check constraint |

