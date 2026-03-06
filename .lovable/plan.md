

# Add Assigned Deck to EoA Dropdowns

## Problem
EoAs with the same title and mobilize_code but different assigned decks are indistinguishable in the Select dropdowns on both tabs.

## Change

**File:** `src/pages/RepointQrTool.tsx`

1. **Re-point QR tab dropdown (line 568):** Change label from `{e.title} ({e.mobilize_code ?? "no code"})` to `{e.title} ({e.mobilize_code ?? "no code"}) — {e.assigned_deck_slug ?? "no deck"}`

2. **Re-Mint EoA tab dropdown (line 715):** Same change — append `— {e.assigned_deck_slug ?? "no deck"}` to the label.

Both `filteredEoas` and `rmFilteredEoas` already come from the `eoas` state which queries `events_actions` including `assigned_deck_slug`, so no data-fetching changes are needed.

