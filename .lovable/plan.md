

# Create `docs/PRD_Hybrid_Templates.md`

## New File: `docs/PRD_Hybrid_Templates.md`

The document will follow the established style of existing docs (motivation-first, architecture diagrams in text fences, tables for reference, troubleshooting section). Contents:

---

### 1. Motivation (Why Hybrid Templates?)

Frame around three core arguments:

- **Extrinsic motivation + CTA on one slide.** Today, Data Templates show movement evidence (seeds, shares, opens, neighborhoods) but offer no way to act on the energy they create. Action Templates provide CTAs (SMS, email) but show no evidence of momentum. A Hybrid slide closes this gap: the viewer sees proof that the message is spreading AND can immediately contribute to that spread. The emotional arc is "look how far we've reached -- now it's your turn."

- **Scales across campaigns without duplication.** Currently, organizations that want both stats and share buttons must maintain two separate slides in a deck (one Data, one Action). This doubles template management overhead and splits the viewer's attention across two slides. A Hybrid template is a single artifact that serves both purposes, reuses the same snapshot pipeline, and deploys identically across campaigns.

- **Reduces deck length, increases conversion.** Every additional slide in a viral deck is a drop-off point. Combining the "evidence of movement" and the "call to action" into one slide removes a navigation step between seeing the stats and deciding to share. Shorter decks convert better in field distribution contexts where attention is limited.

### 2. Feature Overview

- Definition of a Hybrid Template: a single `viral_slide_configs` row with `template_type = 'hybrid'` whose `hotspots` JSONB array contains both action hotspots (sms, email, social, external_link) and data hotspots (live_number, chart, map).
- Color coding: Purple (distinct from blue Action and green Data).
- Stored in the same table, same schema, no migration required.

### 3. Creation Workflow

Step-by-step description of the "promote an Action template" flow:

1. Admin opens `/interactive-templates`.
2. Finds an existing Action template with space left for data fields.
3. Clicks "Add Data Layer" on that card.
4. DataTemplateEditor opens pre-loaded with the Action template's image and its existing share hotspots shown as locked ghost overlays.
5. Admin positions live_number / chart / map hotspots in the empty space.
6. Saves as `template_type: 'hybrid'`.
7. Deploys snapshots. The edge function bakes metrics into the SVG and skips action hotspots.

Includes a text diagram of the editor layout showing locked vs editable hotspots.

### 4. Runtime Rendering Architecture

Text diagram showing the two rendering paths:

- **Mobile / snapshot path:** Snapshot SVG (metrics baked in) used as background image, InteractiveSlideOverlay mounted on top with only action hotspots.
- **Desktop / dynamic path:** Original background image + dynamic metric hotspots + InteractiveSlideOverlay action hotspots.

Explains that `HybridSlide.tsx` resolves campaign code the same way `StatsPageSlide` does (token UTM or deck assignment fallback), calls `useLiveMetrics`, and splits hotspots into two sets by type.

### 5. Snapshot Compatibility

Explains that the snapshot pipeline works unchanged except for one filter addition in `render-stats-snapshot`:

- Action hotspot types (`sms`, `email`, `social`, `external_link`) are excluded from SVG text rendering.
- The cron system (`refresh-all-snapshots`) treats hybrid templates identically to stats_page templates.
- Storage path remains `{template_id}/snapshot-{campaign_code}.svg`.

Table showing rendering behavior by scenario (mobile with snapshot, mobile without, desktop).

### 6. Files Involved

Reference table of the six files created/modified, matching the approved plan.

### 7. Relationship to Existing Docs

Cross-references to:
- `INTERACTIVE_SLIDE_TEMPLATES.md` (template types, editor usage, database schema)
- `SNAPSHOT_CRON_SYSTEM.md` (cron pipeline, staleness checks)
- `PRD.md` (product vision, viral tracking goals)

---

This document will be approximately 150-180 lines, consistent with the length and depth of `SNAPSHOT_CRON_SYSTEM.md`.

