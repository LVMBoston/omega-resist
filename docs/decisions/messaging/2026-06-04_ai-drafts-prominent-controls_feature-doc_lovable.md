Status: Approved & Implemented
Date: 2026-06-04

# AI Drafts — Prominent Controls

Updates the original 2026-06-04 AI-drafted campaign messages plan
(`2026-06-04_ai-drafted-campaign-messages_feature-doc_lovable.md`) to make
the AI Generate controls clearly visible on every campaign, not just the
ones where users happened to spot the small per-field button.

## Problem

After per-field Generate buttons were added to `CampaignChapters`, a user
reported that on campaigns other than "Autocratic Framing and Response"
the Generate button "didn't appear at all." Investigation found the code
path was identical for every campaign, but the per-field button was a
small ghost-styled element easily lost in the field-label row.

## Changes

1. `src/components/CampaignChapters.tsx`
   a. New `BulkGenerateBar` component shown at the top of both the
      Campaign-Level Messaging Overrides card and each expanded chapter
      card. Contains: AI ready/not-ready status pill, tone selector,
      and a primary "Generate all 4 drafts" button.
   b. New `runBulkGenerate` / `handleBulkGenerateClick` flow runs all
      four message fields sequentially through `draft-campaign-message`
      and shows a single overwrite-confirmation dialog when any field
      already has content.
   c. `GenerateButton` rewritten to render an outline-styled button
      always (no tooltip-wrapped early return). When disabled it shows
      a `title` tooltip explaining why.
   d. The bulk bar surfaces an inline amber "Needs campaign description"
      hint when `canGenerate` is false, with guidance on where to set it.

2. `docs/decisions/messaging/2026-06-04_ai-drafts-prominent-controls_feature-doc_lovable.md` (this file).

## What did not change

- The `draft-campaign-message` edge function or its prompts.
- Database schema or `campaign_message_overrides` storage layout.
- The existing per-field Generate button (kept as secondary affordance,
  just visually upgraded to outline variant).
- `CampaignWizard` — deferred; the wizard already has per-field generate
  on Step 2 and was not part of the reported bug.

## Verification

a. Open BUGTEST campaign → Chapters tab → expand Campaign-Level Messaging
   Overrides. A bordered AI drafting bar shows at the top with a green
   "Ready" pill and a primary "Generate all 4 drafts" button.
b. Clicking it generates SMS L00, SMS L01, Email L00, Email L01
   sequentially, with the loading state visible on the bulk button.
c. If any field already has content, an overwrite confirmation lists the
   affected fields before proceeding.
d. The same bar appears on every expanded chapter card.
e. On a campaign with no description, the pill shows amber
   "Needs campaign description" and both bulk and per-field Generate
   buttons are visibly disabled with an inline explanation.
