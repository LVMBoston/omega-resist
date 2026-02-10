

# Add "Save As" Button to Deck Editor

## Overview
Add a "Save As" button that duplicates the current deck under a new slug, copying all slides and interactive template configurations. This lets users create a variant of an existing deck without modifying the original.

## User Flow
1. User clicks "Save As" in the header toolbar (next to "Save Changes")
2. A dialog prompts for a new deck slug (pre-filled with `{current-slug}-copy`)
3. On confirm, the system creates the new deck and copies all slides
4. User is navigated to the new deck's editor page

## Changes

### File: `src/pages/DeckEditor.tsx`

**1. Add state for the Save As dialog**
- `saveAsDialogOpen` (boolean)
- `newDeckSlug` (string, initialized to `{slug}-copy`)
- `savingAs` (boolean, for loading state)

**2. Add `handleSaveAs` function**
The function will:
- Validate the new slug (no spaces, lowercase, alphanumeric + hyphens only)
- Check if a deck with that slug already exists (query `decks` table)
- Insert a new row into `decks` with the new slug
- For each slide in the current deck (from DB, not draft state):
  - Insert a new `slide_items` row with `deck_slug = newSlug`, preserving `position`, `type`, `content_url`, `is_compressed`, and `template_id`
  - If the slide has an associated `viral_slide_configs` record (via `slide_id`), copy that config with the new slide's ID
- Navigate to `/deck-editor/{newSlug}`
- Show success toast

Note: Storage files are NOT duplicated -- the new slides reference the same `content_url`. This is safe since slide images are immutable once uploaded.

**3. Add the button and dialog to the UI**
- Place a "Save As" button in the header bar, between "Cancel" and "Save Changes"
- Use the existing Dialog component for the slug input prompt
- Include slug validation feedback (e.g., "Slug already exists" error)

## Technical Details

- The `decks` table uses `slug` as its primary key (text, not UUID)
- `slide_items.deck_slug` references the deck
- `viral_slide_configs` links to slides via `slide_id` (UUID FK)
- The copy uses the saved state from DB (`originalSlides`), not the draft state, to avoid copying unsaved temp slides
- If the user has unsaved changes, warn them that only the last saved version will be copied

## What Does NOT Change
- The existing Save/Cancel workflow
- The deck's relationship to campaigns or EOAs (the copy starts unassigned)
- Storage files (shared references, no duplication)
