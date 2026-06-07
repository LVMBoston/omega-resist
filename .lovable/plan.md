## Goal

Create a single, friendly **Explainer** that someone with no technical background — a curious visitor or a prospective volunteer — can read end-to-end in 5–8 minutes and walk away understanding what Samizdat/Omega is, what it feels like to use, and why it can be trusted.

Primary surface: a new public page at **`/explainer`**. Secondary surface: a **downloadable PDF** generated from the same content so people can email or print it.

**No screenshots.** All visuals are drawn (inline SVG diagrams, simple illustrations) so the doc never goes stale when the UI changes and we don't expose any real campaign content.

## Audience & voice

1. **Reader profile**
   a. Curious public, prospective volunteers, friends-of-organizers.
   b. Assumes no knowledge of campaigns, analytics, or what a QR code does beyond "you point your phone at it."
   c. Reading level: general newspaper. Short paragraphs. One idea per section.

2. **Voice rules**
   a. Plain language. Concrete nouns. ("A card with a QR code", not "an L00 placement.")
   b. Show with a story or a diagram, then explain.
   c. No jargon in the body (no L00 / L01 / EoA / utm_content). "Trust chain" is defined once, then used sparingly.
   d. Honest about what's tracked and what isn't — privacy is a feature, not a footnote.

## What the Explainer covers (4 sections, mid-depth)

3. **Why this exists — the samizdat story** (~1 page)
   a. The historical practice in 2–3 short paragraphs: hand-copied texts, trust, no broadcast.
   b. The one thing old samizdat could never do: *know whether the message was actually spreading*.
   c. One-line bridge: "Omega keeps the trust, adds the feedback — without surveilling anyone."

4. **What it feels like to receive one** (the viewer journey, ~1.5 pages)
   a. Written as a short narrative: someone hands you a card, you scan, a deck opens on your phone, you tap something interesting, you watch a video, you decide to share it with one friend.
   b. A simple inline SVG illustration alongside the narrative: card → phone → two more phones.
   c. End with "what you didn't have to do": no signup, no app, no account, no email.

5. **How an organizer uses it** (the producer side, ~1.5 pages)
   a. A clean campaign-anatomy diagram (Campaign → Chapters → Actions → Cards & links), drawn as inline SVG. Style-aligned with the existing `CampaignStructureDiagram`.
   b. Three short illustrated steps: *build a deck → mint cards and links for each chapter → watch the map fill in*.
   c. What organizers see, in plain words: a live map, a story of how the message traveled, simple counts. No metric jargon.

6. **Privacy & trust** (~1 page)
   a. What we never collect: names, emails, phone numbers from viewers.
   b. What we do see: rough location (city/region), how a share traveled hop to hop, what channel it used (text, email, QR).
   c. The IP-purge promise in one sentence: "We use your IP only to figure out your approximate zip code, then we delete it."
   d. Why this is deliberate — tie back to the samizdat trust principle.

7. **Glossary & "tell me more"**
   a. 6–8 plain-English definitions a curious reader might hear from an organizer (deck, chapter, action, trust chain, share, hotspot, feedback form).
   b. Quiet links to the existing public landing page and the deeper `SAMIZDAT_NARRATIVE.md`.

## Format & delivery

8. **Web page at `/explainer`**
   a. New public route in `src/App.tsx`, no auth, no sidebar — mirrors `/landing`.
   b. Long-scroll layout, sticky table of contents on desktop, in-page anchor menu on mobile.
   c. Uses existing semantic tokens (dark theme, current typography). Rhythm: short text → diagram → short text.
   d. "Download PDF" button in the header.
   e. Section-numbered headings (1, 2, 3…) so the printed PDF reads cleanly.

9. **PDF version**
   a. Generated from the same source content (a single markdown file under `src/content/explainer/`) so we never maintain two copies.
   b. Approach: client-side render-to-PDF (e.g. `html2pdf`/`react-to-print`) of the explainer page. Avoids a new edge function. Fall back to a small `generate-explainer-pdf` edge function (same pattern as `generate-campaign-pdf`) only if quality is poor.
   c. Letter-size, sans-serif, generous margins, page numbers, "Last updated" date in the footer.

## Visual assets

10. **Reuse**
    a. Samizdat narrative copy from `docs/SAMIZDAT_NARRATIVE.md`, rewritten in plain voice (the current version is aimed at partners).
    b. Visual styling from `FeatureGrid` and `CampaignStructureDiagram` in `src/components/landing/`.

11. **New (all inline SVG, no photography, no UI screenshots)**
    a. A "how a message travels" illustration: a card → an arrow to a phone → arrows to two more phones.
    b. A campaign-anatomy diagram (Campaign → Chapters → Actions → Cards & links).
    c. A small "privacy" diagram showing what enters the system (a scan) and what gets discarded (the IP).

## What this Explainer is NOT

12. **Out of scope (intentionally)**
    a. Setup instructions, admin walkthroughs, how-to-build-a-campaign tutorials — those belong in organizer docs.
    b. Technical architecture, database, security internals, token hierarchy details.
    c. Roadmap or feature backlog.
    d. Anything that would alarm a casual reader (threat models, edge cases, error states).

## Build sequence

13. **Phase 1 — Content first (no code)**
    a. Draft the four sections plus glossary as plain markdown in `src/content/explainer/explainer.md`.
    b. Review pass focused only on jargon, sentence length, and "would my aunt understand this?"

14. **Phase 2 — Page**
    a. Create `src/pages/Explainer.tsx`, render the markdown, wire `/explainer` route.
    b. Build the three inline-SVG diagrams as small React components.
    c. Add anchor TOC + section numbering.

15. **Phase 3 — PDF**
    a. Add "Download PDF" using client-side rendering of the same page.
    b. QA the PDF page-by-page (no clipped diagrams, no orphan headings, footer present).

16. **Phase 4 — Polish & link from existing surfaces**
    a. Quiet link from the public landing page footer: "New here? Read the Explainer."
    b. Link from the in-app sidebar footer so organizers can share it with friends.

## Decision doc

17. **Filing**
    a. This is a new plan. On approval, archive as `docs/decisions/explainer/2026-06-06_public-explainer_feature-doc_lovable.md` with `Status: Approved & Implemented` once Phase 4 is done.

## Open questions worth answering before Phase 1

18. **Naming**: Call it "Explainer", "What is Samizdat?", "About", or something else? Affects the URL and the headline.

19. **Tone for section 3 (samizdat history)**: *historical/sober* or *warm/storytelling*? Same facts, very different feel.

20. **Do we want a "for organizers" call-to-action** at the very end (e.g. "Interested in running a campaign? Get in touch") or keep the doc purely informational?
