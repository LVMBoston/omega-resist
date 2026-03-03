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

## Out of scope

- Resume-from-timestamp (replay from start by design).
- MP4 direct upload, GIF restart logic, link slide type.
