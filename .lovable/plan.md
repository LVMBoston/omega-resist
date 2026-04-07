

# Unify UX Across Deck & Template Workflows

## Summary

Align the visual language and interaction patterns across DeckBuilder, DeckEditor, and Template editing, while merging the Template Repository into Deck Management as a tab.

## Current State

| Page | Layout | Header | Nav pattern | Save pattern |
|------|--------|--------|-------------|-------------|
| DeckBuilder | Centered card form | `<h1>` title | None (redirects to DeckManagement) | Submit button in form |
| DeckEditor | 3-column (thumbnails/preview/properties) | Breadcrumb + action bar | Breadcrumb → Deck Management | Save Changes / Cancel / Save As |
| InteractiveTemplates | Card grid | `<h1>` title | Sidebar link | Inline dialogs |
| TemplateEditorPage | Full-screen, no sidebar | Breadcrumb header | Breadcrumb → Template Repository | Delegated to DataTemplateEditor |

## Plan

### 1. Align DeckBuilder header and chrome

a. Replace the bare `<h1>` with a breadcrumb header matching DeckEditor: `Deck Management > New Deck`.
b. Add a consistent action bar area (right-aligned) even though the only action is the submit button — this establishes the same visual rhythm.
c. After successful creation, navigate to `/deck-editor/{slug}` instead of `/deck-management`, so the user flows directly into editing.

### 2. Merge Template Repository into Deck Management

a. Add a `Tabs` component to DeckManagement with two tabs: **Decks** (current deck list) and **Templates** (current InteractiveTemplates content).
b. Move the template card grid, filters (all/action/data/hybrid), create/edit dialogs, and all mutation logic from `InteractiveTemplates.tsx` into a new `TemplateRepositoryTab.tsx` component, rendered inside the Templates tab.
c. Update the sidebar: remove the separate "Interactive Slide Editor" entry; rename "Deck Management" to "Decks & Templates" (or keep as-is — your call).
d. Update `App.tsx`: redirect `/interactive-templates` to `/deck-management?tab=templates` for backward compatibility.
e. Keep `/template-editor/:id` as a standalone route (no sidebar) since that full-screen editor is intentionally immersive.

### 3. Align DeckManagement header

a. Replace the current DeckManagement header with the same breadcrumb + action bar pattern used in DeckEditor.
b. Breadcrumb: just `Deck Management` (top-level, no parent).
c. Action bar: "New Deck" button (navigates to `/deck-builder`), plus any existing refresh/export actions.

### 4. Standardize save/cancel/discard patterns

a. Document a shared pattern: primary action right-most, destructive/cancel left of it, status indicator (e.g., "Unsaved changes") as a badge.
b. Ensure DeckBuilder, DeckEditor, and template edit dialogs all follow this order.
c. Template edit dialogs already have unsaved-changes guards; verify DeckBuilder warns if navigating away mid-upload.

### 5. Align template editing entry points

a. From the Templates tab in Deck Management, clicking a template card opens the same editor it does today (action templates → inline dialog, data/hybrid templates → DataTemplateDialog or TemplateEditorPage).
b. No change to the editing components themselves — only the entry point moves from a standalone page to a tab.

### 6. Update decision document

a. Create `docs/decisions/decks/2026-04-07_unified-deck-template-ux_feature-doc_lovable.md` with status "Approved & Implemented".

## Files Changed

- `src/pages/DeckBuilder.tsx` — breadcrumb header, navigate to editor on success
- `src/pages/DeckManagement.tsx` — add Tabs (Decks / Templates), breadcrumb header, action bar
- `src/components/TemplateRepositoryTab.tsx` (new) — extracted from InteractiveTemplates
- `src/pages/InteractiveTemplates.tsx` — redirect wrapper to DeckManagement?tab=templates
- `src/components/AppSidebar.tsx` — remove or update "Interactive Slide Editor" link
- `src/App.tsx` — redirect `/interactive-templates` route
- Decision document (new)

## Files NOT Changed

- `src/pages/DeckEditor.tsx` — already the reference layout
- `src/pages/TemplateEditorPage.tsx` — intentionally standalone
- `src/components/FullResolutionHotspotEditor.tsx` — no changes
- `src/components/DataTemplateEditor.tsx` — no changes
- Database schema — no migrations

## Risk

- InteractiveTemplates.tsx is ~1360 lines; extracting into a tab component requires careful state migration. Approach: lift as a self-contained component with its own query/mutation hooks (already pattern-compatible).
- Backward links from other pages (e.g., DeckEditor breadcrumb linking to `/deck-management`) continue to work since that route persists.

