
# REFRIG Icon — Printable QR Sheet

**Status:** Proposed
**Date:** 2026-06-29

## 1. Scope

Add a new share action, REFRIG, that sits alongside EMAIL and SMS on deck slides. One tap downloads a printable PNG containing a single large QR code plus short instructions. The QR points to a lineage-aware landing page where the scanner picks View / Email / Text. REFRIG behaves like EMAIL/SMS for level math (no transparent-hop special case).

## 2. Decisions locked from Q&A

a. **URL model:** keep opaque `t=<token>` — no new `r/p/s` URL params. Lineage stays in the `tokens` DB row. The existing `p=<parent_token>` that `mint_share` already appends to L01+ URLs is kept as-is (debugging breadcrumb only).
b. **Render location:** new edge function `render-refrig-sheet` returns the composed PNG.
c. **Level math:** REFRIG increments level exactly like EMAIL/SMS via existing `mint_share` RPC, capped at L03.
d. **Layout:** one large QR → landing page with three buttons (View / Email / Text).

## 3. User flow

a. Tom adds a REFRIG hotspot to a slide (new action type, picks an icon, no other config).
b. Grandma (viewing as L01 instance) taps REFRIG.
c. Client calls `mint_share(parent_token = grandma.token, utm_medium = 'refrig')` → gets a new L02 token.
d. Client calls edge function `render-refrig-sheet?token=<new-token>` → receives a PNG.
e. Browser triggers download as `fridge-sheet.png`. Event logged: `refrig_generated`.
f. Grandma prints, tapes to fridge. Tina scans → lands on `/fridge/<token>` showing three buttons.
g. Tina taps View → opens the deck via existing `/deck/<slug>?...&t=<token>` route (mints L03 instance on first view via existing logic). Email/Text buttons open Tina's mail/SMS composer prefilled with the existing campaign template; body contains the same `t=<token>` deck URL.

## 4. Data model changes

a. **`url_events.event_type` CHECK constraint:** extend from `('scan','view','share')` to add `('refrig_generated','refrig_scanned')`. Update `log_event()` validation list to match.
b. **`tokens.utm_medium`:** allow value `'refrig'` in `mint_share()` medium whitelist (currently rejects anything outside `em/sms/tx/social/p2p/fb/bs/li/x`).
c. **No new tables.** The share-event-id concept maps 1:1 to the newly-minted token row — no separate `share_events` table needed.
d. **GRANTs:** none new — all access is via existing SECURITY DEFINER RPCs.

## 5. Code changes

a. `src/types/viralTemplates.ts` — add `'refrig'` to `HotspotActionType` union.
b. `src/lib/hotspotClassification.ts` — add `'refrig'` to `ACTION_HOTSPOT_TYPES`.
c. `src/components/InteractiveSlideOverlay.tsx` — add `handleRefrig` (mint share → call edge function → download blob → log `refrig_generated`).
d. `src/components/FullResolutionHotspotEditor.tsx` + `SlidePreviewOverlay.tsx` — add REFRIG to icon picker and preview placeholder.
e. New icon asset: `src/assets/refrig-icon.svg` plus PNG fallback for iOS (matches existing email/sms icon parity pattern).
f. `src/lib/virality/deriveUtmMedium.ts` + tests — recognize `refrig` so dashboards label it correctly.

## 6. New edge function: `render-refrig-sheet`

a. Input: `?token=<l0x token>`.
b. Validate token exists; fetch `deck_slug`, `utm_campaign` for label text.
c. Build landing URL: `https://omega-resist.lovable.app/fridge/<token>`.
d. Generate QR via Deno-compatible `qrcode` package; render to a 1275×1650 canvas (letter @ 150 DPI — readable, ~8MB).
e. Compose: campaign title, big QR (~700px square, centered), instruction text ("Scan with your phone camera to share this campaign"), small printed URL below for accessibility.
f. Return `image/png` with `Content-Disposition: attachment; filename="fridge-sheet.png"`. CORS per project standard.

## 7. New route: `/fridge/:token`

a. New page `src/pages/FridgeLanding.tsx` — reads token, fetches deck_slug + campaign name, shows three large buttons:
   - **View this campaign** → navigates to `/deck/<slug>?...&t=<token>`
   - **Email this to a friend** → opens `mailto:?subject=...&body=...{deck_url}...` using existing email template
   - **Text this to a friend** → opens `sms:?body=...{deck_url}...` using existing SMS template
b. On landing, fire `log_event(token, 'refrig_scanned')` once (guard via sessionStorage flag against StrictMode/back-button double-fire).
c. All three buttons use the SAME `t=<token>` — the level increment happens only when the deck is actually viewed (existing view-mint logic). Share-event = the REFRIG hop; the three buttons are just the recipient's channel choice.

## 8. Risk register

a. **CHECK constraint migration on `url_events`** — low risk, but every consumer that filters on event_type must keep working. Audit: `daily_aggregates`, `useLiveMetrics`, `get_campaign_map_events`, `render-stats-snapshot`. None should accidentally count `refrig_*` as views.
b. **`mint_share` medium whitelist** — function throws on unknown mediums; missing this line silently breaks the feature.
c. **Edge function PNG size** — ~400KB–1MB. Fine over LTE.
d. **QR density on old phones** — single QR at ~700px encoding ~80-char URL scans reliably arms-length on a 5-year-old iPhone.
e. **Double-event risk** on `/fridge/:token` — sessionStorage guard.
f. **No regression to existing URLs** — opaque `t=` retained; every QR in the wild keeps working.

## 9. Test plan (six personas)

a. **Tom:** REFRIG icon appears in hotspot picker, places on slide, saves, renders in editor preview.
b. **Jane:** existing L00 blast unchanged — verify by minting one and scanning.
c. **Grandma (L01):** tap REFRIG → PNG downloads → scan with phone camera → lands on `/fridge/<token>`. `refrig_generated` logged once, `refrig_scanned` logged once.
d. **Tina:** scans Grandma's sheet → tap View → opens deck → instance minted at L02. Verify `parent_token = grandma`, `level = 2`, `utm_medium = 'refrig'` on Tina's row.
e. **Cathy:** Tina REFRIGs to Cathy → L03.
f. **Judy:** Cathy REFRIGs to Judy → still L03 (cap holds via existing `LEAST(_parent_level + 1, 3)`).
g. **Dashboards:** confirm `refrig_*` events do NOT pollute the View count metric; REFRIG-origin tokens appear in chain visualization with `utm_medium = 'refrig'`.
h. **Print test:** one sheet, scan with iPhone 8 — readable.

## 10. Out of scope for v1

a. Final visual design of the printable sheet (ship a clean default).
b. Final REFRIG icon art (Lucide fridge icon as placeholder).
c. Dedicated REFRIG analytics dashboard (data captured, UI later).
d. Server-side email send of the sheet (no domain yet).

## 11. Decision log archival

This is a **new** plan. On implementation, archive to:
`docs/decisions/refrig/2026-06-29_refrig-printable-qr-sheet_feature-doc_lovable.md`
