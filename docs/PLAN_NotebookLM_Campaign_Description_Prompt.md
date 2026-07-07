# NotebookLM Prompt for Campaign Descriptions

Status: Pending (not yet approved for implementation)

No code changes required to deliver the prompt itself. This document captures a copy-paste prompt to give NotebookLM so it produces a campaign description that maps cleanly onto the app's Campaign Brief structure (`what / why / when / where / who / ask / key_facts / do_not_say / tone`). The output can be pasted straight into the Campaign description field, and the existing `draft-campaign-brief` edge function can reverse-extract it into the Brief wizard.

## 1. How it fits the app

a. The description entered on a new campaign is the seed for AI message drafts, narratives, and reports.
b. `supabase/functions/draft-campaign-brief` supports an `extract_brief` mode that turns a free-form description into structured brief fields — the prompt below is shaped to produce prose that extractor handles cleanly.
c. Tone must be one of: `urgent`, `informative`, `hopeful`, `defiant`.

## 2. The generic NotebookLM prompt (copy-paste)

````text
You are drafting a campaign description for a grassroots civic organizing tool. Use ONLY facts found in the sources in this notebook. Do not invent dates, names, numbers, locations, or quotes. If a detail is missing from the sources, omit it — never fill with a placeholder.

CAMPAIGN NAME: <paste campaign name, or write "(untitled)">
AUDIENCE: <who the message is for, e.g. "people in the U.S. who are new to this issue">
DESIRED TONE: <one of: urgent | informative | hopeful | defiant>
DESIRED ASK: <the single concrete action you want people to take, e.g. "RSVP to a local rally", "text 5 friends the share link", "call their senator">

Write the output in TWO parts.

PART 1 — DESCRIPTION (2–4 short sentences, plain prose, no headings, no bullets, no markdown):
- Sentence 1: what is happening (concrete, active voice).
- Sentence 2: why it matters now — the stakes and who is affected.
- Optional sentence 3: when / where, only if the sources specify it.
- Final sentence: the ask, stated as a concrete call to action.
- Do not use clichés ("stand up", "rise up", "together we…").
- Do not use the word "protest" unless the sources use it; prefer "rally", "action", or "event" if unclear.

PART 2 — STRUCTURED BRIEF (return as a JSON object, no code fences, no commentary):
{
  "what":  "one concrete sentence describing the event or action",
  "why":   "up to two sentences on stakes, who is affected, what is at risk",
  "when":  "date/time, or 'ongoing', or '' if unknown",
  "where": "locations or scope with geographic level, or '' if unknown",
  "who":   "one sentence naming the audience the ask is aimed at",
  "ask":   "one sentence stating the concrete call to action",
  "key_facts": ["up to 5 concrete factual claims (names, dates, numbers, quotes) that AI drafts must always include"],
  "do_not_say": ["up to 5 phrases or framings to avoid, only if the sources imply any; otherwise []"],
  "tone": "urgent | informative | hopeful | defiant"
}

RULES:
- Every claim in PART 1 must be supported by the sources; cite inline as (Source: <title>) after any specific fact.
- Any field in PART 2 with no support in the sources must be an empty string "" (or [] for lists).
- Do not editorialize beyond what the sources say.
- Keep total output under 400 words.
````

## 3. How to use it

a. Open the NotebookLM notebook that already contains the source material for this campaign.
b. Paste the prompt above into the NotebookLM chat, filling in the four `<...>` slots at the top.
c. Copy PART 1 into the Description field on the New Campaign screen in the app.
d. Optional: use PART 2 to hand-fill the Brief wizard fields, or paste PART 1 into the description and then trigger the app's extract-brief action to auto-populate the wizard.

## 4. What is not changing

- No code, schema, or edge-function changes.
- No changes to `CampaignBriefWizard` or `draft-campaign-brief` — the prompt is designed to match their existing shape.

## 5. Optional follow-up features (only if approved later)

a. Add a "Copy NotebookLM prompt" button on the New Campaign screen so the prompt is one click away.
b. Add short in-app helper text near the Description field pointing to the prompt.
