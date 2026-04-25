
# Per-Deck Deployment Status — Rework

## 1. Problem

Today "Deployed {timestamp}" on a campaign card is derived from the **most recent L00 token mint** across all that campaign's EOAs. This conflates two different things:

- a. A **campaign** going live for the first time (initial mint).
- b. A **deck** being modified and re-published (which only re-mints L00 rows for EOAs assigned to that deck).

Because one campaign can use multiple decks (e.g. Deck A on EOAs 1–3, Deck B on EOAs 4–6), and one deck can be used by multiple campaigns, a single campaign-level "Deployed" badge cannot honestly represent state. Editing Deck A should not change the displayed deployment status of EOAs using Deck B.

Additionally, every deploy resets `tokens.minted_at`, which means the campaign-level "Deployed {date}" no longer reflects when the campaign first went live — it reflects whichever deck was most recently re-deployed. We need a deck-scoped source of truth.

## 2. Token Behavior on Deploy (clarification)

Re-deploying a deck **does not invalidate any tokens**:

- a. L00 token strings are deterministic (`l00-{mobilize_code}-{utm_id...}`), so the deploy deletes and re-inserts the L00 row with the **same string** — existing QR codes keep working.
- b. L01–L03 viral child tokens are preserved (they reference parent by string, which is unchanged).
- c. Slide content (images, hotspots, ordering) is read **live** at view time from `slide_items`; saving alone (without deploy) is enough for the next scan to show new content.
- d. The only thing the deploy actually does to tokens is reset `minted_at` on the L00 rows and re-render snapshots — it is essentially a "publish" action, not an invalidation.

This means we need a separate, deck-scoped timestamp to mean "deployed at" — `tokens.minted_at` is the wrong source of truth.

## 3. New Definition of "Deployed"

**"Deployed" is a per-deck property: the timestamp of the most recent successful publish of that deck.**

- a. **Draft** → deck has no EOAs assigned and no L00 tokens.
- b. **Live** → `last_deployed_at IS NOT NULL AND last_modified_at <= last_deployed_at`.
- c. **Pending Deploy** → `last_modified_at > last_deployed_at` (changes saved, deploy not yet run).
- d. Re-deploying a Live deck simply updates `last_deployed_at` to now; tokens and QR codes are unaffected.

## 4. Data Model Changes

a. Add `decks.last_deployed_at timestamptz NULL` — set by the deploy flow on success.
b. Add `decks.last_modified_at timestamptz NULL` — set on any `slide_items` insert/update/delete.
c. Trigger `slide_items_touch_deck` (AFTER INSERT/UPDATE/DELETE on `slide_items`) updates `decks.last_modified_at = now()` for the affected `deck_slug`.
d. Seed `last_deployed_at` from existing L00 token mint times in the same migration (one-time backfill via the data tool):
   ```sql
   UPDATE decks d
   SET last_deployed_at = sub.max_minted
   FROM (
     SELECT deck_slug, MAX(minted_at) AS max_minted
     FROM tokens
     WHERE level = 0 AND deleted_at IS NULL
     GROUP BY deck_slug
   ) sub
   WHERE d.slug = sub.deck_slug;
   ```
e. Status itself is **derived in the UI**, not stored.

## 5. UI Changes

### 5a. Campaign Card (CampaignManager)
Replace the single "Deployed {date}" badge with a **per-deck status row**, one line per deck the campaign uses:

```text
Deck: samizdat-deck-3      [Live • Mar 5]
Deck: ice-takedown-v2      [Pending Deploy]   [Deploy]
Deck: town-hall            [Draft]
```

- Each row is clickable and opens the Deck Editor for that deck.
- The campaign-level "Deploy" button is removed; deployment is per deck (from the row, or from the Deck Editor save flow which already exists).
- Roll-up at the top of the card: e.g. `2 of 3 decks Live` or `1 deck needs deploy`.

### 5b. Deck Editor (header)
Show the deck's current status badge in the header next to the deck name (Draft / Live / Pending Deploy). On save with `hasDeployedTokens`, the existing `DeploymentConfirmDialog` continues to fire.

### 5c. Deck Management list
Add a `Status` column with the same three-state badge plus `Last deployed` timestamp. Sortable.

### 5d. DeploymentConfirmDialog copy
Tighten the dialog to make per-deck scope explicit and remove the misleading "new tokens" framing:
- a. Title: "Deploy {deck-slug}?"
- b. Body: "This deck is used by **{eoaCount} events** across **{campaigns.length} campaigns**. Re-deploying refreshes their published content. Existing QR codes and viral links keep working — no tokens are invalidated."

## 6. Technical Details

- a. Migration adds two nullable timestamp columns to `decks` and the `slide_items_touch_deck` trigger.
- b. Backfill of `last_deployed_at` runs as a one-shot data update via the insert tool after the schema migration.
- c. Edge function `deploy-template-snapshots` and `handleDeployConfirm` in `DeckEditor.tsx`: on success, `UPDATE decks SET last_deployed_at = now() WHERE slug = $1`.
- d. New helper `src/lib/deckStatus.ts` exporting `getDeckDeploymentStatus(deck) → { status: 'draft' | 'live' | 'pending', lastDeployedAt }`.
- e. CampaignManager fetch extended to join `decks` for each unique `assigned_deck_slug` of the campaign.

## 7. What Does Not Change

- Token minting logic, short URL behavior, snapshot rendering pipeline.
- Existing QR codes — re-deploying keeps the same short URLs and token strings working.
- The `deck_versions` table (left as-is for future versioning work; not used here).

## 8. Out of Scope (future)

- Per-EOA deploy state inside the campaign EOA manager (which 3 of 12 EOAs are stale).
- Auto-deploy on save (we keep the explicit confirm dialog).

## 9. Decision Log

This is a **new** plan. On approval, archive as
`docs/decisions/decks/<YYYY-MM-DD>_per-deck-deployment-status_feature-doc_lovable.md`.
