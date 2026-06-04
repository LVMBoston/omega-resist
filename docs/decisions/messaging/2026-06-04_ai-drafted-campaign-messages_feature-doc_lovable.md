# AI-Assisted Message Drafting in Campaign Wizard Step 2

**Status: Approved & Implemented** — Date: 2026-06-04

This is a **new** feature plan; it does not update any prior decision doc. On approval, archive at `docs/decisions/messaging/2026-06-04_ai-drafted-campaign-messages_feature-doc_lovable.md`.

---

## 1. Goal

In `CampaignWizard.tsx` Step 2, let the user click a **Generate** button next to each of the four message fields. The system uses the campaign's **Name + Description** from Step 1 (plus a tone selector and the channel/level context) to draft a short message via Lovable AI, then drops the result into that field.

What the user sees:
- Four small "✨ Generate" buttons, one per textarea (SMS L00, SMS L01, Email L00, Email L01).
- A tone dropdown at the top of Step 2 (Urgent / Informative / Hopeful / Defiant).
- If a field already has text, a small confirm dialog asks "Replace existing draft?" before overwriting.
- A loading spinner replaces the button while generating; errors show as a red toast.

---

## 2. Scope

a. **In scope:** UI buttons, tone selector, backend edge function that calls Lovable AI, prompt design tuned per channel/level, overwrite confirmation, error handling for rate limit (429) and credits (402).
b. **Out of scope:** Saving drafts as templates, regenerating chapter-level messages (Step 3), editing Global defaults, batch generation across multiple campaigns.

---

## 3. UX details

a. **Tone selector** — A single `Select` placed above the four textareas. Default: *Informative*. Applies to every Generate click in the step.
b. **Per-field button** — Small `ghost` button with a Sparkles icon + "Generate", positioned at the right edge of each field's `Label` row. Disabled when:
  - Campaign Name or Description (Step 1) is empty → tooltip: "Add a campaign name and description in Step 1 first."
  - A generation is already in flight for that field.
c. **Overwrite confirm** — If the textarea has non-whitespace content, open a small `AlertDialog`: "This will replace your current draft. Continue?" with Cancel / Replace.
d. **Loading state** — Button shows `<Loader2 className="animate-spin" />` + "Generating…". The textarea is left editable.
e. **Errors** — Use existing `useToast` with `variant: "destructive"`:
  - 429: "Too many requests — please wait a moment and try again."
  - 402: "AI credits exhausted. Add credits in workspace settings."
  - Other: "Couldn't generate message. Please try again."

---

## 4. Prompt design (backend)

The edge function receives `{ campaignTitle, campaignDescription, tone, channel, level }` and builds one prompt per call. Constraints baked into the system prompt:

a. **SMS L00** — ≤ 280 chars, first-person opener from an organizer to a friend/contact who has never seen this campaign. Must include `{{link}}` placeholder. No greeting like "Dear". Plain text, no markdown, no emoji unless tone is "Hopeful".
b. **SMS L01** — ≤ 280 chars, written for a recipient who is forwarding to *their* contacts (one degree out). Must include `{{link}}`. Tone slightly more explanatory ("a friend shared this with me…").
c. **Email L00** — 2–4 short paragraphs, organizer→contact. Include `{{link}}` on its own line. No subject line in the body; subject is handled elsewhere.
d. **Email L01** — 2–4 short paragraphs, recipient→their contacts. Include `{{link}}`.
e. **Placeholders allowed:** `{{link}}`, `{{city}}`, `{{state}}`, `{{site_name}}` — system prompt instructs the model to use them naturally and never to invent other `{{...}}` tokens.
f. **Tone modifier** appended to system prompt, e.g. *"Tone: Defiant — confident, plainspoken, refuses the regime's framing; avoid melodrama."*

---

## 5. Technical details

a. **New edge function** `supabase/functions/draft-campaign-message/index.ts`:
  - POST body: `{ campaignTitle, campaignDescription, tone, channel: 'sms'|'email', level: 'l00'|'l01' }` validated with Zod.
  - Calls Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with model `google/gemini-2.5-flash`, `stream: false` (responses are short — no streaming needed; simpler client code).
  - Returns `{ text: string }`. Surfaces 429/402 with matching status codes per Lovable AI guidance.
  - CORS headers, no auth required by config (`verify_jwt` already defaults to false for Lovable-managed functions).
b. **Client wiring in `CampaignWizard.tsx`:**
  - New state: `tone` (default `"informative"`), `generatingField: 'smsL00'|'smsL01'|'emailL00'|'emailL01'|null`, `confirmField` for overwrite dialog.
  - New helper `handleGenerate(field)`: validates Step 1 inputs → checks overwrite → calls `supabase.functions.invoke('draft-campaign-message', { body: ... })` → writes result into `overrides[field]`.
  - Imports: `Sparkles`, `Loader2` from `lucide-react`; `Select`, `AlertDialog` from `@/components/ui/*`.
c. **No DB changes.** No new tables, no new RLS.
d. **Secrets.** `LOVABLE_API_KEY` is auto-provisioned by Lovable Cloud; verify presence at deploy time only.

---

## 6. Files touched

a. `supabase/functions/draft-campaign-message/index.ts` — **new**
b. `src/components/CampaignWizard.tsx` — add tone selector, per-field Generate buttons, overwrite dialog, invoke logic
c. `docs/decisions/messaging/2026-06-04_ai-drafted-campaign-messages_feature-doc_lovable.md` — **new** (archive of this plan after implementation)

No other files change.

---

## 7. Verification

a. With a campaign description filled in, click Generate on each of the 4 fields; confirm a sensible draft appears that includes `{{link}}` and respects the length constraint.
b. Try Generate with the description empty → button is disabled with tooltip.
c. Type text into a field, click Generate → confirm dialog appears; Cancel keeps text, Replace overwrites.
d. Switch tone to *Defiant*, regenerate → output noticeably changes voice.
e. Browser console + network panel: confirm one POST to the edge function per click, response within ~3 s.