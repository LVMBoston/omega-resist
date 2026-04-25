# Per-Deck Deployment Status

**Status**: Approved & Implemented
**Date**: 2026-04-25

## Summary

Redefined "Deployed" as a **per-deck** property instead of a derived per-campaign value. A campaign that uses multiple decks now shows one status row per deck (Draft / Live / Pending Deploy), and re-deploying one deck does not affect the status of the other decks in the same campaign.

## Why

- Campaigns can use multiple decks (different EOAs → different `assigned_deck_slug`); decks can be used by multiple campaigns.
- The old "Deployed {date}" badge was derived from `MAX(tokens.minted_at)` across all the campaign's EOAs, so editing any one deck silently changed the campaign-level timestamp.
- Re-deploys delete and re-insert L00 token rows with the same deterministic token string, which **does not invalidate any tokens** (QR codes, viral L01–L03 chains all continue to work). Token mint times are therefore the wrong source of truth for "deployed at".

## Changes

### Database
- Added `decks.last_deployed_at timestamptz` and `decks.last_modified_at timestamptz`.
- Trigger `slide_items_touch_deck` (AFTER INSERT/UPDATE/DELETE on `slide_items`) updates `decks.last_modified_at = now()` for the affected deck.
- Backfilled `last_deployed_at` from `MAX(tokens.minted_at)` per deck (level 0, not deleted).
- Backfilled `last_modified_at` from `decks.updated_at`.

### Status derivation (`src/lib/deckStatus.ts`)
- `Draft` → never deployed AND no usage.
- `Live` → `last_deployed_at IS NOT NULL AND last_modified_at <= last_deployed_at`.
- `Pending Deploy` → modified after last deploy.

### UI
- **CampaignManager**: replaced the single "Deployed/Ready to Deploy" badge with a per-deck status row, one line per deck the campaign uses, each with its own Deploy button when needed. Roll-up summary above the rows.
- **DeckEditor header**: status badge next to the deck slug.
- **DeploymentConfirmDialog**: copy clarified — per-deck scope, explicit note that no tokens are invalidated.
- **DeckEditor.handleDeployConfirm**: stamps `decks.last_deployed_at = now()` after successful mint.
- **CampaignManager per-deck Deploy**: also stamps `decks.last_deployed_at` so the Live timestamp updates immediately.

## What Did Not Change

- Token minting logic, deterministic L00 token strings, viral child preservation.
- Existing QR codes — re-deploying keeps the same short URLs and token strings.
- The `deck_versions` table.

## Out of Scope (Future)

- Per-EOA deploy state inside the Campaign EOA manager.
- Auto-deploy on save.

## Update — 2026-04-25 (Consolidated Deck UI on Campaign Cards)

**Status**: Approved & Implemented

### What changed
The two stacked deck areas on each Campaign Manager card (the "View N Slide Decks" button/dropdown and the per-deck status list) were merged into a single per-deck list. Each row now contains:

- Status dot (green = Live, amber = Pending Deploy, muted = Draft) with tooltip showing the full status label and last-deployed timestamp
- Deck slug (monospaced, truncated, full slug on hover)
- Slide count (e.g. `12 slides`)
- EoA scope (e.g. `3 EoAs`) — number of campaign EoAs assigned to this deck
- View icon button (Eye) — opens the existing thumbnail dialog
- Edit icon button (Pencil) — navigates to `/deck-editor/{slug}`
- Deploy button — only when status is Pending or (Draft with affected EoAs)

A single summary line above the rows (e.g. `3 decks · 2 Live, 1 needs deploy`) replaces both the old "View N Slide Decks" label and the old "X of Y decks need deploy" line.

### Implementation
- File: `src/pages/CampaignManager.tsx` only.
- Extended the existing decks fetch to also count `slide_items` rows per deck (single grouped query, parallelized with the deck metadata query via `Promise.all`).
- Added `slideCount: number` to the `DeckStatusRow` interface.
- Removed unused imports: `DropdownMenu*`, `ChevronDown`, `statusBadgeClasses`.

### Empty / not-ready states
- No decks assigned → single muted "No deck assigned" row.
- EoAs not ready → existing amber "Not Ready (X/Y EoAs)" badge retained.

### Out of scope
- Slide-count badge does not yet honor `skip_deploy = true` filtering; it counts all `slide_items`. Acceptable for the at-a-glance hint.
