# Hybrid Templates

Combining live campaign metrics and interactive share actions on a single slide.

## Motivation

### Evidence of movement + call to action on one slide

Data Templates show movement evidence — seeds planted, shares minted, opens logged, neighborhoods reached — but offer no way to act on the energy they create. Action Templates provide CTAs (SMS, email, social share) but show no evidence of momentum. A Hybrid slide closes this gap: the viewer sees proof that the message is spreading AND can immediately contribute to that spread.

The emotional arc is: *"Look how far we've reached — now it's your turn."*

This is the core of extrinsic motivation in viral distribution. Seeing that others have already acted lowers the barrier to action. Combining that social proof with the share mechanism on the same screen eliminates the cognitive gap between "I should share this" and "here's how."

### Scales across campaigns without duplication

Organizations that want both stats and share buttons currently maintain two separate slides in a deck (one Data, one Action). This doubles template management overhead and splits the viewer's attention across two screens. A Hybrid template is a single artifact that serves both purposes, reuses the same snapshot pipeline, and deploys identically across campaigns via the existing deck assignment system.

### Reduces deck length, increases conversion

Every additional slide in a viral deck is a drop-off point. Combining the "evidence of movement" and the "call to action" into one slide removes a navigation step between seeing the stats and deciding to share. Shorter decks convert better in field distribution contexts where attention is limited (canvassing, rallies, text banking).

## Feature Overview

A Hybrid Template is a single `viral_slide_configs` row with `template_type = 'hybrid'` whose `hotspots` JSONB array contains both:

- **Action hotspots:** `sms`, `email`, `social`, `external_link` — interactive share buttons rendered live at the client layer
- **Data hotspots:** `live_number`, `chart`, `map` — campaign metrics rendered dynamically or baked into server-side snapshots

Color coding: **Purple** (distinct from blue Action and green Data).

No database migration is required. The `viral_slide_configs` table stores `template_type` as freetext and `hotspots` as JSONB. All hotspot types are already valid in the existing schema.

## Creation Workflow

Hybrid templates are created by promoting an existing Action template — adding a data layer on top of an already-designed share slide.

1. Admin opens `/interactive-templates`.
2. Finds an existing Action template with space left for data fields.
3. Clicks **"Add Data Layer"** on that template's card.
4. `DataTemplateEditor` opens pre-loaded with the Action template's image and its existing share hotspots shown as **locked ghost overlays**.
5. Admin positions `live_number` / `chart` / `map` hotspots in the empty space.
6. Saves → stored as `template_type: 'hybrid'`.
7. Deploys snapshots via "Deploy to Campaigns." The edge function bakes metrics into the SVG and skips action hotspots.

### Editor layout

```text
┌─────────────────────────────────────────────────┐
│  DataTemplateEditor                             │
│                                                 │
│  ┌─────────────────────┐  ┌──────────────────┐  │
│  │  Left Panel         │  │  Preview         │  │
│  │                     │  │                  │  │
│  │  Name / Slug / Desc │  │  ┌────────────┐  │  │
│  │  Campaign selector  │  │  │ Background │  │  │
│  │  Hotspot controls   │  │  │   image    │  │  │
│  │                     │  │  │            │  │  │
│  │  [Add Hotspot]      │  │  │  ░░░░░░░░  │  │  │
│  │  [Add Chart]        │  │  │  locked    │  │  │
│  │  [Add Map]          │  │  │  action    │  │  │
│  │                     │  │  │  hotspots  │  │  │
│  │  No "Add Share" —   │  │  │  (ghost)   │  │  │
│  │  action hotspots    │  │  │            │  │  │
│  │  come from the      │  │  │  ▓▓▓▓▓▓▓▓  │  │  │
│  │  source Action      │  │  │  editable  │  │  │
│  │  template           │  │  │  data      │  │  │
│  │                     │  │  │  hotspots  │  │  │
│  └─────────────────────┘  │  └────────────┘  │  │
│                           └──────────────────┘  │
└─────────────────────────────────────────────────┘

░░░ = locked action hotspots (grey, non-selectable, from source Action template)
▓▓▓ = editable data hotspots (user positions these)
```

