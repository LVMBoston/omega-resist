# Re-Mint EoA Tool — Expand Re-point QR Page

**Status:** Approved & Implemented  
**Date:** 2026-03-06

---

## 1. Problem

When an EoA is duplicated with protected fields (mobilize_code, utm_id) and the admin needs to change the assigned deck, the `invalidate_tokens_on_critical_change` trigger fires and cascade-deletes all tokens. The admin then needs to re-mint L00 tokens. There is no dedicated UI workflow for this "change deck + re-mint" operation.

## 2. Solution

Added a **"Re-Mint EoA"** tab to the existing `/repoint-qr` page (renamed to "QR & Token Tools"). This section provides a wizard that:

1. Selects a Campaign → EoA
2. Shows current deck assignment and token status
3. Lets the admin pick a new deck
4. Updates `events_actions.assigned_deck_slug` (which triggers token deletion)
5. Immediately re-mints the L00 token via the `mint_l00` RPC
6. Optionally creates a short URL for the new token

## 3. Scope

### 3a. Page rename and layout
- Renamed page title from "Re-point QR Codes" to "QR & Token Tools"
- Added `Tabs` component with two tabs: **Re-point QR** (existing wizard) and **Re-Mint EoA** (new)

### 3b. Re-Mint EoA wizard (new tab)
- **Step 1:** Select Campaign → filter EoAs for that campaign
- **Step 2:** Select EoA → display current `assigned_deck_slug`, token status (has L00? minted_at?), and mobilize_code/utm_id (read-only)
- **Step 3:** Select new deck from available decks dropdown
- **Step 4:** Confirm — shows warning that existing tokens will be deleted, then:
  - a. Updates `events_actions.assigned_deck_slug` (trigger deletes tokens)
  - b. Calls `mint_l00` RPC with the new deck slug
  - c. Optionally calls `shorten_url` to create the short URL
  - d. Shows the new token and short URL on success

### 3c. Safety guardrails
- Shows existing L00 token string and minted_at before proceeding
- Requires typed confirmation ("RE-MINT") if tokens exist for the EoA
- Displays count of child tokens (L01-L03) and L00 instances that will be lost
- After re-mint, shows the new token string with "Copy" buttons

## 4. Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/RepointQrTool.tsx` | Added Tabs layout, new Re-Mint tab with wizard, fetch decks + tokens |
| 2 | `src/components/AppSidebar.tsx` | Updated label from "Re-point QR" to "QR & Token Tools" |

## 5. Risk Assessment

- **Medium risk** — the re-mint operation intentionally triggers token deletion. The typed confirmation and child-token count display mitigate accidental data loss.
- **No schema changes** — uses existing `mint_l00` RPC, existing trigger behavior, and existing tables.
- **Token deletion is irreversible** — the warning is prominent and accurate.
