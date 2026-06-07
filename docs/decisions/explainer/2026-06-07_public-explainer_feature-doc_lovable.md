# Public Explainer page (`/explainer`)

**Status:** Approved & Implemented
**Date:** 2026-06-07

## Summary

A single, friendly, public page at `/explainer` (also exportable as a PDF via
the browser's print dialog) aimed at curious readers and prospective
volunteers. No prior knowledge of campaigns or analytics assumed; no jargon
in the body.

## Audience & voice

- Curious public, prospective volunteers, friends-of-organizers.
- Reading level: general newspaper. Short paragraphs, one idea per section.
- Plain language; no L00/L01/EoA/utm jargon.

## Sections (mid-depth, ~6 minutes)

1. Why this exists — the samizdat story.
2. What it feels like to receive one — viewer journey as a short narrative.
3. How an organizer uses it — campaign anatomy + three-step workflow.
4. Privacy and trust — what we never collect vs. what we see, plus the
   IP-purge promise.
5. Glossary — 8 plain-English terms.
6. Want to know more? — quiet pointer back to the landing page.

## Format & delivery

- Public route `/explainer` (no auth, no sidebar — mirrors `/landing`).
- Long-scroll layout with sticky TOC on desktop, in-page anchor menu on
  mobile.
- "Download PDF" button calls `window.print()`; a print stylesheet renders a
  letter-size, ink-friendly version. No new dependency or edge function.

## Visuals

- **No screenshots** — keeps the doc accurate as the product UI evolves and
  avoids exposing real campaign content.
- Three inline-SVG diagrams in `src/components/explainer/ExplainerDiagrams.tsx`:
  message-travel, campaign-anatomy, privacy.

## Files created

- `src/content/explainer/explainer.md` — canonical copy.
- `src/components/explainer/ExplainerDiagrams.tsx` — inline-SVG diagrams.
- `src/pages/Explainer.tsx` — page + print stylesheet.
- `src/App.tsx` — route wired at `/explainer`.

## Out of scope

- Setup instructions / how-to-build-a-campaign tutorials.
- Technical architecture, database, security internals.
- Roadmap, threat models, error states.
- Screenshots of the live product.

## Open questions deferred

- Final naming ("Explainer" vs "What is Samizdat?") — current page uses
  "What is Samizdat?" as the headline and `/explainer` as the URL.
- Tone of section 1 — currently warm/storytelling.
- Organizer call-to-action at the end — currently informational, points back
  to whoever handed out the card.
