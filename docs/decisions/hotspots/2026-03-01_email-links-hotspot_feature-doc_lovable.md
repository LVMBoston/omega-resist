# Email Links Hotspot Type

**Status:** Approved & Implemented  
**Date:** 2026-03-01

## Summary

Added an `email_links` hotspot type that collects all `external_link` URLs from sibling hotspots on the same slide and bundles them into a single device `mailto:` link. After the mail client opens, a toast reminds the viewer to share the deck with others via the existing SMS/email share hotspots.

The viral share link is **intentionally excluded** from the email body to avoid giving senders the impression that emailing resource links is a substitute for sharing the deck itself.

## Relationship to Cascading Email Templates

This feature is **orthogonal** to the cascading messaging template system (Chapter → Campaign → Global). The `email_links` hotspot constructs its own `mailto:` body from sibling external links and does not invoke `resolve_message_template` or any RPC. The existing `email` share hotspot continues to use the template cascade independently.

## Changes

| File | Change |
|------|--------|
| `src/types/viralTemplates.ts` | Added `email_links` to `HotspotActionType`, plus `emailLinksSubject` and `emailLinksShowLabels` optional fields on `Hotspot` |
| `src/components/FullResolutionHotspotEditor.tsx` | New `email_links` category/preset (MailPlus icon), config inputs (subject, show-labels toggle), one-per-slide guard |
| `src/components/InteractiveSlideOverlay.tsx` | `handleEmailLinks()` function, icon/action mapping, label display, post-action toast |

## No Database Changes

All configuration lives in the existing `hotspots` JSONB column — no migration required.
