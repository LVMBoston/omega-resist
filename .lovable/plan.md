

## Transparent Hotspot Toggle

### Problem
Current hotspot icons are brittle — custom PNGs fail on iOS Safari, icons take up visual space, and the icon-rendering pipeline (FallbackImg, per-platform branching) is complex. The user already places visual elements (buttons, logos) directly on their slide images and just needs invisible tap targets over them.

### Solution
Add a per-hotspot `isTransparent` boolean toggle. When enabled:
- **Runtime** (`InteractiveSlideOverlay`): render the hotspot as a fully transparent clickable area — no icon, no image, just a positioned `<button>`/`<a>` with the same tap target. The action (SMS, email, share, external link, vimeo, email_links) fires identically.
- **Editor** (`FullResolutionHotspotEditor`, `DraggableHotspotOverlay`): show a subtle dashed border so the author can see and position the hotspot, but mark it as "transparent" with a visual indicator.
- **Preview** (`SlidePreviewOverlay`): show a faint dashed outline with a small label so the template card remains informative.

### Data model change
Add `isTransparent?: boolean` to the `Hotspot` interface in `src/types/viralTemplates.ts`. No database migration needed — hotspots are stored as JSONB, and the new field defaults to `false`/undefined.

### Files to change

1. **`src/types/viralTemplates.ts`** — Add `isTransparent?: boolean` to `Hotspot` interface.

2. **`src/components/InteractiveSlideOverlay.tsx`** — In the render section (~lines 935-1075), when `hotspot.isTransparent` is true, skip `getHotspotIcon()` and render the button/anchor with no children (transparent tap target). Keep all action handlers identical.

3. **`src/components/FullResolutionHotspotEditor.tsx`** — Add a "Transparent" checkbox/switch in the per-hotspot property panel. When checked, the editor overlay shows a dashed border + eye-off icon instead of the icon image.

4. **`src/components/SlidePreviewOverlay.tsx`** — For action hotspots with `isTransparent`, render a faint dashed outline with a small type label instead of the colored icon box.

5. **`src/components/DraggableHotspotOverlay.tsx`** — For action hotspots with `isTransparent` in the data template editor, show the dashed-border style so they remain visible during editing.

### What stays the same
- All hotspot actions (SMS, email, social, external_link, vimeo, email_links, app_download) work identically.
- Non-transparent hotspots render exactly as today.
- Live number, chart, and map hotspots are unaffected (they have their own rendering paths).
- No database migration required.

### Editor UX
- Each action hotspot's property panel gets a `Switch` labeled "Transparent overlay" with helper text: "Hide icon — use when the slide image already has a visual element."
- Toggle is only shown for action-type hotspots (sms, email, social, external_link, email_links, vimeo, app_download).

