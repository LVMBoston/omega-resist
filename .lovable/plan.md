## Campaign Brief Wizard — Plan

Status: Proposed — replaces the plain Description textarea in `CampaignWizard` step 1 and upgrades the AI message drafter to consume the new structured brief.

### 1. What it produces

a. A **structured brief** stored on `campaigns.brief` (new `jsonb` column) with these fields:
   - `what` — one-sentence description of the event/action
   - `why` — why it matters, the stakes
   - `when` — date/time or "ongoing / nationwide"
   - `where` — locations or scope
   - `who` — audience the ask is aimed at
   - `ask` — the concrete call to action
   - `key_facts[]` — bullet facts the AI must include
   - `do_not_say[]` — guardrails the AI must avoid
   - `tone` — urgent | informative | hopeful | defiant
b. A **synthesized human description** saved to the existing `campaigns.description` field. Downstream code that reads `description` keeps working unchanged.
c. An **optional refined campaign title** (the user can accept an AI-suggested rename). The slug is never touched.

### 2. Wizard UX (a new component, mounted inside `CampaignWizard` step 1)

a. The current free-text Description textarea is replaced by a "Build campaign brief" panel showing a stepper with the fields above.
b. Each field has:
   - A short helper line explaining what makes a good answer
   - A textarea for the user's input
   - A small `✨ Suggest` button that calls AI to draft just that field from whatever's already filled in (campaign name + any prior answers). User can accept, edit, or ignore.
c. The final step is a **Preview** screen showing:
   - The synthesized description paragraph (editable)
   - A "Regenerate description" button
   - A "Suggest a better campaign name" button — if user accepts, the campaign `title` updates (slug stays locked)
d. The wizard can be skipped: users can leave fields blank and just type a plain description like before.

### 3. AI plumbing

a. Rename the existing edge function `draft-campaign-message` stays as-is for SMS/email drafting, but its prompt is upgraded: when a `brief` is present on the campaign, the function pulls `what / why / ask / key_facts / do_not_say / tone` into the prompt instead of just the loose description. This is the "downstream wiring" benefit — drafts get noticeably more specific.
b. A new edge function `draft-campaign-brief` handles three modes via a `mode` param:
   - `suggest_field` — drafts one field (e.g. "why") from current partial brief
   - `synthesize_description` — turns the full brief into the polished paragraph
   - `suggest_title` — proposes a refined campaign name from the brief
c. All three modes use Lovable AI Gateway (`google/gemini-3-flash-preview`) with the same hardened CORS headers we just fixed.

### 4. Data model change

a. New migration: `ALTER TABLE public.campaigns ADD COLUMN brief jsonb;`
b. No RLS changes needed — `campaigns` policies already cover the new column.
c. `description` column stays. Old campaigns without a brief keep working; the wizard is also reachable from Campaign Detail later (out of scope for this round per your answer — wizard lives only in CampaignWizard for now).

### 5. Files touched

a. New: `supabase/migrations/<ts>_campaigns_brief.sql`
b. New: `supabase/functions/draft-campaign-brief/index.ts`
c. New: `src/components/CampaignBriefWizard.tsx` (the stepper panel)
d. Edit: `src/components/CampaignWizard.tsx` — step 1 now embeds `CampaignBriefWizard`; on submit, both `description` and `brief` are saved
e. Edit: `supabase/functions/draft-campaign-message/index.ts` — prompt upgraded to read structured brief when present
f. New decision doc: `docs/decisions/messaging/2026-06-04_campaign-brief-wizard_feature-doc_lovable.md`

### 6. Out of scope (explicitly)

- Adding the wizard to the Campaign Detail page for existing campaigns (deferred to a follow-up)
- Editing the brief after campaign creation (deferred)
- Backfilling briefs for existing campaigns
- Changing how narratives consume the description — they continue reading `campaigns.description` and benefit automatically from the better synthesized paragraph

### 7. Open questions before I build

a. Should "Suggest a better campaign name" only show when the *current* name is short/generic, or always be available?
b. Should there be a hard length cap on `key_facts[]` / `do_not_say[]` (e.g. max 5 each) so AI prompts stay tight?
c. Tone is currently per-message in step 2. Do you want the brief's `tone` to become the *default* for the message drafter (user can still override)?

Reply with answers to 7a–7c (or "go ahead with sensible defaults") and I'll implement.
