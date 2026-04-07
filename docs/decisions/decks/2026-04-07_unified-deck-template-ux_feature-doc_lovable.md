# Unified Deck & Template UX

**Status: Approved & Implemented**  
**Date: 2026-04-07**

## Summary

Aligned the visual language and interaction patterns across DeckBuilder, DeckEditor, and Template editing, while merging the Template Repository into Deck Management as a tab.

## Changes Implemented

### 1. DeckBuilder header alignment
a. Replaced bare `<h1>` with breadcrumb header: `Deck Management > New Deck`.
b. After successful deck creation, navigates to `/deck-editor/{slug}` instead of `/deck-management`.

### 2. Template Repository merged into Deck Management
a. Added `Tabs` component to DeckManagement with two tabs: **Decks** and **Templates**.
b. Extracted template grid, filters (all/action/data/hybrid), create/edit dialogs, and all mutation logic from `InteractiveTemplates.tsx` into `src/components/TemplateRepositoryTab.tsx`.
c. Removed "Interactive Slide Editor" from sidebar navigation.
d. `/interactive-templates` route now redirects to `/deck-management?tab=templates`.
e. `/template-editor/:id` remains standalone (no sidebar).

### 3. DeckManagement header alignment
a. Replaced header with breadcrumb pattern matching DeckEditor.
b. Action bar buttons are contextual: only deck actions show on the Decks tab.

### 4. Standardized patterns
a. Primary action right-most, destructive/cancel left.
b. Unsaved changes guards preserved from InteractiveTemplates.
c. DeckBuilder now navigates directly to editor on success.

## Files Changed
- `src/pages/DeckBuilder.tsx` — breadcrumb header, navigate to editor on success
- `src/pages/DeckManagement.tsx` — Tabs (Decks/Templates), breadcrumb header
- `src/components/TemplateRepositoryTab.tsx` (new) — extracted from InteractiveTemplates
- `src/pages/InteractiveTemplates.tsx` — redirect wrapper
- `src/components/AppSidebar.tsx` — removed "Interactive Slide Editor" entry
- Decision document (this file)

## Files NOT Changed
- `src/pages/DeckEditor.tsx` — reference layout
- `src/pages/TemplateEditorPage.tsx` — intentionally standalone
- `src/components/DataTemplateEditor.tsx` — no changes
- Database schema — no migrations
