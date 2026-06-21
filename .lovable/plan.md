## 1. Always open with a greeting

a. In `supabase/functions/draft-campaign-message/index.ts`, append to the system prompt: *"Always begin the message with a brief greeting such as 'Hi', 'Hello', 'Hey', or 'Friends' — followed by a comma, then the first sentence."*
b. No client changes; this affects every newly generated SMS and email at every level (campaign + chapter, L00 + L01).

## 2. Confirm dialog on every bulk generate (option 2a)

a. In `src/components/CampaignChapters.tsx`, change `handleBulkGenerateClick` so that **every** click of "Generate all 4 drafts" opens a confirm dialog — not only when fields already have text.
b. The dialog lists, for the chosen scope (campaign default or a named chapter):
   - which of the 4 fields will be written (unlocked)
   - which will be skipped (locked)
   - which currently have text that will be overwritten
c. Buttons: **Cancel** (default focus) and **Generate N drafts**.
d. The existing `pendingBulkOverwrite` state is reused/renamed to `pendingBulkGenerate` so we don't add a second dialog component.

## 3. Lock-by-default for chapter rows (option 2d)

a. When a chapter row is rendered and there is no entry yet in `localStorage` under `campaign-message-locks:${campaignId}` for that chapter's `mobilize_code`, treat all 4 of its fields as **locked** and persist that initial state.
b. The campaign-level (scope = null) defaults are **not** locked by default — those are the ones you author by hand, and you've already filled them in. Only per-chapter scopes get the default lock.
c. Existing chapters that already have any lock state in localStorage are left untouched (no surprise relocking of work in progress).
d. With all 4 locked, the chapter's "Generate all 4 drafts" button stays disabled (already wired via `allLocked`) and individual generate buttons are disabled per field. The user must explicitly click 🔓 on the fields they want drafted.

## 4. Verification

a. Generate one SMS and one email at L00 and L01; confirm each output starts with a greeting word followed by a comma. Screenshot the result.
b. On a campaign with empty chapter fields, click "Generate all 4 drafts" on the campaign-level row — confirm the new dialog appears before any network request is made (check Network tab: no POST to `draft-campaign-message` until **Generate** is clicked).
c. Open a campaign that has at least one chapter you have never touched — confirm all 4 lock icons render in the locked (amber) state and the chapter's bulk button is disabled.
d. Unlock one field on that chapter, click bulk generate, confirm the dialog shows "1 will be generated, 3 skipped (locked)".
e. Reload the page — confirm the lock state persists.

## 5. Files touched

a. `supabase/functions/draft-campaign-message/index.ts` — greeting rule in system prompt.
b. `src/components/CampaignChapters.tsx` — confirm-always dialog for bulk generate; lock-by-default initialization for chapter scopes.
c. `docs/decisions/messaging/2026-06-04_ai-drafts-prominent-controls_feature-doc_lovable.md` — append `## Update — 2026-06-21` section recording the greeting rule, the always-on confirm dialog, and lock-by-default for chapters. This updates an existing plan rather than creating a new one.

No DB changes, no new edge functions, no new routes.
