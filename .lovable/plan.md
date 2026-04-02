

# Fix: Vimeo Tap-to-Pause Not Working

## Problem

Clicking/tapping the video area does not pause, unmute, or otherwise control the Vimeo player. The custom tap-zone button appears to not receive events, or `handleCenterTap` / `handleVimeoCenterTap` fires but with stale state.

## Root Cause Analysis

There are two likely causes, and both should be fixed:

1. **The Vimeo iframe container (`videoContainerRef`) does NOT have `pointer-events: none`**, only the iframe element inside it does (set via JS). The container div sits at `z-index: 1` and covers the full area (`absolute inset-0`). While the tap button is at z-30 (or z-[10000]), the container div itself can still intercept mouse/touch events before they reach the button — the iframe's `pointer-events: none` only prevents the iframe from getting events, not its parent div.

2. **The Vimeo Player SDK may reset `pointer-events` on the iframe** after initialization. The `pointer-events: none` is set once via JS before `new Player(iframe)` is called, but the SDK could override iframe styles during setup.

## Plan

### 1. Add `pointer-events: none` to the video container div

In **both** `VimeoSlide.tsx` (line 194-198) and `InteractiveSlideOverlay.tsx` (line 833-837):

Change the video container from:
```jsx
<div ref={videoContainerRef} className="absolute inset-0 w-full h-full bg-black" style={{ zIndex: 1 }} />
```
to:
```jsx
<div ref={videoContainerRef} className="absolute inset-0 w-full h-full bg-black pointer-events-none" style={{ zIndex: 1 }} />
```

This ensures neither the container nor the iframe inside it can intercept clicks meant for the tap button.

### 2. Add explicit `pointer-events: auto` to the tap button

In **both** files, add `pointer-events-auto` to the center tap button's className to be explicit:
```jsx
<button
  ...
  className="absolute inset-y-0 left-[15%] w-[70%] z-30 bg-transparent border-none cursor-pointer pointer-events-auto"
  ...
/>
```

### 3. Re-apply `pointer-events: none` on iframe after Player init

In `createPlayer()` (VimeoSlide) and the init `useEffect` (InteractiveSlideOverlay), after `new Player(iframe, ...)`, re-assert the style:
```js
const player = new Player(iframe, { muted: true, autoplay: true });
// Re-apply in case SDK overrides it
iframe.style.pointerEvents = 'none';
```

### 4. Browser verification (required by project rules)

After implementing, navigate to `/deck/no-kings-falmouth`, swipe to slide 2, tap the vimeo hotspot to open the video, then:
- a. Tap center → should unmute (Volume icon feedback)
- b. Tap center → should pause (Pause icon feedback)
- c. Tap center → should resume (Play icon feedback)
- d. Screenshot + console logs as evidence

### 5. Update decision doc

Append a new `## Update — 2026-04-02 (c)` section to `docs/decisions/deck-editor/2026-03-03_vimeo-slide-type_feature-doc_lovable.md` documenting the pointer-events fix.

## Files Changed

- `src/components/VimeoSlide.tsx` — steps 1, 2, 3
- `src/components/InteractiveSlideOverlay.tsx` — steps 1, 2, 3
- `docs/decisions/deck-editor/2026-03-03_vimeo-slide-type_feature-doc_lovable.md` — step 5

