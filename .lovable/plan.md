# Plan — Extract a campaign brief from an existing description

## What you'll see

1. On a campaign that doesn't have a brief yet (like Conservative Fracture), a new button appears: **"Extract brief from description (AI)"**.
   a. Location: Campaign Detail page (`/campaigns/:id`), in a small admin panel near the description. This is the same page you'd edit a campaign on, so it's the natural home.
   b. If a brief already exists, the button label switches to **"Re-extract brief from description"** and warns it will overwrite.
2. Clicking it calls AI, reads the existing free-form description, and proposes a structured brief: what / why / when / where / who / ask, plus key facts, do-not-say, and tone.
3. A modal pops up showing the proposed brief in a read-only preview with two buttons: **Save** (writes to `campaigns.brief`) or **Cancel**.
4. Once saved, the next time AI drafts an SMS or email for this campaign, it'll automatically use the structured brief — no other change needed, because the message drafter already reads `campaigns.brief` when present.

## What this does NOT do (deferred — note added to file)

- It does not add the full guided wizard (the multi-field editor with per-field Suggest buttons) to existing campaigns. That's the "real" fix and is still deferred. We'll add a short note to `docs/decisions/messaging/2026-06-04_campaign-brief-wizard_feature-doc_lovable.md` saying: extraction shipped as an interim tool; full edit-brief-on-existing-campaign wizard still pending.

## Technical detail

1. **Edge function** — `supabase/functions/draft-campaign-brief/index.ts`
   a. Add a new `mode: "extract_brief"` that takes `{ campaignTitle, description }` and returns a JSON object matching the `CampaignBrief` shape (what/why/when/where/who/ask as strings, key_facts and do_not_say as string arrays capped at 5, tone as one of the 4 enums).
   b. Use the existing Lovable AI gateway call with `google/gemini-2.5-flash` and `response_format: { type: "json_object" }`. Validate the parsed object before returning; clamp arrays to 5; fall back tone to `informative` if missing/invalid.
   c. Reuse the existing 429 / 402 / error handling.

2. **Frontend** — new small component `src/components/ExtractBriefButton.tsx`
   a. Props: `campaignId`, `campaignTitle`, `description`, `existingBrief`, `onSaved`.
   b. Calls `supabase.functions.invoke("draft-campaign-brief", { body: { mode: "extract_brief", campaignTitle, description } })`.
   c. Shows result in a `Dialog` with the brief rendered as labeled read-only blocks (reusing the same field labels from `CampaignBriefWizard`).
   d. On Save: `supabase.from("campaigns").update({ brief }).eq("id", campaignId)`, toast success, call `onSaved`.

3. **Mount point** — `src/pages/CampaignDetail.tsx`
   a. Add the button in the existing description/admin area. Pass current description and brief from the loaded campaign row.
   b. After save, refetch the campaign so the UI reflects "brief: present".

4. **Doc note** — append to `docs/decisions/messaging/2026-06-04_campaign-brief-wizard_feature-doc_lovable.md`:

   ```
   ## Update — 2026-06-20
   Shipped interim tool: "Extract brief from description (AI)" button on Campaign Detail.
   It one-shot generates a structured brief from the existing free-form description and
   saves it to campaigns.brief, so AI message drafts get the structured facts immediately.

   Still deferred (real fix): the full guided wizard for editing briefs on existing
   campaigns. The extraction tool is a stopgap — it's not editable inline beyond
   review/save. Build the full editor next.
   ```

## After approval, decision-log filing

This update extends the existing plan **"Campaign Brief Wizard" (`docs/decisions/messaging/2026-06-04_campaign-brief-wizard_feature-doc_lovable.md`)**, so per the decision log rule I'll append it there as a new `## Update — 2026-06-20` section rather than creating a new doc. The same "deferred" note above doubles as that decision-log entry.
