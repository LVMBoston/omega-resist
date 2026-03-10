# Public Landing Page — Samizdat Narrative

**Status:** Approved & Implemented  
**Date:** 2026-03-10

## Summary

Created a public-facing landing page at `/landing` that explains the Omega project to non-technical visitors using the samizdat narrative. The page is a dark-themed, multi-section scroll experience with no jargon.

## Sections

1. **Hero** — Logo, tagline, scroll prompt
2. **The Problem** — Platform control, surveillance, digital footprints
3. **The Samizdat Way** — Historical context, physical-to-digital bridge
4. **How It Works** — 3-step visual (Discover → See → Share)
5. **Built for Anonymity** — No accounts, IP purging, trust-based
6. **The Impact** — Geographic reach, chain depth, viral coefficient
7. **Footer** — Organizer login link

## Files Changed

1. `src/pages/LandingPage.tsx` — New scroll-based narrative page
2. `src/App.tsx` — Added `/landing` as public route (no sidebar, no auth)

## Update — 2026-03-10

Added two new sections between "Built for Anonymity" and "The Impact":

### "What You Can Do" — 5-Category Feature Grid
1. **Reach Without Risk** — QR access, anonymity, IP purging
2. **Rich Interactive Content** — Multimedia decks, hotspots, updatable content; forthcoming: feedback forms, calendar reminders
3. **Campaign Architecture** — Chapter-based organization, multi-channel actions, custom messaging
4. **Intelligence & Reporting** — Live maps, viral analytics, AI narratives, public dashboards
5. **Safe Testing & Deployment** — Simulation mode, one-click QR, short URLs

### "How Campaigns Are Organized" — Campaign Structure Diagram
Visual hierarchy: Campaign → Chapters (zip/code) → Actions (QR/SMS/Email), with annotations for custom messaging, test mode, and AI narratives.

### Files Changed
1. `src/components/landing/FeatureGrid.tsx` — New 5-card feature grid component
2. `src/components/landing/CampaignStructureDiagram.tsx` — New campaign hierarchy diagram component
3. `src/pages/LandingPage.tsx` — Imports and renders the two new section components
