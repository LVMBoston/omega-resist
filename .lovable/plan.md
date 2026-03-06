

# Re-Mint EoA Tool — Expand Re-point QR Page

**Status:** Draft  
**Date:** 2026-03-06

---

## 1. Problem

When an EoA is duplicated with protected fields (mobilize_code, utm_id) and the admin needs to change the assigned deck, the `invalidate_tokens_on_critical_change` trigger fires and cascade-deletes all tokens. The admin then needs to re-mint L00 tokens. There is no dedicated UI workflow for this "change deck + re-mint" operation.

## 2. Solution

Add a **"Re-Mint EoA"** section to the existing `/repoint-qr` page (renamed to something like "QR & Token Tools"). This section provides a wizard that:

1. Selects a Campaign → EoA
2. Shows current deck assignment and token status
3. Lets the admin pick a new deck
4. Updates `events_actions.assigned_deck_slug` (which triggers token deletion)
5. Immediately re-mints the L00 token via the `mint_l00` RPC
6. Optionally re-points any existing short codes to the new URL

## 3. Scope

### 3a. Page rename and layout
- Rename page title from "Re-point QR Codes" to "QR & Token Tools"
- Add a `Tabs` component with two tabs: **Re-point QR** (existing wizard) and **Re-Mint EoA** (new)

### 3b. Re-Mint EoA wizard (new tab)
- **Step 1:** Select Campaign → filter EoAs for that campaign
- **Step 2:** Select EoA → display current `assigned_deck_slug`, token status (has L00? minted_at?), and mobilize_code/utm_id (read-only)
- **Step 3:** Select new deck from available decks dropdown
- **Step 4:** Confirm — shows warning that existing tokens will be deleted, then:
  - a. Updates `events_actions.assigned_deck_slug` (trigger deletes tokens)
  - b. Calls `mint_l00` RPC with the new deck slug
  - c. Optionally calls `shorten_url` to create/update the short URL
  - d. Shows the new token and short URL on success

### 3c. Data fetched
- Reuse existing `campaigns`, `eoas` state already loaded in the component
- Add: `decks` (slug list), `tokens` (to show current L00 status per EoA)

### 3d. Safety guardrails
- Show the existing L00 token string and minted_at before proceeding
- Require typed confirmation ("RE-MINT") if tokens exist for the EoA
- Display count of child tokens (L01-L03) that will also be lost
- After re-mint, show the new token string and offer "Copy URL" / "Copy Short URL"

## 4. Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/RepointQrTool.tsx` | Add Tabs layout, new Re-Mint tab with wizard, fetch decks + tokens |
| 2 | `src/components/AppSidebar.tsx` | Update label from "Re-point QR" to "QR & Token Tools" (same route) |

## 5. Risk Assessment

- **Medium risk** — the re-mint operation intentionally triggers token deletion. The typed confirmation and child-token count display mitigate accidental data loss.
- **No schema changes** — uses existing `mint_l00` RPC, existing trigger behavior, and existing tables.
- **Token deletion is irreversible** — the warning must be prominent and accurate.

