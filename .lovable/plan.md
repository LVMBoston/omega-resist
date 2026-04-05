

# Updated Plan: Template Card Enhancements (with Slug Display Cleanup)

Appending one change to the existing approved plan.

## Addition: Strip Numeric Suffix from Deck Slug Display

### Changes

1. **Display helper in `InteractiveTemplates.tsx`**
   a. Add utility: `const displaySlug = (slug: string) => slug.replace(/-\d{10,}$/, '')`
   b. Apply to deck slug labels in the Decks popover text
   c. Keep full slug in `href` to `/deck-editor/{slug}`

2. **Decision document update**
   a. Append `## Update — 2026-04-05` section to existing `docs/decisions/deck-editor/2026-04-05_template-card-deck-campaign-indicators_feature-doc_lovable.md`

### Files Changed
- `src/pages/InteractiveTemplates.tsx` — add `displaySlug`, apply to popover
- `.lovable/plan.md` — append slug cleanup section
- `docs/decisions/deck-editor/2026-04-05_template-card-deck-campaign-indicators_feature-doc_lovable.md` — append update section

### What Does Not Change
- Link targets (full slug preserved in URLs)
- Hook logic in `useTemplateDecks.ts`
- Database schema

