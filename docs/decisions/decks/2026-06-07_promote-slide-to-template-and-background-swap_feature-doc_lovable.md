# Promote Slide → Reusable Template (with swappable background)

- **Status:** Approved & Implemented
- **Date:** 2026-06-07
- **Author:** Lovable AI + project owner

---

## Summary

Two new capabilities in DeckEditor's right-hand properties panel:

1. **Save as Template…** — promotes the currently-selected plain image slide into a shared entry in the Template Repository (`viral_slide_configs` with `slide_id IS NULL`). The slide is automatically relinked (`template_id` → new template, `type` → `spread-word`) so future template edits also update it.
2. **Background** section — for any slide already linked to a template, lets the user upload a per-slide override of the background image, or reset it back to the template default. Hotspots and template type are unchanged; only the visual is swapped.

## Data model

- New column `slide_items.image_url_override text null`.
- Renderer rule: `effectiveImage = slide_items.image_url_override ?? viral_slide_configs.image_url`.
- No change to `viral_slide_configs` schema.

## Files changed

- **Migration** — `ALTER TABLE public.slide_items ADD COLUMN image_url_override text;`
- `src/pages/DeckEditor.tsx` — added Save-as-Template button and dialog; added Background section with upload + reset; new handlers `openSaveAsTemplateDialog`, `handleSaveAsTemplate`, `handleUploadBackgroundOverride`, `handleResetBackgroundOverride`; preview and hotspot-editor `imageUrl` now prefer `image_url_override`.
- `src/components/ViralSlideV2.tsx` — `slide_items` query now selects `image_url_override` and uses it in preference to `viral_slide_configs.image_url`.

## Guardrail (deferred per plan §9)

Per-slide background overrides on **`stats_page` / `hybrid`** slides are disabled in the UI for now: the Upload button is greyed with a tooltip explaining that the pre-rendered snapshot would still show the template default. If we later need overrides on snapshot-using slides, we'll teach `render-stats-snapshot` and `refresh-all-snapshots` about per-slide snapshot files and per-slide staleness tracking.

## Files NOT changed

- `viral_slide_configs` schema
- Template Repository UI / `DataTemplateEditor` (its existing "Replace Template Image, preserve hotspots" control already swaps the template default)
- Hotspot editor, analytics, snapshot edge functions
- Auto-promote / auto-demote logic in `handleSaveChanges`
