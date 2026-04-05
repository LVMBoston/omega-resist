

# Template Card Enhancements: Deck/EoA Indicators + Campaign Dialog Cleanup

## Rationale

The `/interactive-templates` page lets admins manage reusable slide templates. Today, each template card has a "Campaigns" button that opens a dialog showing which campaigns use the template. However, two information gaps make it harder to assess a template's scope and impact at a glance:

1. **No deck visibility.** Templates are linked to campaigns through an intermediate layer: `slide_items` (which reference `deck_slug`), then `events_actions` (which assign deck slugs to EoAs within campaigns). The current UI skips this middle layer entirely. When an admin wants to know "which decks use this template?" — e.g., before editing hotspot positions or deleting the template — they have no way to find out without navigating to each deck individually. The delete confirmation dialog already warns about linked decks, but the card itself offers no preview.

2. **No campaign count on the button.** The "Campaigns" button label is static — you must click it and wait for the query to learn whether 0 or 12 campaigns are affected. Showing the count inline (`Campaigns (3)`) gives immediate triage: templates with high counts deserve more caution before editing; templates with `(0)` may be candidates for cleanup.

3. **Dialog clutter.** The Campaign Usage dialog has a redundant two-line header (title + description showing the template name separately) and an oversized icon in the empty state. Simplifying this improves scannability.

Adding EoA counts inside the Decks popover completes the picture: `template → deck → EoA` is the full deployment chain, and surfacing all three levels lets an admin understand the blast radius of any template change without leaving the page.

---

## Changes

### 1. Campaign Usage Dialog Cleanup (`InteractiveTemplates.tsx`)

a. Merge `DialogTitle` and `DialogDescription` into a single title: `"Campaigns using: {template name}"`. Remove the separate `DialogDescription`.

b. Simplify empty state: remove the large `FolderKanban` icon, change text to `"Not currently used in any campaigns"`.

### 2. Campaign Count on Button (`InteractiveTemplates.tsx`)

a. Add a batch query (new `useQuery`) that fetches campaign counts for all visible template IDs in a single pass. Traversal: `slide_items.template_id → slide_items.deck_slug → events_actions.assigned_deck_slug → events_actions.campaign_id`, grouped by `template_id`. Returns `Record<string, number>`.

b. Update the Campaigns button label from `Campaigns` to `Campaigns (N)` using the pre-fetched counts. Show `(0)` when no campaigns are linked.

### 3. Deck + EoA Indicator

a. **New hook** `src/hooks/useTemplateDecks.ts` — exports `useAllTemplateDecks(templateIds: string[])`. Batch query: `SELECT template_id, deck_slug FROM slide_items WHERE template_id IN (...)` returning `Record<string, string[]>` (grouped distinct deck slugs per template). 30s stale time.

b. **EoA counts per deck** — within the same hook (or a companion query), fetch `SELECT assigned_deck_slug, COUNT(*) FROM events_actions WHERE assigned_deck_slug IN (...allDeckSlugs) GROUP BY assigned_deck_slug` and attach counts to each deck slug. Final shape: `Record<string, { slug: string; eoaCount: number }[]>`.

c. **"Decks (N)" button** — add to the card footer button row, next to `Campaigns (N)`. Uses `LayoutGrid` icon. Count `N` comes from the batch data.

d. **Popover on click** — opens a `Popover` listing each deck slug with its EoA count, e.g., `no-kings-falmouth (3 EoAs)`. Each slug is a link to `/deck-editor/{slug}`.

### 4. Decision Document

a. Create new file: `docs/decisions/deck-editor/2026-04-05_template-card-deck-campaign-indicators_feature-doc_lovable.md` with `Status: Approved & Implemented`.

---

## Files Changed

- `src/hooks/useTemplateDecks.ts` — new batch hook for deck slugs + EoA counts
- `src/pages/InteractiveTemplates.tsx` — dialog cleanup, batch campaign count query, campaign count on button, deck button + popover
- `docs/decisions/deck-editor/2026-04-05_template-card-deck-campaign-indicators_feature-doc_lovable.md` — new decision doc

## What Does Not Change

- Database schema — no migrations needed; all data is already in `slide_items` and `events_actions`
- `useTemplateCampaigns.ts` — the existing per-template hook remains for the dialog's detailed campaign list; the new batch query is separate and only fetches counts
- Template CRUD logic — no changes to create/update/delete flows
- RLS policies — all tables involved (`slide_items`, `events_actions`) are already publicly readable

