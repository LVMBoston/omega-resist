# Email-links hotspot passthrough in snapshots

- **Status:** Approved & Implemented
- **Date:** 2026-06-18

## Problem

On Slide 5 of `thomas-luttig`, the cream "Email all links" mailbox visible in the Deck Editor was missing from the SSR snapshot on both PC and iOS.

## Root cause

`supabase/functions/render-stats-snapshot/index.ts` excludes action hotspots (sms, email, social, external_link) from the SVG bake so they remain interactive client overlays. `email_links` was not in that set, so the SSR treated it as a text hotspot and baked an empty box where the live mailbox icon would have rendered.

## Fix

Added `"email_links"` to the `ACTION_TYPES` set (line 781). No frontend changes — `InteractiveSlideOverlay` already renders the mailbox icon and `handleEmailLinks` already builds the `mailto:` (subject + numbered list of external_link hotspots on the slide).

## Files

| File | Change |
|------|--------|
| `supabase/functions/render-stats-snapshot/index.ts` | Added `email_links` to `ACTION_TYPES` |

## Follow-up

Part 2 (harmonize editor vs SSR text rendering using the Parity Harness) will be planned separately once Part 1 is verified.
