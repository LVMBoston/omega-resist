

# Audit and Fix: Template Deletion Orphaning slide_items

## Problem

The `slide_items.template_id` foreign key uses `ON DELETE SET NULL`. When a template is deleted from the Interactive Templates repository, all slides referencing it silently lose their linkage (`template_id` becomes `NULL`), causing the "data is null" error on the Stats Page slide.

Three delete paths exist today:

1. **InteractiveTemplates.tsx** -- "Delete" button on a template card (line 796). The confirmation message incorrectly says "This will not affect decks already using it."
2. **DeckManagement.tsx** -- "Remove interactive pages" deletes `viral_slide_configs` by `slide_id` (line 252). This targets per-slide configs, not shared templates, so it is less risky but still dangerous if a shared template happens to have a matching `slide_id`.
3. **DeckManagement.tsx** -- "Delete deck" deletes `viral_slide_configs` by `deck_slug` (line 278). Same concern: could hit shared templates that have a `deck_slug` set.

## Plan

### Step 1: Add a pre-delete linkage check in InteractiveTemplates.tsx

Before deleting a template, query `slide_items` to count how many slides reference it:

```
SELECT count(*) FROM slide_items WHERE template_id = '<id>'
```

- If count > 0: show a warning dialog listing the affected deck slugs, and require explicit confirmation ("This template is used by N slides in decks X, Y. Deleting it will break those slides.")
- If count = 0: allow deletion with a simple confirmation.

### Step 2: Fix the misleading confirmation text

Change the current message from:
> "Delete this template? This will not affect decks already using it."

To a dynamic message based on the linkage check result.

### Step 3: Scope DeckManagement deletes to non-shared configs

In `DeckManagement.tsx`, add a `deck_slug IS NOT NULL` guard or a `template_type` filter to the delete queries so they only remove per-deck configs (those created inline with a deck), not shared repository templates.

### Step 4: Document in the change log

Append an entry to the investigation MD file recording this fix.

---

## Technical Details

### File: `src/pages/InteractiveTemplates.tsx`

- Around line 794-798: Replace the inline `confirm()` with an async check that queries `slide_items` for linked slides before proceeding.
- The `deleteTemplate` mutation itself (line 277-285) stays the same; the guard is added at the call site.

### File: `src/pages/DeckManagement.tsx`

- Line 252: Add `.not('deck_slug', 'is', null)` or similar filter to the delete query so shared templates (which typically have `deck_slug = null` or a different slug pattern) are not accidentally removed.
- Line 278: Same treatment -- scope to configs that belong to that specific deck and are not shared repository templates.

### No schema changes required

The `ON DELETE SET NULL` constraint is correct behavior -- it protects referential integrity. The fix is to prevent accidental deletions at the application layer.
