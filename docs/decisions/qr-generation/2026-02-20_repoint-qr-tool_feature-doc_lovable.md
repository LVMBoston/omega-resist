# Re-point QR Tool

- **Date**: 2026-02-20
- **Author**: Lovable
- **Project Area**: QR Generation / Short URLs
- **Related Feature**: `/repoint-qr` route

## Summary

The Re-point QR Tool allows admins to change the destination URL of an existing short code without altering the short code itself. This means printed QR codes (on cards, flyers, etc.) continue to work but redirect to a different campaign, deck, or EoA.

## Context

Once QR codes are printed and distributed, the short code is permanent. However, operational needs frequently require changing where those codes point — for example, reassigning a batch of cards from one campaign to another, or swapping the deck slug after a new version is published.

Previously this required direct database edits. The Re-point QR Tool provides a safe, auditable UI for the same operation.

## How It Works

1. **List all short codes** — fetches `shortened_urls` and displays them in a searchable table, parsing each `full_url` to show the decoded deck, campaign, and UTM ID.
2. **Open Re-point dialog** — user selects a short code and picks a new Campaign → EoA combination.
3. **URL construction** — the tool rebuilds `full_url` using the same logic as `mint_l00`:
   ```
   https://omega-resist.lovable.app/deck/{deckSlug}
     ?utm_campaign={campaignCode}
     &utm_id={utmId}
     &utm_source=L00
     &utm_medium=qr
     &utm_content={mobilizeCode}-{utmId}
     &t=l00-{mobilizeCode}-{utmId}
     &v_lvl=00
   ```
4. **Override support** — the deck slug and UTM ID can be manually overridden before saving.
5. **Save** — updates `shortened_urls.full_url` (and optionally resets `clicks` to 0).

## Key Design Decisions

- **No new tokens are minted.** The tool only updates the redirect destination; the token embedded in the URL is reconstructed from the EoA's `mobilize_code` and `utm_id`, matching what `mint_l00` would produce.
- **No EoA records are modified.** The tool is read-only with respect to `events_actions`.
- **Avoids `invalidate_tokens_on_critical_change` trigger.** Since only `shortened_urls.full_url` is written (not `events_actions` or `tokens`), the cascade-delete trigger on tokens is never fired.
- **Click reset is opt-in.** By default, the existing click count is preserved so historical analytics remain intact.

## References

- `src/pages/RepointQrTool.tsx` — full implementation
- `src/components/AppSidebar.tsx` — sidebar entry under Tools
- `shortened_urls` table — `full_url` column is the only field written
- `mint_l00` RPC — URL construction logic that the tool mirrors
