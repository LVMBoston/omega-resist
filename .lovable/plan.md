

# Re-point QR Code Tool

## Overview

Build an admin page to re-point existing short codes to new destinations, plus handle the immediate need: re-point short code `4aa7a3` (printed on cards as `/s/4aa7a3`) with updated UTM parameters.

## Current State of `4aa7a3`

| Field | Current Value |
|-------|--------------|
| short_code | `4aa7a3` |
| clicks | 2 |
| full_url | `.../deck/renee-good1?utm_campaign=rs-good-1&utm_id=rsg1_qr&utm_content=Z64776-rsg1_qr&t=l00-Z64776-rsg1_qr&v_lvl=00` |
| EoA | `c2754ef6` (mobilize_code: `Z64776`, utm_id: `rsg1_qr`) |

## What Gets Built

### 1. New Page: `src/pages/RepointQrTool.tsx`

**Features:**
- Table listing all `shortened_urls` rows with parsed fields (deck, campaign, utm_id, clicks)
- Search/filter by short code or deck slug
- "Re-point" button opens a dialog with:
  - Current destination details (read-only)
  - Campaign selector (dropdown)
  - EoA selector (filtered by selected campaign)
  - Deck override (auto-filled from EoA's `assigned_deck_slug`, editable)
  - UTM ID override (auto-filled from EoA's `utm_id`, editable -- this is where you can change `rsg1_qr` to `qr`)
  - Live preview of the new `full_url`
  - Checkbox: "Reset click count to 0"
- Confirm button updates `shortened_urls.full_url` (and optionally `clicks`)
- Toast confirmation with before/after summary

**URL construction logic** (mirrors `mint_l00`):
```text
https://omega-resist.lovable.app/deck/{deck_slug}
  ?utm_campaign={campaign.code}
  &utm_id={utm_id}
  &utm_source=L00
  &utm_medium=qr
  &utm_content={mobilize_code}-{utm_id}
  &t=l00-{mobilize_code}-{utm_id}
  &v_lvl=00
```

### 2. Route and Navigation

- **`src/App.tsx`**: Add `/repoint-qr` route with `ProtectedRoute requiredRole="admin"` and sidebar layout
- **`src/components/AppSidebar.tsx`**: Add "Re-point QR" item under Admin section with `QrCode` or a distinct icon

### 3. No Database Changes Required

- `shortened_urls` already allows admin UPDATE via RLS
- No new tables, columns, or migrations needed

## Technical Notes

- The tool does NOT mint a new token row -- it only updates the redirect destination string. If you need tracking tokens to exist, mint them separately via the EoA manager first.
- The `invalidate_tokens_on_critical_change` trigger will fire if you later update `utm_id` on the EoA record itself, deleting associated tokens. The re-point tool avoids this by only touching `shortened_urls`.
- The editable UTM ID field in the dialog lets you type `qr` instead of the EoA's stored `rsg1_qr`, so the baked URL reflects the new value without modifying the EoA record.

## Files

| File | Action |
|------|--------|
| `src/pages/RepointQrTool.tsx` | Create |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add nav item |

