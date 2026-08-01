## What you see, and what the code does

When you tap Email or SMS on a slide, the app first calls the server to mint a fresh share token, and only *afterwards* tries to send the browser to `mailto:`/`sms:`. By then the browser no longer treats it as "the user clicked something", so the jump is silently refused. Worse, `openComposer` returns `true` even when the navigation was refused, so the toast says "Opening Email" while nothing happens.

Inside the Lovable preview (and any embed) there is a second blocker: the page runs in a cross-origin iframe, so `window.top.location`, `window.open(..., "_top")` and popups can all be blocked, leaving no path out.

Unverified until I can drive the live page: which of the two blockers is hitting you on this device. Step 1 below confirms it before any behavior change.

## 1. Confirm the failure in the browser

a. Drive the deck viewer with a real share token via Playwright, click Email and SMS, and capture console output plus whether any navigation to a `mailto:`/`sms:` URL is attempted.
b. Record the same for the preview iframe context vs. a direct page load, so we know whether the iframe alone explains it.

## 2. Make the handoff happen on the tap, not after it

a. Pre-mint the share child token when the slide with share hotspots mounts (one per medium: sms, email), so the composer URL already exists before any tap.
b. Render the Email/SMS hotspots as real `<a href="mailto:...">` / `<a href="sms:...">` elements when the URL is ready — a genuine link tap is the one thing every browser and iOS Safari honors.
c. Keep the current async mint path only as a fallback for when pre-minting failed, and keep the reserved-window trick there for iOS.

## 3. Stop reporting success when nothing opened

a. `openComposer` should return `false` when it only managed a blocked assignment, instead of always `true`.
b. When the composer cannot be opened, show a persistent dialog with the full link plus a "Copy" button and a tappable `mailto:`/`sms:` link, instead of a toast that disappears.

## 4. Keep tracking honest

a. Pre-minting means a token is created even if the person never sends the message. Log those as *intent*, not a completed share, so the Campaign Story and export lanes are unaffected.
b. If a pre-minted token goes unused on that slide visit, no second token is minted for the same medium on the same visit.

## 5. Verify before calling it done

a. Re-run the browser test: click Email and SMS, assert a `mailto:`/`sms:` navigation is actually attempted, and screenshot the result.
b. Repeat with an iOS user-agent to confirm the `sms:&body=` form and the link-tap path.
c. Confirm on your own device.

## 6. Decision log

This is a new decision document: `docs/decisions/messaging/2026-08-01_share-composer-launch-on-tap_bug-fix_lovable.md`.

## Technical notes

- Files: `src/lib/openComposer.ts`, `src/components/InteractiveSlideOverlay.tsx`, and the share mint path in `src/lib/virality/mint.ts`.
- No database schema change. Pre-minting uses the existing `mint_share` call with the existing parent-token lineage, so parentage is unchanged.
