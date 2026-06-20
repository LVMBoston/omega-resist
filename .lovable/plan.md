# Plan — Editable brief extraction modal

## What you'll see

1. Click **"Extract brief from description (AI)"** on Campaign Detail.
2. AI drafts the brief and opens the same modal.
3. Instead of read-only text, every field is now editable inline: what / why / when / where / who / ask, key facts, do-not-say, and tone. You can tweak, delete, or add items just like in the new-campaign wizard.
4. Click **Save** to write the edited version to `campaigns.brief`.

## Technical detail

### 1. `src/components/ExtractBriefButton.tsx`
- Replace the read-only field blocks with the existing `CampaignBriefWizard` component.
- Pass the extracted `draft` into the wizard's `brief` prop, with `onBriefChange` wired to `setDraft` so edits update local state.
- Pass empty strings for `campaignTitle`, `description`, and `onTitleChange` / `onDescriptionChange` (the wizard's synthesize / title-suggest features are irrelevant here; they'll be no-ops or hidden).
- Keep the same Save handler — it writes `draft` (now reflecting any user edits) to the database.

### 2. `src/components/CampaignBriefWizard.tsx` — minor adjustments
- The wizard currently assumes it's embedded in a form with a description synthesis block at the bottom. In extraction-modal mode we don't need that block.
- Add an optional `hideSynthesis?: boolean` prop. When true, omit the "Campaign description" synthesis section and the "Suggest a better name" button.
- This keeps the wizard reusable without visual clutter in the extraction flow.

### 3. Verification
- Open Campaign Detail for a campaign with a description and no brief.
- Click Extract → modal opens with editable fields.
- Change one field, click Save, reload → brief reflects the edit.

## What does NOT change

- The AI extraction prompt and edge function (`draft-campaign-brief`) stay exactly the same.
- The "Re-extract" overwrite warning stays the same.
- The button location and styling stay the same.