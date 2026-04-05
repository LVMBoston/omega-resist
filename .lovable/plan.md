

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

---

## Addition — 2026-04-05: Strip Numeric Suffix from Deck Slug Display

### Rationale

Deck slugs include a timestamp suffix (e.g., `omega-reports-1772812835212`) that is noise in the UI. A production query confirms no two decks share a base slug, so stripping the suffix loses no information. The full slug is preserved in link `href` for correctness.

### Changes

1. **Display helper in `InteractiveTemplates.tsx`**
   a. Add utility: `const displaySlug = (slug: string) => slug.replace(/-\d{10,}$/, '')`
   b. Apply to deck slug labels in the Decks popover text
   c. Keep full slug in `href` to `/deck-editor/{slug}`

2. **Decision document update**
   a. Append `## Update — 2026-04-05` section to existing decision doc

### Files Changed

- `src/pages/InteractiveTemplates.tsx` — add `displaySlug`, apply to popover
- `.lovable/plan.md` — this section
- `docs/decisions/deck-editor/2026-04-05_template-card-deck-campaign-indicators_feature-doc_lovable.md` — append update section

### What Does Not Change

- Link targets (full slug preserved in URLs)
- Hook logic in `useTemplateDecks.ts`
- Database schema

