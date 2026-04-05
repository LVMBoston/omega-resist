
# Plan: Retire DeckManager & Simplify DeckManagement

## Context

The unified slide editor (Phase 1) made `DeckEditor` the single place to add/remove hotspots on any slide, with auto-promote/demote. This makes several capabilities in `DeckManager.tsx` and `DeckManagement.tsx` redundant.

---

## 1. Delete `DeckManager.tsx` (dead code)

This file has **no route in App.tsx** and **no sidebar link**. It is unreachable. Deleting it removes 285 lines.

**Capabilities removed (all already available elsewhere):**

| # | Capability | Where it lives now |
|---|---|---|
| 1a | Select a deck from dropdown | DeckManagement grid, DeckEditor URL |
| 1b | "Apply Template" — append a spread-word slide using a chosen template | DeckEditor → "Edit Hotspots" on any slide, or template picker in properties panel |
| 1c | Template preview with hotspot overlay | InteractiveTemplates card preview, DeckEditor SlidePreviewOverlay |
| 1d | Stub checkboxes for "Survey" and "Interactive Analytics" | Never implemented — no functionality behind them |

---

## 2. Remove "Remove Interactivity" from `DeckManagement.tsx`

**Capability removed:**

| # | Capability | Where it lives now |
|---|---|---|
| 2a | Bulk-strip all interactive slides from a deck (`handleRemoveInteractive`) | DeckEditor: select interactive slides → delete, or open each → remove hotspots → auto-demote. More precise and less destructive. |

**What changes:**
- Remove the `handleRemoveInteractive` function (~35 lines)
- Remove the "Remove Interactive" button from each deck card
- Remove the `interactive_count` fetch and display (the "Interactive" badge/count) — this count becomes less meaningful when any slide can be promoted/demoted on the fly

---

## 3. Capabilities that STAY in `DeckManagement.tsx`

These are unique to the deck grid view and not available elsewhere:

| # | Capability | Rationale |
|---|---|---|
| 3a | Deck grid with drag-and-drop reordering | Only place to reorder decks globally |
| 3b | Delete entire deck | Destructive action with proper cascade (viral configs → slides → deck) |
| 3c | Export deck to PDF | Only available here |
| 3d | Import from Google Slides | Only available here |
| 3e | Refresh slide counts | Overview utility |
| 3f | Campaign badges per deck | Quick reference; links to campaign detail |
| 3g | Preview interactive/image slides dialogs | Quick visual inspection without opening editor |
| 3h | "New Deck" navigation to DeckBuilder | Entry point for deck creation |
| 3i | Navigate to DeckEditor per deck | Primary editing entry point |

---

## 4. Update sidebar label (optional cosmetic)

| # | Change |
|---|---|
| 4a | No label change needed — "Deck Management" remains accurate |

---

## 5. Decision document

| # | Action |
|---|---|
| 5a | Save as new decision doc: `docs/decisions/decks/2026-04-05_retire-deck-manager-simplify-management_feature-doc_lovable.md` |

---

## Files changed

| File | Action |
|---|---|
| `src/pages/DeckManager.tsx` | **Delete** |
| `src/pages/DeckManagement.tsx` | Remove `handleRemoveInteractive`, remove interactive count fetch, remove "Remove Interactive" button |
| `docs/decisions/decks/2026-04-05_retire-deck-manager-simplify-management_feature-doc_lovable.md` | **Create** |

## Files NOT changed

- `App.tsx` — no route exists for DeckManager
- `AppSidebar.tsx` — no link exists for DeckManager
- `DeckEditor.tsx` — no changes needed
- `InteractiveTemplates.tsx` — no changes needed
- Database schema — no migrations
