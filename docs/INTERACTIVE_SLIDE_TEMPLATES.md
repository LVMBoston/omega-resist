# Interactive Slide Template Repository

## Feature Overview

The Interactive Slide Template Repository (`/interactive-templates`) provides a unified management interface for two distinct template types:

1. **Action Templates** (Blue) - Navigation/share hotspots for viral distribution
2. **Data Templates** (Green) - Live metrics hotspots for real-time campaign stats

Both template types are stored in `viral_slide_configs` and can be attached to slides in the Deck Builder.

---

## Template Types

### Action Templates (`interactive_share`)

Action templates define clickable hotspots that trigger share actions:

| Hotspot Type | Description |
|--------------|-------------|
| `sms` | Opens SMS composer with pre-filled share message |
| `email` | Opens email client with share content |
| `social` | Triggers social media share dialog |
| `external_link` | Navigates to external URL |

**Use Cases:**
- Viral share slides (L01-L03)
- Call-to-action slides
- Navigation slides

### Data Templates (`stats_page`)

Data templates define hotspots that display live campaign metrics:

| Metric Key | Description |
|------------|-------------|
| `seeds` | Count of L00 tokens |
| `shares` | Count of child tokens minted |
| `opens` | Total view events |
| `opens_us` | US-based views |
| `opens_intl` | International views |
| `opens_qr` | Opens via QR scan |
| `opens_text` | Opens via text/SMS |
| `opens_mail` | Opens via email |
| `neighborhoods` | Distinct zip codes |
| `depth` | Max level reached |
| `l01_count` | Count at level 1 |
| `l02_count` | Count at level 2 |
| `l03_count` | Count at level 3 |
| `viral_coefficient` | K-factor |
| `campaign_name` | Campaign title text |
| `start_date` | Campaign start date |
| `current_date` | Current date |
| `start_time` | Campaign start time |
| `current_time` | Current time |

**Use Cases:**
- Stats pages showing real-time campaign metrics
- Dashboard slides embedded in decks
- Progress tracking slides

---

## Editor Usage Guide

### Creating Action Templates

1. Navigate to `/interactive-templates`
2. Click **"+ New Action Template"** (blue button)
3. Upload a background image (high-resolution PNG recommended)
4. Click to add hotspots on the image
5. Configure each hotspot:
   - Select action type (SMS, Email, Social, External Link)
   - Position and size the hotspot
   - Add label text
6. Click **Save** to store the template

### Creating Data Templates

1. Navigate to `/interactive-templates`
2. Click **"+ New Data Template"** (green button)
3. Upload a background image with placeholder areas for metrics
4. Add hotspots for each metric location:
   - Select metric key from dropdown
   - Position hotspot over placeholder area
   - Configure text styling (font, size, color, alignment)
5. Use style inheritance: new hotspots copy dimensions and styles from the active hotspot
6. Click **Save** to store the template

### Editing Templates

1. Find the template in the repository grid
2. Click the **Edit** button on the template card
3. The appropriate editor opens based on template type:
   - Action templates → Hotspot Editor
   - Data templates → Data Template Editor
4. Make changes and click **Save**

---

## Deck Builder Integration

### Attaching Templates to Slides

1. In Deck Builder, select a slide
2. Click **"Attach Template"**
3. Use filter tabs to narrow selection:
   - **All** - Shows all templates grouped by type
   - **Action** - Shows only action templates
   - **Data** - Shows only data templates
4. Click a template card to attach it
5. The slide will render with the template's hotspots

### Template Picker Visual Guide

```
+------------------------------------------------------------------+
|  Select Template                                                  |
+------------------------------------------------------------------+
|  Filter: [All] [Action] [Data]                                   |
+------------------------------------------------------------------+
|  +----------------+  +----------------+  +----------------+      |
|  | [Action]       |  | [Action]       |  | [Data]         |      |
|  | Share Slide A  |  | Email CTA      |  | Stats Page     |      |
|  | 3 hotspots     |  | 2 hotspots     |  | 12 hotspots    |      |
|  +----------------+  +----------------+  +----------------+      |
+------------------------------------------------------------------+
```

---

## Database Schema Reference

### Table: `viral_slide_configs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `slug` | text | Unique template identifier |
| `name` | text | Display name |
| `description` | text | Optional description |
| `image_url` | text | Background image URL |
| `thumbnail_url` | text | Preview thumbnail URL |
| `template_type` | text | `interactive_share`, `display_only`, `custom_action`, or `stats_page` |
| `config` | jsonb | Type-specific configuration |
| `hotspots` | jsonb | Array of hotspot definitions |
| `deck_slug` | text | Optional deck association |
| `is_default` | boolean | Whether this is a default template |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

