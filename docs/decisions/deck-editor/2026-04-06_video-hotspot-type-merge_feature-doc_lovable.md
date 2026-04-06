# Merge Vimeo & YouTube into Unified "video" Hotspot Type

**Status: Approved & Implemented**  
**Date: 2026-04-06**

## Problem

The editor had separate `vimeo` and `youtube` hotspot types with nearly identical logic, requiring two icon categories, two preset entries, and duplicated rendering/playback code. Users had to choose the correct provider before pasting a URL.

## Solution

Replace with a single `video` hotspot type that auto-detects the provider (YouTube or Vimeo) from the URL using `detectVideoProvider()` from `oEmbedValidation.ts`. The oEmbed preview card confirms the detected platform. Existing templates with `type: "vimeo"` or `type: "youtube"` continue working via fallthrough — no database migration needed.

## Changes

### 1. `src/types/viralTemplates.ts`
- Added `'video'` to `HotspotActionType` union.
- Kept `'vimeo'` and `'youtube'` with `@deprecated` comments for backward compatibility.

### 2. `src/components/FullResolutionHotspotEditor.tsx`
- Merged two presets (`vimeo-video`, `youtube-video`) into one `{ id: "video", type: "video" }`.
- Replaced `IconCategory` entries `"vimeo" | "youtube"` with single `"video"`.
- Updated `categoryImages`, `categoryIcons`, `categoryLabels` maps.
- Updated `allowMultiple` array.
- URL input shows "Video URL" label with combined placeholder for both providers.
- oEmbed validation triggers for `video`, `vimeo`, and `youtube` types.
- Label position selector hidden for all video types.

### 3. `src/components/InteractiveSlideOverlay.tsx`
- Imported `detectVideoProvider` from `oEmbedValidation.ts`.
- `getHotspotAction`: merged into single `case "video"` with `case "vimeo"` / `case "youtube"` fallthrough; uses `detectVideoProvider(hotspot.url)` at runtime.
- Hotspot rendering: single unified block for `video`/`vimeo`/`youtube` types.

### 4. `src/components/SlidePreviewOverlay.tsx`
- Added `video: Video` to `ACTION_ICONS` map; kept legacy entries.

### 5. `src/pages/DeckEditor.tsx`
- Added `'video'` (and `'youtube'`) to `ACTION_TYPES` set.
- Badge rendering includes `video` slide type.
- Hotspot editor gate excludes `video` alongside `vimeo`.

## Backward Compatibility
- Existing hotspots with `type: "vimeo"` or `type: "youtube"` in the JSONB column continue working via fallthrough in all components.
- No database migration needed.
- The standalone `vimeo` **slide type** in `slide_items.type` is unrelated and unchanged.
- 6 existing templates with legacy types were identified and verified to work without modification.

## Files Changed
- `src/types/viralTemplates.ts`
- `src/components/FullResolutionHotspotEditor.tsx`
- `src/components/InteractiveSlideOverlay.tsx`
- `src/components/SlidePreviewOverlay.tsx`
- `src/pages/DeckEditor.tsx`
- `docs/decisions/deck-editor/2026-04-06_video-hotspot-type-merge_feature-doc_lovable.md` (new)
