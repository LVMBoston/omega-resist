

# Fix Campaign Story SVG Formatting to Match Dialog

**Date:** 2026-03-04

## 1. Problem

The `campaign_story` metric is rendered in the SVG snapshot as a single text block with uniform font size, uniform line height, and no visual hierarchy. The dialog version has bold titles, emoji hanging indents, and paragraph spacing between sections. The user wants the snapshot to visually match the dialog.

## 2. Root Cause

Lines 544–557 of `render-stats-snapshot/index.ts` render all `\n`-separated lines identically — same `scaledFontSize`, same `lineHeight`, no awareness of:

a. **Title lines** (first line should be bold/larger)
b. **Blank lines** (should produce extra vertical gap, not a zero-height tspan)
c. **Emoji-prefixed paragraphs** (emoji should be left-aligned, body text indented)

Additionally, the server-side inline narrative (lines 357–396) doesn't use `__TITLE__` sentinels or include the "Last share" and "Fastest share" lines, so the content also differs. But since the user said the issue is formatting, I'll focus on the SVG rendering improvements.

## 3. Changes — `supabase/functions/render-stats-snapshot/index.ts`

### 3a. Add special rendering path for `campaign_story` hotspot

When `hotspot.metricKey === "campaign_story"`, use a dedicated renderer instead of the generic text path. This renderer will:

1. **Title detection**: First non-empty line → render at `scaledFontSize * 1.2`, `font-weight="bold"`
2. **Blank-line paragraph spacing**: Blank lines add `lineHeight * 0.6` vertical gap instead of a full line
3. **Emoji splitting**: Lines matching `/^[\p{Emoji}]\s/u` → render emoji at `x`, body text at `x + emojiIndent`
4. **Word wrapping**: Auto-wrap long lines to fit within `hsWidth` (approximate character count per line based on font size)
5. **Top-aligned text**: Start from top of hotspot box (current code centers vertically, which fails for multi-paragraph content)

### 3b. Sync server-side narrative content

Update the inline narrative builder (lines 357–396) to match `generateFullStory`:

1. Add `__TITLE__` sentinels on the title line (so the renderer can detect it)
2. Add "Last share" timestamp query + line
3. Rewrite speed line to use "Fastest share:" prefix
4. Add geographic origin/destination queries (same 4-query pattern from client-side)

### 3c. Title rendering in SVG

The `__TITLE__` sentinels get stripped during SVG rendering; the enclosed text is rendered bold at a larger size. This mirrors the dialog's `text-xl font-bold` treatment.

## 4. What Does Not Change

- Client-side `campaignNarrative.ts` — no changes
- Dialog component — no changes
- No database migrations
- Other hotspot types (live_number, chart, map) — unchanged

## 5. Files Modified

| File | Change |
|------|--------|
| `supabase/functions/render-stats-snapshot/index.ts` | Add campaign_story SVG renderer with title/paragraph/emoji handling; sync narrative content with client |
| `docs/decisions/campaign-story/2026-02-27_two-tier-story-metric_feature-doc_lovable.md` | Append update section |

