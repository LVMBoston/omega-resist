
# Add Template Details to Slide Badges in Deck Editor

## What Changes

Enhance the slide thumbnail badges in `src/pages/DeckEditor.tsx` to show:
1. The **template name** (instead of generic "Interactive")
2. The **template type** -- "Solid Color" or "Image" (for Data Templates)
3. The **hotspot count** (e.g., "4 hotspots")

## Implementation (single file: `src/pages/DeckEditor.tsx`)

### 1. Expand the `Template` interface (line 33-41)

Add `template_type` and keep `image_url` (already present) so we can detect solid color mode:

```typescript
interface Template {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  thumbnail_url?: string;
  hotspots: any;
  is_default: boolean;
  template_type?: string;  // NEW
}
```

### 2. Update `SortableSlide` props and rendering (lines 49-111)

Add a `templateInfo` prop containing resolved details:

```typescript
templateInfo?: {
  name: string;
  isDataTemplate: boolean;
  backgroundType: 'Solid Color' | 'Image';
  hotspotCount: number;
}
```

Update the badge area (lines 85-89) to render:
- **Line 1**: Template name (truncated, max ~140px)
- **Line 2** (Data Templates only): Background type + hotspot count (e.g., "Solid Color | 4 hotspots")

Color coding:
- Action templates: blue badge (existing)
- Data templates: green badge to match the repository color scheme

### 3. Pass template info when rendering slides

Where `SortableSlide` is rendered in the slide list, look up the template from the existing `templates` array and compute:
- `name`: from `template.name` or fallback to "Interactive"
- `isDataTemplate`: `template.template_type === 'stats_page'`
- `backgroundType`: `template.image_url?.startsWith('solid:') ? 'Solid Color' : 'Image'`
- `hotspotCount`: `Array.isArray(template.hotspots) ? template.hotspots.length : 0`

### Visual Result

```
+-------------------+
| [1]               |
|   [slide image]   |
| "Stats Dashboard" | <- template name (green for data, blue for action)
| "Image | 12 spots"| <- type + count (data templates only)
+-------------------+
```

## What Does NOT Change
- Template picker dialog
- Save/delete/reorder logic
- No new database queries (data already fetched via `select('*')`)
