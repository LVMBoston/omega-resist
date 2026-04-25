## Consolidate Deck Sections on Campaign Cards

Today each campaign card has **two** stacked deck areas: a "View N Slide Decks" button/dropdown and a per-deck status list below it. This plan merges them into one scannable per-deck list.

---

### 1. Unified deck row

Replace both areas with a single section labeled "Decks (N)". Each deck gets one row containing, left → right:

a. **Status icon** — small colored dot matching the existing status (Live = green, Pending = amber, Draft = muted), with a tooltip showing the full status label and last-deployed timestamp.
b. **Deck name (slug)** — monospaced, truncates with `title` attribute for full slug on hover.
c. **Slide count** — small muted hint, e.g. `12 slides`. Requires preloading slide counts per deck (see Technical Notes).
d. **EoA-scope annotation** — small muted `(N EoAs)` so the deploy scope is visible before clicking.
e. **View icon button** (`Eye`) — opens the existing thumbnail dialog (calls `handleViewDeck(e, slug)`).
f. **Edit icon button** (`Pencil`) — navigates to `/deck-editor/{slug}`.
g. **Deploy button** — only when status is `pending` or (`draft` with affected EoAs). Same `handleDeployDeck` logic as today.

The row stops click propagation so clicks don't trigger card-level navigation.

### 2. Section header / summary

One concise summary line above the rows replaces both the current "View N Slide Decks" button label and the current "X of Y decks need deploy" line:

- `3 decks · 2 Live, 1 needs deploy` (mixed)
- `2 decks · All Live` (all live)
- `1 deck · Draft` (single draft)

### 3. Empty / not-ready states

a. **No decks assigned** — show a single muted disabled row: "No deck assigned".
b. **EoAs not ready** — keep the existing amber "Not Ready (X/Y EoAs)" badge under the deck list when there are no deck statuses but the campaign has unready EoAs.

### 4. Technical notes

a. **Slide count source** — extend the existing decks fetch (around line 322 in `CampaignManager.tsx`) to also pull a slide count per deck. Easiest path: a single grouped query against `slide_items` filtered to the collected `deckSlugs`, mapped into the same `deckMetaBySlug` map and threaded into each `DeckStatusRow`. No new state; one extra query during the existing load flow.
b. **Files touched** — only `src/pages/CampaignManager.tsx`. Replace lines ~1007–1119 (the two deck blocks inside `SortableCampaignCard`). Reuse `handleViewDeck`, `handleDeployDeck`, `navigate('/deck-editor/...')`, `deploymentState.deckStatuses`, and `deckSlugs`. Add `slideCount` to the `DeckStatusRow` type.
c. **No schema changes, no auth changes, no new routes.**

### 5. Decision-doc follow-up

After implementation, append an `## Update — 2026-04-25` section to `docs/decisions/decks/2026-04-25_per-deck-deployment-status_feature-doc_lovable.md` documenting the consolidated UI. This builds on the existing per-deck-deployment-status decision rather than starting a new one.
