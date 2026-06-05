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
