

# Enrich Speed Narrative with "Fastest share" Prefix and Geographic Origins

**Status:** Draft  
**Date:** 2026-03-04

## 1. Goal

Rewrite the ⚡ speed line from:

> ⚡ The message reached Level 3 in just 5 hours.

To:

> ⚡ Fastest share: From the first card drop shared to the first Level 3 share took just 5 hours; Julian, CA to Springfield, IL.

Geographic suffix omitted when either city is null.

## 2. Changes — single file: `src/lib/campaignNarrative.ts`

### 2a. Add fields to `NarrativeData`

```typescript
speedOriginCity: string | null;   // city, region of first L1 event
speedDestCity: string | null;     // city, region of first max-level event (same l00_instance)
```

### 2b. Add sequential queries in `fetchNarrativeData`

After the parallel batch completes and `propagationSpeed` / `maxLevel` are computed:

1. Query `tokens` for first L1 token (`utm_campaign`, `level = 1`, order `minted_at asc`, limit 1) → get `token`, `l00_instance`.
2. Query `url_events` for that token → get `city`, `region`.
3. Query `tokens` for first max-level token with same `l00_instance` → get `token`.
4. Query `url_events` for that token → get `city`, `region`.

Four single-row lookups, only executed when `maxLevel >= 1`.

### 2c. Rewrite speed narrative in `generateFullStory`

Replace:
> `The message reached Level ${lastLevel.level} in just ${diffHours} hours.`

With:
> `Fastest share: From the first card drop shared to the first Level ${level} share took just ${time}; ${origin} to ${dest}.`

Geographic suffix appended only when both cities resolve. Time formatting unchanged (< 1 hour / N hours / N days).

### 2d. Rewrite speed line in `generateHeadlineOnly`

Same "Fastest share:" prefix and geographic suffix logic for the headline tier.

## 3. What Does Not Change

- No new tables, migrations, or edge function changes
- No changes to snapshot rendering
- All other narrative sections untouched
- `propagationSpeed` array structure unchanged

## 4. Files Modified

| File | Change |
|------|--------|
| `src/lib/campaignNarrative.ts` | Add 2 fields to interface, 4 sequential queries, rewrite speed lines in both tiers |
| `docs/decisions/campaign-story/2026-02-27_two-tier-story-metric_feature-doc_lovable.md` | Append update section |

