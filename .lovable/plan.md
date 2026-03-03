

## Add Vimeo Video Slide Type — Replay from Start, No Artifacts

### 1. Problem
Embla carousel doesn't handle Vimeo iframes well: videos render small (requiring pinch-zoom) and audio bleeds when swiping away.

### 2. Behavior spec
- **Default state**: poster image with centered play button.
- **Tap play**: full-viewport overlay (`fixed inset-0 z-50`) with Vimeo iframe. Close via X button or Escape key.
- **Navigate away**: `isActive` flips false → `player.destroy()` → overlay closes, audio stops.
- **Navigate back**: slide resets to poster + play button. Tap starts video from beginning. No resume, no timestamp artifacts.

### 3. Changes

#### 3a. DB migration — add `media_url` to `slide_items`
```sql
ALTER TABLE public.slide_items ADD COLUMN IF NOT EXISTS media_url text;
```
No RLS changes needed — existing policies cover this column.

#### 3b. `src/components/VimeoSlide.tsx` — New component
- Props: `contentUrl` (poster), `mediaUrl` (Vimeo URL), `isActive`.
- Renders poster image + play button overlay.
- On play: mounts `fixed inset-0` black overlay with Vimeo iframe using `@vimeo/player` (already installed). Close button top-right. Escape key closes.
- `useEffect` on `isActive`: when false, calls `player.destroy()` and resets to poster state. Reuses Vimeo URL parsing logic from `InteractiveSlideOverlay`.
- On `ended` event: auto-close overlay.

#### 3c. `src/pages/DeckViewer.tsx` — Track active index, render Vimeo slides
- a. Update `SlideItem` interface (line 13) to add `media_url?: string`.
- b. Use Embla API's `select` event to track `activeIndex` state.
- c. In the slide render loop (line 524), add a third branch: `slide.type === "vimeo"` renders `<VimeoSlide contentUrl={slide.content_url} mediaUrl={slide.media_url} isActive={index === activeIndex} />`.

#### 3d. `src/pages/DeckEditor.tsx` — Add Vimeo slide creation
- a. Update `Slide` interface (line 26) to add `media_url?: string`.
- b. Add "Add Vimeo" button alongside existing upload controls that prompts for a Vimeo URL and poster image.
- c. Creates slide with `type: "vimeo"`, stores URL in `media_url`, poster in `content_url`.
- d. Thumbnail in sidebar shows poster with a small play icon badge.

#### 3e. Decision doc
Archive to `docs/decisions/deck-editor/2026-03-03_vimeo-slide-type_feature-doc_lovable.md`.

### 4. Files touched

| # | File | Action |
|---|------|--------|
| a | DB migration | Add `media_url` column |
| b | `src/components/VimeoSlide.tsx` | Create |
| c | `src/pages/DeckViewer.tsx` | Edit — active index + vimeo branch |
| d | `src/pages/DeckEditor.tsx` | Edit — add Vimeo upload flow |
| e | Decision doc | Create |

### 5. Out of scope
- Resume-from-timestamp (confirmed: replay from start).
- MP4 direct upload, GIF restart logic, link slide type.

