

# Vimeo Slide: Inline Autoplay with Tap-to-Toggle Sound & Swipe Navigation

**Status: Proposed**
**Date: 2026-03-03**

---

## 1. Current problem

The Vimeo overlay (`fixed inset-0 z-50`) captures all touch events, preventing Embla carousel swipes from firing. The `isActive` prop never changes, so pause-on-swipe never triggers.

## 2. New UX model

Remove the full-viewport overlay entirely. The Vimeo player renders **inline** within the carousel slide (no overlay, no poster gate).

| State | Behavior |
|---|---|
| Slide enters view | Video autoplays **muted** |
| Tap center of slide | Unmute; tap again → pause; tap again → resume (toggle cycle) |
| Swipe away | Player pauses, volume muted |
| Swipe back | Player resumes playing, sound restored to previous state |
| Video ends | Reset to poster image |
| X button / Escape | Destroy player, show poster |

Swipe zones (left/right ~15% edges) pass `pointer-events: none` through to the carousel so Embla can detect gestures natively.

## 3. Implementation steps

### 3a. Restructure VimeoSlide layout — no overlay

Replace the `fixed inset-0` overlay with an inline container that sits inside the carousel item. The iframe fills the slide area directly. Add left/right swipe-passthrough strips.

```text
┌──────────────────────────────┐
│ swipe │   Vimeo iframe    │ swipe │
│ zone  │   (tap = toggle)  │ zone  │
│ 15%   │       70%         │ 15%   │
│ ptr:  │   ptr: auto       │ ptr:  │
│ none  │                   │ none  │
└──────────────────────────────┘
```

### 3b. New state machine in VimeoSlide

- `playerState`: `"idle" | "playing-muted" | "playing-unmuted" | "paused"`
- `wasUnmuted`: `boolean` — remembers if user had sound on before swipe-away
- On `isActive` → `true`: create player (muted, autoplay) → state = `playing-muted`
- On tap (center zone): cycle `playing-muted → playing-unmuted → paused → playing-unmuted → paused …`
- On `isActive` → `false`: `player.pause()`, state = `paused`, save `wasUnmuted`
- On `isActive` → `true` again: `player.play()`, restore mute state from `wasUnmuted`

### 3c. Embed URL change

Change `muted=0` → `muted=1` and keep `autoplay=1` in the Vimeo embed URL so autoplay works without user gesture (browsers require muted autoplay).

### 3d. Pass carouselApi or rely on Embla natively

Because the overlay is removed and swipe zones use `pointer-events: none`, Embla receives touch events directly — no need to pass `carouselApi` as a prop. The existing `activeIndex` tracking in `DeckViewer.tsx` continues to work unchanged.

### 3e. Visual feedback

- Show a small mute/unmute icon briefly (1.5s fade) when user taps to toggle sound state.
- Show a pause icon briefly when user taps to pause.

### 3f. Update InteractiveSlideOverlay Vimeo hotspots

Apply the same inline pattern for Vimeo hotspots: when a Vimeo hotspot is tapped, the video plays inline within the overlay area (not a second fixed overlay). Swipe-passthrough strips on the edges. Same tap-toggle behavior.

### 3g. Update decision doc

Append an `## Update — 2026-03-03` section to `docs/decisions/deck-editor/2026-03-03_vimeo-slide-type_feature-doc_lovable.md`.

## 4. Files changed

| File | Change |
|---|---|
| `src/components/VimeoSlide.tsx` | Rewrite: inline player, tap-toggle state machine, swipe-passthrough zones |
| `src/components/InteractiveSlideOverlay.tsx` | Update Vimeo hotspot to use inline player with same pattern |
| `docs/decisions/deck-editor/2026-03-03_vimeo-slide-type_feature-doc_lovable.md` | Append update section |

## 5. What does NOT change

- DeckViewer.tsx carousel setup and `activeIndex` tracking
- DeckEditor.tsx Vimeo slide creation flow
- Database schema (`slide_items.media_url`)
- X button and Escape key still fully destroy the player

