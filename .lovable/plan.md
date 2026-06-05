## What was different

**My approach** kept the existing custom inline player and just added two extra attributes to the iframe:
- `webkitallowfullscreen=""`
- `mozallowfullscreen=""`

These are legacy vendor-prefixed hints. Modern iOS Safari largely ignores them — it decides fullscreen eligibility based on the `allow` permission policy and on whether the iframe is actually allowed to request it, not on those old attributes. So adding them changed essentially nothing on iPhone.

**Gemini's approach** is a cleaner, standards-first embed:

```html
<iframe
  src="https://player.vimeo.com/video/<ID>?h=<HASH>"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen>
</iframe>
```

The meaningful differences vs. what we have today:

1. **`allow="... fullscreen ..."` permission policy** — this is the modern mechanism iOS actually checks. We already set this, so it stays.
2. **No `controls=0`** — our current embed strips Vimeo's native controls so the user has no built-in fullscreen button. iOS only enters fullscreen when the user taps the player's own fullscreen control (or via the Vimeo Player API). With controls hidden, there is no way for the viewer to trigger it.
3. **No `background=0` / minimal query string** — Gemini's URL keeps the standard player intact instead of the stripped-down "kiosk" mode we use.
4. **Preserves the `h=<hash>` privacy token** in the URL — required for unlisted videos; we currently drop it when we rebuild the embed URL from the video ID.

So the real reason fullscreen doesn't work on iOS isn't the missing prefixed attributes — it's that we hide the controls and strip the privacy hash, leaving the user no UI to invoke fullscreen.

## Plan

1. **Update `getVimeoEmbedUrl` in `src/components/VimeoSlide.tsx`**
   a. Preserve the `h=<hash>` query parameter from the original Vimeo URL when present.
   b. Change the embed query string to enable native controls: `?h=<hash>&autoplay=1&muted=1&playsinline=1&controls=1&title=0&byline=0&portrait=0&badge=0&autopause=0&api=1` (keep autoplay-muted so our existing state machine still works on entry, but allow the user to tap Vimeo's built-in fullscreen button).
   c. Keep `allowfullscreen` and `allow="autoplay; fullscreen; picture-in-picture"`. Drop the vendor-prefixed attributes — they don't help.

2. **Mirror the same change in `src/components/InteractiveSlideOverlay.tsx`** for the Vimeo hotspot iframe so behavior is identical whether the video is a slide or a hotspot.

3. **Remove the `pointer-events: none` on the iframe and the custom center tap-zone overlay** in both files, OR keep them but only over the swipe edges — otherwise the user can't reach Vimeo's fullscreen button. Recommended: keep the 15% edge swipe-passthrough zones, drop the 70% center tap-zone, and let Vimeo's own controls handle play/pause/mute/fullscreen. This is the trade-off Gemini's embed implies.

4. **Verify on iPhone** by loading a deck with a Vimeo slide, confirming: (a) video autoplays muted, (b) Vimeo controls are visible, (c) tapping the fullscreen icon enters iOS native fullscreen, (d) swiping the left/right edges still navigates the carousel.

## Trade-off you should weigh before I build

Switching to native Vimeo controls gives you working fullscreen on iOS, but you lose the custom "tap center to unmute → pause → resume" gesture we built. You'd get Vimeo's standard play/pause/scrub/volume/fullscreen UI instead.

**a.** Accept the trade-off — native controls, working fullscreen, simpler code. (Recommended.)
**b.** Keep the custom tap-zone and instead add a dedicated fullscreen button in our own overlay UI that calls the Vimeo Player API's `requestFullscreen()`. More code, preserves current UX.

Tell me a or b and I'll implement. This plan is a **new plan** (not an update to the 2026-03-03 Vimeo slide doc — I'll append it as an `## Update` section there once implemented).