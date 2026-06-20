# Campaign Brief Wizard

Status: Approved & Implemented
Date: 2026-06-04

## What changed (in plain terms)

When you create a campaign, the old single "Description" textbox is replaced by a guided wizard. You answer short prompts — what's happening, why it matters, when, where, who you're talking to, the ask — plus optional lists of "key facts AI must include" and "things AI must NOT say". Every field has a small ✨ Suggest button that drafts that field from whatever you've already filled in. At the bottom, a single click synthesizes a polished description paragraph (saved as the campaign description, exactly like before). You can also click "Suggest a better name" to get an AI-proposed campaign name (the slug is never touched).

All of this is saved into a new `brief` field on the campaign. The AI message drafter (SMS/email L00 + L01) now reads that brief when present, so drafts are noticeably more specific and on-message.

## Data model

- Added `campaigns.brief jsonb` (nullable). No RLS changes.

Shape:
```
{
  what, why, when, where, who, ask: string,
  key_facts: string[] (max 5),
  do_not_say: string[] (max 5),
  tone: "urgent" | "informative" | "hopeful" | "defiant"
}
```

## New / changed files

- New migration: adds `brief jsonb` to `campaigns`
- New: `supabase/functions/draft-campaign-brief/index.ts` — 3 modes (`suggest_field`, `synthesize_description`, `suggest_title`)
- New: `src/components/CampaignBriefWizard.tsx`
- Edit: `src/components/CampaignWizard.tsx` — embeds the brief wizard in step 1; brief saved on insert; brief.tone seeds step-2 messaging tone
- Edit: `src/components/CampaignChapters.tsx` — fetches `brief` and forwards it to `draft-campaign-message`
- Edit: `supabase/functions/draft-campaign-message/index.ts` — accepts optional `brief` and weaves `key_facts` / `do_not_say` / structured facts into the prompt

## Defaults locked in (from open questions 7a–7c)

- a. "Suggest a better name" is always available (not gated)
- b. `key_facts` and `do_not_say` cap at 5 items each
- c. The brief's `tone` becomes the default for the step-2 messaging tone (still overridable)

## Verification

- Migration applied successfully (pre-existing linter warnings unrelated).
- `draft-campaign-brief` deployed; live curl call with `mode=suggest_field, field=why` returned a clean, on-topic draft (200 OK).
- `draft-campaign-message` redeployed with brief-aware prompt; existing call shape backwards-compatible (brief is optional).

## Out of scope (deferred)

- Adding the wizard to Campaign Detail for editing briefs of existing campaigns.
- Backfilling briefs for existing campaigns.
- Surfacing the brief inside narrative/report generation directly (today they read `description`, which is now richer).

## Update — 2026-06-20

Status: Approved & Implemented

Shipped an interim tool: an **"Extract brief from description (AI)"** button on the Campaign Detail page (under the description, near the EoA badge). One click sends the existing free-form description to AI, which returns a structured brief (what/why/when/where/who/ask + key_facts + do_not_say + tone). A modal previews the brief; clicking Save writes it to `campaigns.brief`. From that point on, the AI message drafter automatically uses the structured brief — no other code changed.

If the campaign already has a brief, the button label switches to **"Re-extract brief from description"** and a confirm prompt warns it will overwrite.

### Note — better solution still to come

This is a stopgap, not the real fix. Still deferred:

- The full guided wizard (the multi-field editor with per-field ✨ Suggest buttons used in the new-campaign flow) is **not** yet available for editing briefs on existing campaigns. The extraction modal is review-only — you can't tweak a field inline before saving.
- Next step: mount `CampaignBriefWizard` on Campaign Detail as a proper editor, and add an "Extract from description" action inside it (instead of the standalone button). That replaces this interim button.