### Hotspot Schema (in `hotspots` JSONB array)

```typescript
interface Hotspot {
  id: string;
  iconId: string;
  type: 'sms' | 'email' | 'social' | 'external_link' | 'live_number';
  label: string;
  x: number;        // percentage (0-100)
  y: number;        // percentage (0-100)
  width: number;    // percentage
  height: number;   // percentage
  labelPosition?: 'top' | 'bottom';
  url?: string;     // For external_link type
  metricKey?: string; // For live_number type
  liveNumberStyle?: {
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontFamily?: string;
    padding?: string;
    borderRadius?: string;
  };
}
```

---

## Runtime Resolution Flow

### Data Template Metric Resolution

When a Data template slide is viewed, metrics are resolved through this flow:

```
DeckViewer loads slide_item
    │
    ▼
slide_item.template_id → viral_slide_configs (stats_page type)
    │
    ▼
Deck context provides → deck_slug
    │
    ▼
deck_eoa_assignments → eoa_id → events_actions → utm_campaign
    │
    ▼
useLiveMetrics(utm_campaign) → queries url_events + tokens
    │
    ▼
Render hotspots with resolved live values
```

### Key Tables Involved

1. **viral_slide_configs** - Template definition with hotspot positions
2. **slide_items** - Links slides to templates via `template_id`
3. **deck_eoa_assignments** - Maps deck versions to EOAs
4. **events_actions** - Contains `utm_campaign` codes
5. **tokens** - Token data filtered by `utm_campaign`
6. **url_events** - View/open events for metrics

---

## API Patterns and Hooks

### useLiveMetrics Hook

```typescript
const { metrics, isLoading, error } = useLiveMetrics(campaignCode);

// Returns metrics object:
{
  seeds: 142,
  shares: 87,
  opens: 1234,
  opens_qr: 456,
  opens_text: 321,
  opens_mail: 198,
  neighborhoods: 73,
  campaign_name: "OMEGA PA",
  start_date: "Jan 15, 2026",
  current_date: "Jan 25, 2026",
  // ... etc
}
```

### Template CRUD Operations

```typescript
// Fetch templates
const { data: templates } = await supabase
  .from('viral_slide_configs')
  .select('*')
  .order('created_at', { ascending: false });

// Create template
const { data, error } = await supabase
  .from('viral_slide_configs')
  .insert({
    slug: generateSlug(),
    name: 'My Template',
    template_type: 'stats_page', // or 'interactive_share'
    image_url: uploadedImageUrl,
    hotspots: hotspotsArray,
    config: { type: 'stats_page' }
  });

// Update template
const { error } = await supabase
  .from('viral_slide_configs')
  .update({ hotspots: updatedHotspots })
  .eq('id', templateId);

// Delete template
const { error } = await supabase
  .from('viral_slide_configs')
  .delete()
  .eq('id', templateId);
```

---

## Color Coding Reference

| Template Type | Badge Classes | Border Classes | Button Classes |
|---------------|---------------|----------------|----------------|
| Action | `bg-blue-100 text-blue-800` | `border-blue-300` | `bg-blue-600 hover:bg-blue-700` |
| Data | `bg-green-100 text-green-800` | `border-green-300` | `bg-green-600 hover:bg-green-700` |

---

## Development Notes

### LiveNumbersDemo.tsx

The `/live-numbers-demo` page remains available for isolated calibration testing. It provides a sandbox environment for experimenting with hotspot positioning without affecting production templates.

### Migration Path

When migrating from standalone calibration tools to the unified repository:

1. Export hotspot configurations from the calibration tool
2. Create a new Data template in the repository
3. Import the hotspot positions
4. Verify metric resolution at runtime

---

## Troubleshooting

### Metrics Not Displaying

1. Verify `deck_eoa_assignments` links the deck to an EOA
2. Check that the EOA has a valid `utm_campaign` in `events_actions`
3. Confirm `url_events` contains data for the campaign
4. Check browser console for query errors

### Hotspot Positioning Issues

1. Use the calibration controls for fine-tuning (0.1% increments)
2. Ensure the background image matches the production slide dimensions
3. Test at multiple screen sizes to verify responsive behavior

### Template Not Appearing in Picker

1. Verify the template was saved successfully (check for errors)
2. Confirm `template_type` is set correctly
3. Check filter tab selection in the picker
