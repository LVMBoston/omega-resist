# Retire DeckManager & Simplify DeckManagement

- **Status:** Approved & Implemented
- **Date:** 2026-04-05
- **Author:** Lovable AI + project owner

---

## Summary

Removed redundant deck management capabilities that are now handled by the unified slide model in `DeckEditor.tsx` (Phase 1).

## Changes

### 1. Deleted `DeckManager.tsx`

This file had **no route in App.tsx** and **no sidebar link** — it was dead code (285 lines). All its capabilities exist elsewhere:

| Capability | Where it lives now |
|---|---|
| Select a deck | DeckManagement grid, DeckEditor URL |
| Append a spread-word slide via template | DeckEditor → "Edit Hotspots" on any slide |
| Template preview with hotspot overlay | InteractiveTemplates card preview, DeckEditor SlidePreviewOverlay |
| "Survey" / "Interactive Analytics" checkboxes | Never implemented — stub UI only |

### 2. Removed "Remove Interactivity" from `DeckManagement.tsx`

| Capability removed | Where it lives now |
|---|---|
| Bulk-strip all interactive slides from a deck | DeckEditor: select slides → delete, or remove hotspots → auto-demote |

Removed:
- `handleRemoveInteractive` function (~35 lines)
- "Remove Interactive" button (X icon) from deck card footer
- `onRemoveInteractive` prop from `SortableDeckCardProps`

### 3. Capabilities preserved in `DeckManagement.tsx`

- Deck grid with drag-and-drop reordering
- Delete entire deck (with cascade)
- Export deck to PDF
- Import from Google Slides
- Refresh slide counts
- Campaign badges per deck (linked to campaign detail)
- Preview interactive/image slides dialogs
- "New Deck" navigation
- Navigate to DeckEditor per deck
- Interactive/image slide counts (kept for informational value)

## Rationale

The unified slide model (Phase 1) allows any slide to be promoted/demoted via hotspot editing in the DeckEditor. This makes:
- A standalone "apply template to deck" page (`DeckManager`) unnecessary
- Bulk "remove interactivity" too coarse — per-slide control in the editor is more precise and less destructive

## Files Changed

| File | Action |
|---|---|
| `src/pages/DeckManager.tsx` | **Deleted** |
| `src/pages/DeckManagement.tsx` | Removed `handleRemoveInteractive`, button, and prop |

## Files NOT Changed

- `App.tsx` — no route existed for DeckManager
- `AppSidebar.tsx` — no link existed for DeckManager
- `DeckEditor.tsx` — no changes needed
- Database schema — no migrations
