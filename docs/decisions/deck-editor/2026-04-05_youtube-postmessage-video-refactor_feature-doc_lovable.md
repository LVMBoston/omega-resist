# YouTube Support + PostMessage Video Refactor

**Status:** Approved & Implemented  
**Date:** 2026-04-05

## Problem

The `@vimeo/player` npm package added ~50KB to the bundle for functionality achievable via the Vimeo postMessage API. Additionally, YouTube videos could not be embedded inline — they opened in a new tab.

## Changes

### 1. Removed `@vimeo/player` npm dependency

All Vimeo iframe control now uses the Vimeo postMessage API (`api=1` query param + `window.postMessage` calls).

### 2. Added `'youtube'` hotspot type

a. `src/types/viralTemplates.ts` — Added `'youtube'` to `HotspotActionType` union.
b. `src/components/FullResolutionHotspotEditor.tsx` — Added `"youtube"` to `IconCategory`, `IconPreset`, `Hotspot` type unions, category maps, `allowMultiple` array, and URL input logic.
c. `src/components/SlidePreviewOverlay.tsx` — Added `youtube: Video` to `ACTION_ICONS`.

### 3. Refactored `InteractiveSlideOverlay.tsx`

a. Replaced `Player` import with raw postMessage calls via `vimeoPost(method, value)` helper.
b. Added `videoProvider` state (`"vimeo" | "youtube" | null`) to track active service.
c. Added `isYouTubeUrl()` and `getYouTubeVideoId()` URL detection helpers.
d. Added `ytPlayerRef` for YouTube IFrame API player instance.
e. Player initialization effect branches on `videoProvider`:
   - **Vimeo**: Creates iframe, listens for `message` events (`ready` → subscribe to `finish`, set volume, play).
   - **YouTube**: Loads YouTube IFrame API script tag, creates `YT.Player` with muted autoplay.
f. `handleVimeoCenterTap` branches on provider for unmute/pause/play.
g. `isActive` and IntersectionObserver effects branch on provider.
h. `closeVideo` destroys both player types and resets all state.
i. `handleExternalLink` intercepts both Vimeo and YouTube URLs for inline playback.
j. `getHotspotAction` handles `"youtube"` case.
k. Hotspot rendering adds YouTube button block parallel to Vimeo.
l. External link intercept checks `isYouTubeUrl` alongside `isVimeoUrl`.

### 4. Refactored `VimeoSlide.tsx`

Replaced `Player` SDK with postMessage approach identical to the overlay. The `iframeRef` stores the raw `HTMLIFrameElement` instead of a `Player` instance. Message handler listens for `ready` and `finish` events.

### 5. No new npm packages

Both Vimeo (postMessage) and YouTube (IFrame API script tag) work without npm dependencies.

## Behavior parity

| Feature | Vimeo (postMessage) | YouTube (IFrame API) |
|---|---|---|
| Muted autoplay | `setVolume: 0` + `play` | `playerVars: { mute: 1, autoplay: 1 }` |
| Tap to unmute | `setVolume: 1` | `player.unMute()` |
| Tap to pause | `pause` | `player.pauseVideo()` |
| Tap to resume | `play` | `player.playVideo()` |
| Pause on slide-away | Same postMessage | Same API calls |
| Resume with sound memory | `vimeoWasUnmutedRef` | Same ref pattern |
| Close on video end | `finish` event | `onStateChange: ENDED` |
| No API key needed | ✓ | ✓ |

## Files changed

- `src/types/viralTemplates.ts`
- `src/components/FullResolutionHotspotEditor.tsx`
- `src/components/InteractiveSlideOverlay.tsx`
- `src/components/VimeoSlide.tsx`
- `src/components/SlidePreviewOverlay.tsx`
- Removed: `@vimeo/player` dependency
