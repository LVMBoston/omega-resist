# Vimeo Native Controls for iOS Fullscreen

**Status: Approved & Implemented**
**Date: 2026-06-05**

## Problem

iPhone Safari did not enter fullscreen for Vimeo slides. The embed stripped Vimeo's native controls (`controls=0`) and dropped the privacy `h=` hash, leaving the viewer with no UI to invoke fullscreen. iOS Safari has no Fullscreen API for arbitrary elements — fullscreen on Vimeo requires the user to tap the player's own fullscreen button (or the Player API to request it).

## Decision

Option **a** from the plan: switch to Vimeo's native controls and accept the loss of the custom center-tap gesture in exchange for working iOS fullscreen and simpler code.

## Changes

1. `src/components/VimeoSlide.tsx`
   a. `getVimeoEmbedUrl` now preserves `h=<hash>` from the source URL (required for unlisted videos).
   b. Embed query string uses `controls=1` so Vimeo's native UI (incl. fullscreen button) is visible.
   c. Iframe keeps `allow="autoplay; fullscreen; picture-in-picture"` and `allowfullscreen`.
   d. The center 70% tap-zone overlay is `pointer-events-none` so taps reach Vimeo's controls. The 15% left/right edge zones remain for carousel swipe.

2. `src/components/InteractiveSlideOverlay.tsx`
   a. Same `getVimeoEmbedUrl` treatment for Vimeo hotspot videos.
   b. Same center/edge overlay zoning in the video portal.

## Trade-off accepted

Lost: custom "tap center to unmute → pause → resume" gesture on Vimeo slides.
Gained: Vimeo's standard play/pause/scrub/volume/**fullscreen** UI works on iPhone.

## Files Changed

- `src/components/VimeoSlide.tsx`
- `src/components/InteractiveSlideOverlay.tsx`

## Update — 2026-06-05

Status: Approved & Implemented

Restored the older carousel gesture for Vimeo and YouTube videos while preserving the native iOS fullscreen behavior added earlier today.

### What changed

1. **Center tap zone** — A 60% × 60% tap-zone is now rendered over the center of the video. Tapping it:
   a. First tap on a muted autoplaying video → unmutes.
   b. Tap on a playing, unmuted video → pauses.
   c. Tap on a paused video → resumes from the exact timestamp it was paused at (Vimeo and YouTube both retain playhead on pause, so no manual seek is needed).

2. **Swipe-away / swipe-back resume** — Existing `isActive` effect already pauses the player when the slide swipes out of view and resumes it on return. With the new tap-zone the user can now manually pause first, then swipe, then swipe back and tap to resume — same end state.

3. **Native controls preserved** — The surrounding 20% margins (top, bottom, left, right) remain `pointer-events: none` so the player's own control bar (scrub, volume, captions, fullscreen) keeps receiving taps. No custom "summon controls", CC, or fullscreen button was added.

### Files touched

- `src/components/VimeoSlide.tsx` — replaced the inert center divs with a single `onClick={handleCenterTap}` 60%×60% tap-zone. The 3-state handler was already defined and is now wired up.
- `src/components/InteractiveSlideOverlay.tsx` — same change for the hotspot-launched video overlay. Handler `handleVimeoCenterTap` already covered both Vimeo and YouTube branches.

### Verification

To be confirmed on a physical iPhone in Safari:
- Vimeo deck slide: autoplay muted → tap center → audio on → tap center → pauses → swipe to next slide → swipe back → still paused → tap center → resumes at same frame → native fullscreen still reachable via Vimeo's own button.
- Vimeo hotspot video: same flow.
- YouTube hotspot video: same flow (hotspot YouTube embeds have `controls: 0`, so no native bar exists — tap-zone is the only control surface, consistent with prior behavior).

## Update — 2026-06-05 (full-frame tap + swipe)

Status: Approved & Implemented

User reported that during playback (a) swipe-away didn't work because the fullscreen video portal sits above the carousel and absorbs gestures, and (b) the 20% left/right margins didn't toggle pause/play.

Change:
- `VimeoSlide.tsx` and `InteractiveSlideOverlay.tsx`: replaced the 60%×60% center tap-zone with a full-frame zone that excludes only the bottom 15% (so Vimeo's native control bar / fullscreen button stay reachable).
- Added `onTouchStart`/`onTouchEnd` swipe detection (>50px horizontal, > vertical). On swipe, `VimeoSlide` dispatches a click on `[data-carousel-prev]`/`[data-carousel-next]` to drive the Embla carousel; the hotspot overlay version closes the video instead.
- A `_swiped` flag on the element suppresses the trailing synthetic click so a swipe doesn't also pause/resume.
