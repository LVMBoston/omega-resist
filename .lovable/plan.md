
# Multi-Deck Selector for Campaign Cards

## Overview
Currently, the Campaign Orchestration page shows only one deck per campaign card, even when multiple decks are assigned across different Events/Actions (EoAs). This plan adds a deck selector that adapts based on the number of assigned decks.

## Current Behavior
- The campaign card fetches only the first assigned deck (`limit(1)`)
- Displays "View {deckname}" button regardless of how many decks exist
- Does not reflect the full deck assignments visible in the EoA table

## Proposed Behavior
| Condition | Button Display | Action |
|-----------|----------------|--------|
| No decks assigned | "No Deck Assigned" (disabled) | Nothing |
| 1 deck assigned | "View {deckname}" | Opens deck preview dialog |
| 2+ decks assigned | "View # Slide Decks" | Shows dropdown with deck names |

When a deck is selected from the dropdown, it opens the same deck preview dialog that exists today.

---

## Technical Implementation

### File to Modify
`src/pages/CampaignManager.tsx`

### Changes to SortableCard Component

**1. Update State**
Replace the single `deckSlug` state with an array of unique deck slugs:
```typescript
// Before
const [deckSlug, setDeckSlug] = useState<string | null>(null);

// After
const [deckSlugs, setDeckSlugs] = useState<string[]>([]);
const [selectedDeckSlug, setSelectedDeckSlug] = useState<string | null>(null);
```

**2. Update Data Fetching (fetchCampaignData effect)**
Fetch all unique assigned deck slugs instead of just the first one:
```typescript
const { data: eoaData } = await supabase
  .from("events_actions")
  .select("assigned_deck_slug")
  .eq("campaign_id", campaign.id)
  .not("assigned_deck_slug", "is", null);

if (eoaData) {
  const uniqueSlugs = [...new Set(eoaData.map(e => e.assigned_deck_slug))];
  setDeckSlugs(uniqueSlugs);
}
```

**3. Update handleViewDeck Function**
Accept an optional deck slug parameter for direct selection:
```typescript
const handleViewDeck = async (e: React.MouseEvent, slug?: string) => {
  e.stopPropagation();
  const targetSlug = slug || deckSlugs[0];
  if (!targetSlug) {
    toast({ ... "No deck assigned" });
    return;
  }
  setSelectedDeckSlug(targetSlug);
  setDeckDialogOpen(true);
  setLoadingDeck(true);
  // Fetch slides for targetSlug...
};
```

**4. Update Button Rendering**
Replace the single button with conditional rendering:

```text
+--------------------------------------------+
|  CONDITION: deckSlugs.length === 0         |
|  Render: Disabled "No Deck Assigned"       |
+--------------------------------------------+
|  CONDITION: deckSlugs.length === 1         |
|  Render: "View {deckSlugs[0]}" button      |
+--------------------------------------------+
|  CONDITION: deckSlugs.length > 1           |
|  Render: Dropdown with:                    |
|    - Trigger: "View {count} Slide Decks"   |
|    - Items: Each deck slug as option       |
+--------------------------------------------+
```

**5. Add Required Import**
```typescript
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
```

**6. Update Dialog Description**
Use `selectedDeckSlug` instead of `deckSlug` in the dialog:
```typescript
<DialogDescription>
  {selectedDeckSlug ? `Deck: ${selectedDeckSlug}` : "Loading deck..."}
</DialogDescription>
```

---

## UI Component Structure

```text
Single Deck:
+---------------------------+
| [Eye] View why-protest    |
+---------------------------+

Multiple Decks:
+---------------------------+
| [Eye] View 3 Slide Decks ▼|
+---------------------------+
      |  why-protest        |
      |  resist-sister1     |
      |  resist-sister2     |
      +---------------------+
```

---

## Edge Cases Handled
1. **No decks**: Button disabled with "No Deck Assigned" text
2. **Single deck**: Current behavior preserved exactly
3. **Multiple identical slugs**: Deduplicated using `Set`
4. **Deck dialog**: Works the same, just accepts selected deck

---

## Files Changed
- `src/pages/CampaignManager.tsx` - Update SortableCard component

## No Database Changes Required
This is a UI-only change; the data relationship already exists in `events_actions.assigned_deck_slug`.
