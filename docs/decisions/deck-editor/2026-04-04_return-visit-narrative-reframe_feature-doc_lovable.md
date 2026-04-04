# Reframe "Return Visit" Language in Campaign Narrative

**Date**: 2026-04-04
**Author**: lovable
**Status**: Approved & Implemented
**Project Area**: Campaign Story / Narrative

## Summary

Replaced dismissive "sometimes more than once by the same person" phrasing with retention-positive language: "including return visits from people who held onto the message."

## Context

A "return visit" occurs when a person re-opens the same link days or weeks later — from their browser history, a saved bookmark, or a pinned SMS. Unlike a fresh scan that signals new reach, a return visit signals **retention**: the person is holding onto the message. The previous phrasing ("sometimes more than once by the same person") undercut what is actually a positive signal. A return visit means the content resonated enough that someone bookmarked it, saved the link, or kept the SMS.

## What Changed

**File**: `src/lib/campaignNarrative.ts` (line 418)

Before:
```
👀 The content was viewed {viewCount} times — sometimes more than once by the same person.
```

After:
```
👀 The content was viewed {viewCount} times — including return visits from people who held onto the message.
```

Single-line copy change. No logic, schema, or other files affected.

## Related

- Companion plan: `2026-04-04_action-eoa-first-view-dedup_feature-doc_lovable.md` (map marker deduplication for Action-type EoAs)
