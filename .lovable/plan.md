# Promote Slide → Reusable Template (with swappable background)

**Status:** Proposed
**Date:** 2026-06-07

## 1. What the user gets

a. A new **"Save as Template"** button on the selected slide's properties panel in DeckEditor. It turns the current PNG (and any hotspots) into a shared entry in the Template Repository.
b. The current slide is automatically re-linked to the new template, so future template edits also update this slide.
c. **Background swap in two places:**
   - In the Template Repository editor — changes the default background for every slide using the template.
   - On the individual slide in DeckEditor — overrides only this slide's background while keeping the template's hotspots and layout.

## 2. UI changes

### 2a. DeckEditor — properties panel (right sidebar)
- New button **"Save as Template…"** shown when the selected slide has no `template_id` yet. Opens a small dialog asking for **Name**, **Slug** (auto-suggested from name), and optional **Description**.
- New section **"Background"** shown when the slide *is* linked to a template:
  - Thumbnail of the currently rendered background (override if set, else template default).
  - **Upload override** button — uploads a new image and stores it as a per-slide override.
  - **Reset to template default** button — clears the override.
  - Small caption: *"Hotspots come from the template. Background is specific to this slide."*
  - **Guardrail:** when the linked template's `template_type` is `stats_page` or `hybrid`, disable the upload button and show tooltip: *"Background override isn't available yet for slides with live metrics — the pre-rendered snapshot would still show the template's default background."* This keeps the feature safe for the common (display-only / interactive_share) case and defers the snapshot-pipeline work until it's actually needed.

### 2b. Template Repository editor
- No new UI. The existing "Replace Template Image, preserve hotspots" control already swaps the template's default background.

## 3. Data model

a. **New column on `slide_items`:** `image_url_override text null`.
   - When null → renderer falls back to `viral_slide_configs.image_url` (template default).
   - When set → renderer uses this value (supports normal URLs and the existing `solid:#hex` convention).
b. No schema change to `viral_slide_configs`. Promoted slides become regular shared templates (`slide_id IS NULL`).
c. `slide_items.template_id` is repointed to the newly-created template row at promotion time, and `slide_items.type` becomes `spread-word`.

## 4. Rendering rule

In `ViralSlideV2` (and any path that resolves a slide's background), the effective image is:

```text
effectiveImageUrl =
  slide_items.image_url_override        // per-slide override (new)
  ?? viral_slide_configs.image_url      // template default
```

Override is presentation-only — hotspots, template_type, snapshots and analytics are unchanged.

## 5. Promotion flow (Save as Template)

1. User clicks **Save as Template…** on a plain image slide.
2. Dialog collects name + slug + description.
3. Insert new row into `viral_slide_configs` with:
   - `image_url` = the slide's current image
   - `hotspots` = current staged hotspots (empty array OK)
   - `template_type` = classified from hotspots (`display_only` when none, else existing `classifyHotspots()` rules)
   - `slide_id` = NULL (shared template, not per-slide config)
4. Update `slide_items` for the current slide: `template_id = <new id>`, `type = 'spread-word'`, leave `image_url_override` null.
5. Toast confirms and links to the Template Repository entry.

## 6. Background-override flow (per slide)

1. User uploads a new image from the slide's **Background** section.
2. Image is uploaded to the existing `slides` storage bucket.
3. `slide_items.image_url_override` is set to the new URL.
4. Preview re-renders immediately using the override.
5. **Reset** clears `image_url_override` back to null and the template default takes over again.

## 7. Files that change

a. **Migration** — add `image_url_override text` column to `slide_items` (nullable, no default, no RLS change).
b. `src/pages/DeckEditor.tsx` — properties panel: add "Save as Template…" button + dialog; add Background section for template-linked slides; wire upload + reset; apply guardrail for stats_page/hybrid.
c. `src/components/ViralSlideV2.tsx` — when resolving `image_url`, prefer `slide_items.image_url_override` if present (fetched alongside the existing slide query).
d. Renderers (`DisplayOnlySlide`, `HybridSlide`, `StatsPageSlide`, `InteractiveShareSlide`) — no changes; they receive `imageUrl` as a prop from `ViralSlideV2`.

## 8. Things that do **not** change

- `viral_slide_configs` schema
- Template Repository UI and `DataTemplateEditor`
- Hotspot editor, analytics, token minting, snapshot pipeline
- Auto-demote / auto-promote logic in `handleSaveChanges`
- `render-stats-snapshot` and `refresh-all-snapshots` edge functions

## 9. Deferred (revisit if/when needed)

Per-slide background overrides on **stats_page / hybrid** slides require teaching the snapshot pipeline about overrides (per-slide snapshot files, per-slide staleness columns). Today's plan blocks this case at the UI to keep scope small. When a real need shows up, we open a follow-up plan to extend snapshots.

## 10. Decision log

This is a **new** plan. After implementation it will be saved as:
`docs/decisions/decks/2026-06-07_promote-slide-to-template-and-background-swap_feature-doc_lovable.md`
