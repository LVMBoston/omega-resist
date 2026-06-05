## Goal

Restore the older carousel gesture (tap center to pause/resume, swipe away while paused, swipe back to resume from the same timestamp) for both Vimeo and YouTube videos — without breaking the current iOS native fullscreen behavior.

## What changes for the viewer

1. **Center tap zone** (middle 60% of the video frame)
   a. First tap on a muted autoplaying video → unmutes (existing behavior, preserved).
   b. Tap on a playing, unmuted video → pauses.
   c. Tap on a paused video → resumes from the exact timestamp it was paused at.

2. **Swipe-away / swipe-back resume**
   a. While paused, the user can swipe left or right to another slide.
   b. The video iframe stays mounted in the background (no destroy/recreate), so the player keeps its playhead.
   c. Swiping back to that slide shows the video still paused at the same frame; tapping center resumes from there.

3. **Native player controls untouched**
   a. Vimeo's and YouTube's own control bars (scrub, volume, captions, fullscreen) remain available the way they appear today — typically at the start of playback and after taps that aren't captured by our overlay.
   b. No custom "summon controls" button. No custom CC button. No custom fullscreen button. iOS native fullscreen continues to work via the player's own fullscreen control.

## What does NOT change

- Autoplay-muted-on-mount behavior
- iOS native fullscreen support added in the prior change
- Caption tracks (handled by the native player as today)
- Hotspot rendering on video slides
- Snapshot/static rendering rules

## Technical notes

4. **Files touched**
   a. `src/components/decks/slides/VimeoSlide.tsx` — add a transparent center tap-zone div over the iframe; wire to existing 3-state machine (`muted-playing` → `unmuted-playing` → `paused`). On resume, do not seek; just call `player.play()` — Vimeo retains position on pause.
   b. `src/components/decks/slides/YouTubeSlide.tsx` — same treatment using YouTube IFrame Player API (`playVideo`, `pauseVideo`, `unMute`). YouTube also retains position on pause, no manual seek required.
   c. `src/components/decks/InteractiveSlideOverlay.tsx` — mirror the same center tap-zone for Vimeo and YouTube hotspot videos.

5. **Swipe-back resume mechanics**
   a. Confirm the carousel keeps non-active slides mounted (current Embla/whatever-carousel config). If it does, no change needed beyond keeping iframe alive.
   b. If non-active slides are unmounted, switch to a `display: none` approach for video slides so the iframe survives slide changes. Verify which is the case during implementation; if iframes are already persistent, skip this sub-step.

6. **Tap-zone geometry**
   a. Absolutely-positioned div, centered, 60% width × 60% height of the video frame, `z-index` above the iframe.
   b. `pointer-events: auto` only on the tap-zone; the surrounding 20% margin on each side lets taps fall through to the native player controls (which live in the bottom bar and corners).
   c. Uses the existing mobile touch-click guard pattern to avoid double-firing.

7. **State machine (unchanged shape, re-wired)**
   ```text
   muted-playing  --tap-->  unmuted-playing
   unmuted-playing --tap-->  paused
   paused          --tap-->  unmuted-playing (resumes at saved position)
   ```

## Risks and how they're handled

8. **Risk: carousel unmounts off-screen slides.** If true, swipe-back would restart the video. Mitigation in step 5b. If mitigation has side effects (memory, autoplay of other slides), fall back to "swipe-back restarts from 0" and call that out before shipping.

9. **Risk: tap-zone swallows a tap meant for native controls.** Mitigation: keep the zone to the middle 60% so the player's own control bar (bottom) and corner controls stay tappable.

10. **Risk: YouTube on iOS shows its own large center play button when paused, possibly intercepting the resume tap.** If observed during verification, lower the YouTube tap-zone's z-index below the player's own play button so YouTube's button wins when visible, and our tap-zone wins during playback. Document the outcome.

## Verification (required before "done")

11. On a physical iPhone in Safari:
    a. Open a deck with a Vimeo slide → confirm autoplay muted → tap center → audio on → tap center → pauses → swipe to next slide → swipe back → still paused at same frame → tap center → resumes from same frame.
    b. Repeat for a YouTube slide.
    c. Tap player's own fullscreen control → confirm iOS native fullscreen still works.
    d. Repeat (a) and (b) for a hotspot-launched video inside `InteractiveSlideOverlay`.

12. On desktop Chrome: same flow, confirm hover-summoned native controls still appear.

## Decision doc

13. This plan updates the existing decision document `docs/decisions/vimeo/2026-06-05_vimeo-native-controls-ios-fullscreen_feature-doc_lovable.md` — append as a new `## Update — 2026-06-05` section, rename the file to today's date, keep prior content intact, add `Status: Approved & Implemented` once verification passes.
