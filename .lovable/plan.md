

## Plan: Merge Vimeo & YouTube into a Single "video" Hotspot Type

### What it does
Replaces the separate `vimeo` and `youtube` hotspot types with a single `video` type. The URL auto-detects the provider using `detectVideoProvider()` from `oEmbedValidation.ts`. Existing templates with `vimeo`/`youtube` types continue working via fallthrough — no database migration needed.

### Changes

**1. Update `src/types/viralTemplates.ts`**
   a. Add `'video'` to the `HotspotActionType` union (with comment: "Unified video player")
   b. Keep `'vimeo'` and `'youtube'` with `@deprecated` comments for backward compatibility

**2. Update `src/components/FullResolutionHotspotEditor.tsx`**
   a. Change `IconPreset.type` and `Hotspot.type` unions: add `"video"`, keep `"vimeo" | "youtube"` for legacy loading
   b. Replace the two presets (`vimeo-video`, `youtube-video` at lines 81-85) with one: `{ id: "video", label: "Video", type: "video", imageUrl: playButtonIcon, width: 5, height: 4 }`
   c. Update `IconCategory` (line 88): replace `"vimeo" | "youtube"` with `"video"`
   d. Update `categoryImages`, `categoryIcons`, `categoryLabels` (lines 155-183): replace `vimeo`/`youtube` entries with single `video: playButtonIcon` / `video: null` / `video: "Video"`
   e. Update `allowMultiple` (line 189): replace `'vimeo', 'youtube'` with `'video'`
   f. Update new-hotspot URL initialization (lines 228-230): add `...(selectedIconPreset.type === "video" && { url: "" })`
   g. Update URL input condition (line 784): add `|| selectedHotspotData.type === "video"` and set label to "Video URL", placeholder to "https://youtube.com/watch?v=... or https://vimeo.com/..."
   h. Update oEmbed `useEffect` (line 120): trigger on `type === "video"` in addition to `"vimeo" || "youtube"` (for legacy)
   i. Update oEmbed preview condition (line 797): add `|| selectedHotspotData.type === "video"`
   j. Update Test URL button condition (line 847): add `|| selectedHotspotData.type === "video"`
   k. Update oEmbed checkmark condition (line 862): add `|| selectedHotspotData.type === "video"`
   l. Update label position exclusion (line 872): add `&& selectedHotspotData.type !== 'video'`

**3. Update `src/components/InteractiveSlideOverlay.tsx`**
   a. In `getHotspotAction` (lines 864-879): add `case "video"` that uses `detectVideoProvider(hotspot.url)` to set the correct provider; keep `case "vimeo"` and `case "youtube"` as-is for legacy
   b. In hotspot rendering (lines 1039-1078): add a `hotspot.type === 'video'` block before the existing vimeo/youtube blocks that uses `detectVideoProvider` to determine provider, then opens inline player; keep legacy blocks as fallthrough
   c. Import `detectVideoProvider` from `@/lib/oEmbedValidation`

**4. Update `src/components/SlidePreviewOverlay.tsx`**
   a. Add `video: Video` to `ACTION_ICONS` map (keep legacy `vimeo`/`youtube` entries)

**5. Update `src/pages/DeckEditor.tsx`**
   a. Add `'video'` to the `ACTION_TYPES` set (line 684) alongside existing `'vimeo'`
   b. Update the Vimeo badge rendering (line 145): also check `slide.type === 'video'` → show "Video" badge
   c. Update the hotspot editor gate (line 1665): exclude `'video'` alongside `'vimeo'`

**6. Create decision doc: `docs/decisions/deck-editor/2026-04-06_video-hotspot-type-merge_feature-doc_lovable.md`**
   a. Status: Approved & Implemented
   b. Document the merge, backward compatibility approach, and affected files

### Backward compatibility
- Existing hotspots stored with `type: "vimeo"` or `type: "youtube"` in the JSONB column continue working via legacy fallthrough in all components
- No database migration needed
- The standalone `vimeo` **slide type** in `slide_items.type` is unrelated and unchanged

### Files changed
- `src/types/viralTemplates.ts`
- `src/components/FullResolutionHotspotEditor.tsx`
- `src/components/InteractiveSlideOverlay.tsx`
- `src/components/SlidePreviewOverlay.tsx`
- `src/pages/DeckEditor.tsx`
- `docs/decisions/deck-editor/2026-04-06_video-hotspot-type-merge_feature-doc_lovable.md` (new)

