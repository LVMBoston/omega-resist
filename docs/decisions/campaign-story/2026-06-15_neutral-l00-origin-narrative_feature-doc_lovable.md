# Neutral L00 Origin Narrative

**Date**: 2026-06-15
**Author**: lovable
**Status**: Approved & Implemented
**Project Area**: Campaign Story / Narrative

## Summary

Rewrote Campaign Story narrative text to treat all L00 origin channels as first-class, replacing QR-specific language with the neutral term **"open"**.

## Context

Previously the Campaign Story hardcoded QR-centric phrasing — "cards dropped," "QR scan not shared," "someone scanned a card" — even though L00 tokens can be issued via email, SMS, social media, and peer-to-peer links. The `utm_medium` metadata already tracks these channels, so the narrative was inaccurately framing every campaign as starting with physical cards.

## What Changed

**File**: `src/lib/campaignNarrative.ts`

| Line | Before | After |
|------|--------|-------|
| 286 | `${seedCount} cards dropped` | `${seedCount} first opens` |
| 383 | `From the first card drop shared` | `From the first open shared` |
| 435 | `(A seed is a QR scan not shared.)` | `(A seed is a first open that didn't share.)` |
| 450 | `Someone scanned a card → shared it →` | `Someone opened it → shared it →` |
| 452 | `A scan became a share, which became another share.` | `An open became a share, which became another share.` |

No logic, schema, or other files affected. The "seed" and "sprout" metaphors remain intact; only the channel-specific definitions were neutralized.

## Related

- `src/lib/virality/deriveUtmMedium.ts` — existing L00 channel classification via `utm_medium`
