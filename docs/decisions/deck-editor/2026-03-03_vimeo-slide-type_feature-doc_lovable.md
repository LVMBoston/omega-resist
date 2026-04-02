# Vimeo Video Slide Type

**Status:** Approved & Implemented  
**Date:** 2026-03-03

## Problem

Embla carousel doesn't handle Vimeo iframes well: videos render small (requiring pinch-zoom) and audio bleeds when swiping away.

## Behavior spec

1. **Default state**: poster image with centered play button.
2. **Tap play**: full-viewport overlay (`fixed inset-0 z-50`) with Vimeo iframe. Close via X button or Escape key.
3. **Navigate away**: `isActive` flips false → `player.destroy()` → overlay closes, audio stops.
4. **Navigate back**: slide resets to poster + play button. Tap starts video from beginning. No resume, no timestamp artifacts.

## Changes

### 1. Database

- Added `media_url text` column to `slide_items` table (stores the Vimeo URL).

### 2. `src/components/VimeoSlide.tsx` — New component

- Props: `contentUrl` (poster), `mediaUrl` (Vimeo URL), `isActive`.
- Renders poster image + play button overlay.
- On play: mounts `fixed inset-0` black overlay with Vimeo iframe using `@vimeo/player`.
- `useEffect` on `isActive`: when false, calls `player.destroy()` and resets to poster state.
- On `ended` event: auto-close overlay.

### 3. `src/pages/DeckViewer.tsx`

- Updated `SlideItem` interface to include `media_url`.
- Added third render branch for `type === "vimeo"`.

### 4. `src/pages/DeckEditor.tsx`

- Updated `Slide` interface to include `media_url`.
- Added "Vimeo" button in sidebar alongside existing controls.
- Dialog prompts for Vimeo URL + poster image.
- Creates slide with `type: "vimeo"`, stores URL in `media_url`, poster in `content_url`.
- Save logic passes `media_url` through to `slide_items` insert.
- Vimeo badge shown on sidebar thumbnails.

## Update — 2026-03-03

### 5. Activated `vimeo` hotspot type in the Interactive Slide Template Editor

The previously disabled "Video" placeholder in the hotspot category grid is now a fully functional `vimeo` category:

- **Type system**: Added `'vimeo'` to `HotspotActionType` in `src/types/viralTemplates.ts`.
- **Editor (`FullResolutionHotspotEditor.tsx`)**: Added `vimeo` to `IconCategory`, `ICON_PRESETS` (using play-button asset), category maps, and the grid. Removed the disabled placeholder button. Shows a "Vimeo URL" input when a vimeo hotspot is selected. Allows multiple vimeo hotspots per slide.
- **Overlay (`InteractiveSlideOverlay.tsx`)**: Added `vimeo` case to `getHotspotAction` and a dedicated render branch that opens the full-viewport inline Vimeo player. Existing `external_link` Vimeo-URL interception remains as a fallback for legacy data.

## Update — 2026-03-03 (b)

### 6. Pause/resume on swipe instead of destroy

Both `VimeoSlide` and `InteractiveSlideOverlay` now **pause** the Vimeo player when the slide scrolls out of view and **resume** playback when the user returns. Previously, navigating away destroyed the player and reset to the poster state.

- **`VimeoSlide.tsx`**: `isActive` effect calls `player.pause()` / `player.play()` instead of `destroyPlayer()`.
- **`InteractiveSlideOverlay.tsx`**: Both the `isActive` effect and the `IntersectionObserver` call `pause()` / `play()` instead of `closeVideo()`.
- The overlay and close (X / Escape / ended) still fully destroy the player as before.

## Update — 2026-03-03 (c)

### 7. Inline autoplay with tap-to-toggle sound & swipe-passthrough

Replaced the full-viewport `fixed inset-0` Vimeo overlay with an **inline player** that sits inside the carousel slide (or inside the hotspot overlay area). This fixes the root cause: the fixed overlay was capturing all touch events, preventing Embla from detecting swipes, so `isActive` never changed.

**New UX model:**

| State | Behavior |
|---|---|
| Slide enters view | Video autoplays **muted** (browser requirement) |
| Tap center (70%) | Unmute → pause → resume → pause (toggle cycle) |
| Swipe (15% edges) | Events pass through to Embla; player pauses, mutes |
| Swipe back | Player resumes, restores previous mute state |
| Video ends | Reset to poster image |
| X / Escape | Destroy player, show poster |

**Layout:** Left/right 15% strips use `pointer-events: none` so Embla carousel receives touch events natively. Center 70% handles tap-to-toggle.

**State machine:** `playerState` cycles through `idle → playing-muted → playing-unmuted → paused`. A `wasUnmuted` ref tracks whether sound should be restored on return.

**Visual feedback:** Brief (1.5s) icon overlay shows Volume/Pause/Play on each tap. Persistent mute indicator in bottom-right when muted.

**Files changed:**
- `VimeoSlide.tsx` — Full rewrite: inline player, state machine, swipe zones
- `InteractiveSlideOverlay.tsx` — Vimeo hotspot uses same inline pattern (absolute, not fixed)
- Embed URL changed to `muted=1` for browser autoplay compliance

## Update — 2026-04-02

### 8. Fix: Disable Vimeo native controls, fix tap-zone z-index

Vimeo's native player controls (`controls=1`) were visible but unclickable because the iframe has `pointer-events: none`. Additionally, the custom tap-zone button could be obscured by the iframe's stacking context.

**Fixes applied to both `VimeoSlide.tsx` and `InteractiveSlideOverlay.tsx`:**

a. Changed embed URL from `controls=1` to `controls=0` — removes Vimeo's native pause/scrub/volume UI since the custom tap-zone handles all interaction.
b. Elevated tap-zone and swipe-passthrough zone z-index above the iframe container (z-30 in VimeoSlide, z-[10000] in InteractiveSlideOverlay).
c. Made the video container `absolute inset-0` with explicit low `z-index: 1` to prevent stacking conflicts.

## Out of scope

## Update — 2026-04-02 (b)

### 9. Fix: Hotspot buttons intercepting Vimeo center-tap clicks

After opening the inline Vimeo player via a vimeo hotspot, the hotspot buttons (with `pointer-events-auto`) remained rendered underneath the video overlay. Despite the overlay being at z-[9999] and center tap zone at z-[10000], the hotspot buttons could still intercept click events in certain stacking contexts, preventing the center tap handler from firing on subsequent taps (unmute worked once, but pause/resume did not).

**Fixes applied to `InteractiveSlideOverlay.tsx`:**

a. Hide the hotspot container (`display: none`) when `isVideoOpen` is true, preventing any hotspot button from capturing clicks meant for the video controls.
b. Added `e.stopPropagation()` to center tap zone `onClick` and `onTouchEnd` handlers in both `InteractiveSlideOverlay.tsx` and `VimeoSlide.tsx` to prevent event bubbling to the carousel.
c. Added diagnostic `console.log` calls to `handleVimeoCenterTap` to aid future debugging.

## Out of scope

- MP4 direct upload, GIF restart logic, link slide type.
