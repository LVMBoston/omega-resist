# Fridge Sheet — Three-QR Redesign

Status: Approved & Implemented
Date: 2026-07-03

## Summary

Replace the single-QR "Refrig" printable sheet with a 5" × 3" landscape
sheet holding three QR codes under the campaign name:

1. **Display Status** — opens a mobile-friendly Campaign Story report.
2. **Text Deck** — opens the phone's SMS composer pre-filled from the
   campaign's SMS template + deck link.
3. **Email Deck** — opens the mail composer pre-filled from the campaign's
   email template + deck link.

## Behavior

a. The "Refrig" hotspot in a deck mints THREE child tokens off the current
   viral token (one each with `utm_medium` = `refrig`, `sms`, `em`) so
   every downstream scan/share is tracked as its own lineage row.
b. Each QR encodes an absolute URL to a lightweight landing route:
   - `/fs/:token` → new page `FridgeStory.tsx`, renders `formatCampaignStory(...)` from `computeCampaignStoryInputs(...)`.
   - `/fx/:token?a=sms` → new page `FridgeShareRedirect.tsx`, resolves the deck link + SMS template, `window.location.href = sms:?body=...`.
   - `/fx/:token?a=em` → same page, resolves the mail template, opens `mailto:?subject=...&body=...`.
c. Templates use the same resolution chain as the deck editor (`resolve_message_template` RPC with L00/L01 voice by viewer level, falling back to global settings).
d. Sheet dimensions: 1500 × 900 px (5" × 3" @ 300 DPI), dark charcoal background, yellow labels, white QR frames — matches user-supplied mockup.

## Files changed

- `src/lib/refrigSheet.ts` — rewrote composer for 3-QR landscape layout.
- `src/components/InteractiveSlideOverlay.tsx` — `handleRefrig` now mints 3 tokens and passes 3 QR specs.
- `src/pages/FridgeStory.tsx` — NEW.
- `src/pages/FridgeShareRedirect.tsx` — NEW.
- `src/App.tsx` — registered `/fs/:token` and `/fx/:token` routes.

## Non-goals

- The pre-existing `/fridge/:token` landing page is left in place for any
  legacy printed sheets already in the wild.
- No schema changes; reuses existing `tokens`, `events_actions`, `settings`,
  and `resolve_message_template` surfaces.
