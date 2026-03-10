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