## Runtime Rendering Architecture

`HybridSlide.tsx` resolves the campaign code the same way `StatsPageSlide` does (token UTM parameter or deck assignment fallback), calls `useLiveMetrics`, and splits hotspots into two sets by type.

### Mobile / snapshot path

```text
┌──────────────────────────────────┐
│  <img src="snapshot.svg" />      │  ← server-rendered SVG with metrics baked in
│  + InteractiveSlideOverlay       │  ← action hotspots rendered live on top
│    (sms, email, social buttons)  │
└──────────────────────────────────┘
```

The snapshot SVG contains the background image and all data hotspot values (numbers, charts, maps) pre-rendered. Share buttons are NOT in the SVG — they are interactive client-side elements positioned by `InteractiveSlideOverlay` using the same percentage-based coordinates from the `hotspots` array.

### Desktop / dynamic path

```text
┌──────────────────────────────────┐
│  <img src="background.png" />    │  ← original template image
│  + live_number hotspots          │  ← rendered dynamically with useLiveMetrics
│  + chart / map hotspots          │  ← rendered dynamically
│  + InteractiveSlideOverlay       │  ← action hotspots rendered live on top
└──────────────────────────────────┘
```

Both paths pass only action-type hotspots (`sms`, `email`, `social`, `external_link`) to `InteractiveSlideOverlay`. Data-type hotspots (`live_number`, `chart`, `map`) are rendered in the direct layer (or are already baked into the snapshot).

## Snapshot Compatibility

The snapshot pipeline works unchanged except for one filter addition in `render-stats-snapshot`:

```text
Action hotspot types (sms, email, social, external_link)
  → excluded from SVG text rendering
  → rendered live at the client layer instead

Data hotspot types (live_number, chart, map)
  → rendered into the SVG as before
```

The cron system (`refresh-all-snapshots`) treats hybrid templates identically to `stats_page` templates. Storage path remains `{template_id}/snapshot-{campaign_code}.svg`.

### Rendering behavior by scenario

| Scenario | Background | Data hotspots | Action hotspots |
|----------|-----------|---------------|-----------------|
| Mobile, fresh snapshot | Snapshot SVG | Baked into SVG | Live overlay (`InteractiveSlideOverlay`) |
| Mobile, no snapshot | Original image | Dynamic (`useLiveMetrics`) | Live overlay |
| Desktop | Original image | Dynamic (`useLiveMetrics`) | Live overlay |
| Snapshot cron refresh | N/A | Re-rendered into SVG | Skipped by edge function |

## Files Involved

| File | Change |
|------|--------|
| `src/types/viralTemplates.ts` | Add `'hybrid'` to `TemplateType`, add `HybridConfig` interface |
| `src/components/HybridSlide.tsx` | **New** — merged stats + share rendering component |
| `src/components/ViralSlideV2.tsx` | Add `'hybrid'` routing branch |
| `src/pages/InteractiveTemplates.tsx` | Add "Add Data Layer" button, `isHybridTemplate()`, Hybrid filter tab, purple color-coding |
| `src/components/DataTemplateEditor.tsx` | Add `lockedHotspots` prop for ghost overlay of action hotspots |
| `supabase/functions/render-stats-snapshot/index.ts` | Filter action hotspots from SVG text layer |

## Relationship to Existing Docs

- **[INTERACTIVE_SLIDE_TEMPLATES.md](./INTERACTIVE_SLIDE_TEMPLATES.md):** Defines the template type system, editor workflows, and `viral_slide_configs` schema that Hybrid templates extend.
- **[SNAPSHOT_CRON_SYSTEM.md](./SNAPSHOT_CRON_SYSTEM.md):** Documents the `refresh-all-snapshots` cron pipeline and `render-stats-snapshot` edge function that Hybrid templates reuse with the action-type filter addition.
- **[PRD.md](./PRD.md):** Product vision and viral tracking goals. Hybrid templates advance the Q1 2026 goal of increasing viral coefficient by reducing friction between social proof and share action.
