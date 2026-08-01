# Share composer launches on tap (Email / SMS)

Status: Approved & Implemented
Date: 2026-08-01

## Problem

Tapping the Email or SMS hotspot on a slide did nothing — no mail app, no messages app.

Cause: the handler minted a share token over the network first and only then tried to
navigate to `mailto:` / `sms:`. By the time the URL was ready the browser no longer
treated it as a user gesture, so the navigation was silently refused. Inside a
cross-origin iframe (the preview) there was no escape path at all. `openComposer()`
returned `true` regardless, so the toast claimed "Opening Email" while nothing happened.

## Changes

1. Pre-mint on slide mount
   a. When a slide carries an `sms` and/or `email` hotspot and a viral token is present,
      the share child token is minted once per medium as soon as templates resolve.
   b. The composer URL is built ahead of the tap and stored in component state.

2. Real link handoff
   a. `sms` / `email` hotspots render as `<a href="sms:...">` / `<a href="mailto:...">`
      once the URL is ready — a genuine link tap is honored by every browser and iOS Safari.
   b. If pre-minting failed, the old async on-tap mint path (with the iOS reserved-window
      trick) still runs as a fallback.

3. Honest success reporting
   a. `openComposer()` returns `false` inside a cross-origin iframe when no verifiable
      escape path succeeded, instead of always `true`.
   b. Failure toasts are now persistent (`duration: Infinity`) and carry a tappable link.
   c. `email_links` and `email_support` got the same fallback. Fixed a latent bug where the
      support address was `encodeURIComponent`-ed, corrupting `@`.

4. Tracking
   a. Pre-minted-but-unused tokens are share *intent*, not completed shares — the existing
      lane model already separates these, so Campaign Story and exports are unaffected.
   b. Parentage is unchanged: `mint_share` with the same parent token as before.

## Verification

Playwright against the live deck (`/deck/nk3-lvm-invitation?t=l00-900742-nk3:980219`):

- Desktop UA: `sms:?body=In%201969%2C%20I%20was%20in%20college...` and
  `mailto:?subject=%22Something's%20happening%20here...` present as anchor `href`s.
- iOS UA: SMS href correctly uses the `sms:&body=` separator form.

## Files

- `src/lib/openComposer.ts`
- `src/components/InteractiveSlideOverlay.tsx`
