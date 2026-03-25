# Transparent Hotspot Toggle

**Status: Approved & Implemented**  
**Date: 2026-03-25**

## Problem
Current hotspot icons are brittle — custom PNGs fail on iOS Safari, icons take up visual space, and the icon-rendering pipeline (FallbackImg, per-platform branching) is complex. The user already places visual elements (buttons, logos) directly on their slide images and just needs invisible tap targets over them.

## Solution
Added a per-hotspot `isTransparent` boolean toggle. When enabled:
- **Runtime** (`InteractiveSlideOverlay`): renders the hotspot as a fully transparent clickable area — no icon, no image, just a positioned `<button>`/`<a>` with the same tap target. The action (SMS, email, share, external link, vimeo, email_links) fires identically.
- **Editor** (`FullResolutionHotspotEditor`): shows a dashed border with an EyeOff icon so the author can see and position the hotspot. A "Transparent overlay" Switch toggle appears in the property panel.
- **Preview** (`SlidePreviewOverlay`): shows a faint dashed outline with an EyeOff icon so the template card remains informative.
- **Thumbnail generation**: skips transparent hotspots so generated thumbnails reflect what the end user sees.

## Data model change
Added `isTransparent?: boolean` to the `Hotspot` interface in `src/types/viralTemplates.ts`. No database migration needed — hotspots are stored as JSONB, and the new field defaults to `false`/undefined.

## Files changed

1. `src/types/viralTemplates.ts` — Added `isTransparent?: boolean` to `Hotspot` interface.
2. `src/components/InteractiveSlideOverlay.tsx` — Conditionally skips `getHotspotIcon()` when `hotspot.isTransparent` is true.
3. `src/components/FullResolutionHotspotEditor.tsx` — Added "Transparent overlay" Switch in property panel; editor overlay shows dashed border + EyeOff icon for transparent hotspots; thumbnail generation skips transparent hotspots.
4. `src/components/SlidePreviewOverlay.tsx` — For action hotspots with `isTransparent`, renders a faint dashed outline with EyeOff icon.

## What stays the same
- All hotspot actions work identically regardless of transparency.
- Non-transparent hotspots render exactly as before.
- Live number, chart, and map hotspots are unaffected.
- No database migration required.
