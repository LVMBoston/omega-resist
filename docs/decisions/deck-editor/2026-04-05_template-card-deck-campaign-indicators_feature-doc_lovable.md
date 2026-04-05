# Template Card Enhancements: Deck/EoA Indicators + Campaign Dialog Cleanup

**Status: Approved & Implemented**
**Date: 2026-04-05**

## Rationale

The `/interactive-templates` page lets admins manage reusable slide templates. Today, each template card has a "Campaigns" button that opens a dialog showing which campaigns use the template. However, two information gaps make it harder to assess a template's scope and impact at a glance:

1. **No deck visibility.** Templates are linked to campaigns through an intermediate layer: `slide_items` (which reference `deck_slug`), then `events_actions` (which assign deck slugs to EoAs within campaigns). The current UI skips this middle layer entirely. When an admin wants to know "which decks use this template?" — e.g., before editing hotspot positions or deleting the template — they have no way to find out without navigating to each deck individually.

2. **No campaign count on the button.** The "Campaigns" button label is static — you must click it and wait for the query to learn whether 0 or 12 campaigns are affected. Showing the count inline (`Campaigns (3)`) gives immediate triage.

3. **Dialog clutter.** The Campaign Usage dialog has a redundant two-line header and an oversized icon in the empty state.

Adding EoA counts inside the Decks popover completes the picture: `template → deck → EoA` is the full deployment chain.

## Changes

### 1. Campaign Usage Dialog Cleanup (`InteractiveTemplates.tsx`)

a. Merged `DialogTitle` and `DialogDescription` into a single title: `"Campaigns using: {template name}"`.

b. Simplified empty state: removed the large `FolderKanban` icon, changed text to `"Not currently used in any campaigns"`.

### 2. Campaign Count on Button (`InteractiveTemplates.tsx`)

a. Added batch query hook `useAllTemplateCampaignCounts(templateIds)` that traverses `slide_items → events_actions → campaigns` grouped by `template_id`. Returns `Record<string, number>`.

b. Updated the Campaigns button label from `Campaigns` to `Campaigns (N)`.

### 3. Deck + EoA Indicator

a. Created `src/hooks/useTemplateDecks.ts` with `useAllTemplateDecks(templateIds)` — batch query returning `Record<string, DeckWithEoaCount[]>`.

b. EoA counts per deck fetched via `events_actions.assigned_deck_slug`.

c. Added `Decks (N)` button to the card footer with `LayoutGrid` icon.

d. Popover lists each deck slug with EoA count and links to `/deck-editor/{slug}`.

### 4. Decision Document

a. This file — new decision doc.

## Files Changed

- `src/hooks/useTemplateDecks.ts` — new batch hooks for deck slugs + EoA counts and campaign counts
- `src/pages/InteractiveTemplates.tsx` — dialog cleanup, campaign count on button, deck button + popover
- `docs/decisions/deck-editor/2026-04-05_template-card-deck-campaign-indicators_feature-doc_lovable.md` — this doc

## What Does Not Change

- Database schema — no migrations needed
- `useTemplateCampaigns.ts` — existing per-template hook remains for the dialog's detailed list
- Template CRUD logic — no changes
- RLS policies — all tables already publicly readable
