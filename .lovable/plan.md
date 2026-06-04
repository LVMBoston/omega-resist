## What you're seeing

On the campaign you opened (BUGTEST), the small "Generate" buttons next to each message field aren't appearing at all in the **Campaign-Level Messaging Overrides** card. On "Autocratic Framing and Response" they do appear.

## What I checked

1. The edge function (`draft-campaign-message`) works — I can call it directly and it returns a draft.
2. The Generate-button code in `src/components/CampaignChapters.tsx` is wired the same way for every campaign — there's no campaign-specific branch.
3. The campaign description for BUGTEST is populated in the database, so the "missing description" path shouldn't apply.

Because nothing in the code should hide the button per-campaign, the most likely real-world causes are:
   a. The small per-field button is genuinely there but visually lost (it's a tiny ghost button to the right of the field label, easy to miss).
   b. A stale cached bundle is being served on that tab, and the button literally isn't in the DOM yet.
   c. An edge case in the render (e.g. `gen` prop dropped somewhere) is silently skipping the button on cards where overrides already exist.

## The plan — make Generate impossible to miss and self-diagnosing

### 1. Add a prominent "Generate AI drafts" action bar at the top of every overrides card

a. In `src/components/CampaignChapters.tsx`, add a clearly visible primary-styled button row at the top of both the **Campaign-Level Messaging Overrides** card and each **Chapter** card, labeled "Generate AI drafts" with the Sparkles icon.
b. Clicking it opens a small inline panel with: tone selector, four checkboxes (SMS L00, SMS L01, Email L00, Email L01) pre-checked, and a "Generate selected" button.
c. The panel runs each selected field through the existing `runGenerate` flow sequentially, showing per-field progress.
d. Keep the existing tiny per-field Generate buttons as a secondary affordance.

### 2. Always render the per-field Generate button, never conditionally

a. Audit `renderOverrideFields` / `GenerateButton` so the button element is always in the DOM for sms/email body fields, regardless of `gen` truthiness or `canGenerate` state.
b. When `canGenerate` is false, render the button visibly disabled with an inline reason ("Campaign needs a title and description") next to it — not as a tooltip-only hint.

### 3. Show the live "ready/not ready" state at the top of the card

a. Add a one-line status under the card title: "AI drafting: ready" (green dot) or "AI drafting: needs campaign description" (amber dot), pulled from the same `canGenerate` value.
b. If not ready, include a one-click link "Edit campaign description" that opens the campaign edit dialog/page so the user can fix it without navigating.

### 4. Mirror the same prominent action bar in the Create Campaign wizard (Step 2)

a. `src/components/CampaignWizard.tsx` already has per-field Generate; add the same top-of-card "Generate AI drafts" action bar so the experience is consistent between creation and editing.

### 5. Force a fresh bundle so cached views update

a. No code change required, but after deploying I will ask you to hard-reload (Cmd-Shift-R) the campaign page once to rule out a stale bundle, and confirm the new action bar shows on BUGTEST.

## What does not change

- The edge function `draft-campaign-message` and its prompts.
- Database schema or message storage.
- The Overwrite confirmation dialog.
- The global-defaults fallback behavior.

## Files touched

- `src/components/CampaignChapters.tsx` (primary changes for items 1, 2, 3)
- `src/components/CampaignWizard.tsx` (item 4)
- New decision doc: `docs/decisions/messaging/2026-06-04_ai-drafts-prominent-controls_feature-doc_lovable.md` (per the Decision Log rule — this updates the existing 2026-06-04 AI-drafts plan in the same folder).

## Verification (per Visual Bug Debugging Rule)

a. Open BUGTEST campaign → Campaign-Level Messaging Overrides → confirm "Generate AI drafts" action bar is visible at the top.
b. Click it, generate all four fields, confirm text appears in each field.
c. Repeat on a campaign with no description: confirm the amber "needs campaign description" status shows and buttons are disabled-but-visible with the reason inline.
d. Confirm the same on a chapter card and in the Create Campaign wizard.
