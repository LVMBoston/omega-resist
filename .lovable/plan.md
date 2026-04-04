

# Reframe "Return Visit" Language in Campaign Narrative

## Context

Line 418 of `src/lib/campaignNarrative.ts` currently reads:

> 👀 The content was viewed {viewCount} times — sometimes more than once by the same person.

With the new understanding that return visits signal **retention** (the person held onto the message and came back), this dismissive phrasing ("sometimes more than once by the same person") undercuts what is actually a positive signal. A return visit means the content resonated enough that someone bookmarked it, saved the link, or kept the SMS.

## What Changes

**File**: `src/lib/campaignNarrative.ts`

1a. Replace line 418 with language that reframes return visits as retention:

```typescript
// Before
lines.push(`👀 The content was viewed ${viewCount} times — sometimes more than once by the same person.`);

// After
lines.push(`👀 The content was viewed ${viewCount} times — including return visits from people who held onto the message.`);
```

This is a single-line copy change. No logic, no schema, no other files affected.

2a. Save the approved plan as `docs/decisions/deck-editor/2026-04-04_return-visit-narrative-reframe_feature-doc_lovable.md`.

