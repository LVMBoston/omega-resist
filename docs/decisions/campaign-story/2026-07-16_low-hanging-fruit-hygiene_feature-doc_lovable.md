# Campaign Story — Low-Hanging-Fruit Hygiene Pass

Status: Approved & Implemented
Date: 2026-07-16

New plan (not an update). Scoped from Claude Code's analysis of `supabase/functions/_shared/render/campaignStory.ts`; only the truly safe items were pulled in this pass. See `docs/decisions/campaign-story/2026-07-08_campaign-story-v2.1_feature-doc_lovable.md` and `docs/decisions/campaign-xlsx-export/2026-07-09_current-export-spec_feature-doc_lovable.md` for prior context (retired vocabulary and Lane A/B relabel).

## 1. What qualifies as low-hanging (recommended)

a. **Fix stale doc comment in `campaignStoryInputs.ts`** — the JSDoc for `broadcastOpens`/`chainViewers` still said "label as 'opens'… Approximate unique viewers", the exact vocabulary retired on 2026-07-09. Rewrote to describe Lane A as "instances" and Lane B as "chain shares", with a note that "opens" / "viewers" are both retired and why. Comment-only.
   - Risk: **None.** No runtime effect.

b. **Remove retired "Sprouted seeds" phrasing from `intentCount` JSDoc** in `campaignStory.ts:29` — rewrote to "Seeds that produced a share link no recipient has opened yet". Comment-only.
   - Risk: **None.**

c. **Add pluralization guard for `singleCarrierTailHops === 1`** in the single-carrier persistence branch of `campaignStory.ts`. Kept the redundant `>= 3` guard (defense-in-depth against a decoupled caller) and added a `hop`/`hops` selector so the sentence stays grammatical if the invariant is ever broken.
   - Risk: **Very low.** Unreachable today given `campaignStoryInputs.ts`'s producer invariant; a correctness improvement, not a behavior change.

d. **Added 5 new test cases** in `src/shared/render/campaignStory.test.ts`:
   - 0% landing rate (guards `anyHopCompletionRate: 0` against being swallowed by a `!== null` truthiness bug).
   - Single-carrier hops === 1 (pins the defensive `>= 3` guard).
   - Single-carrier hops === 3 boundary (pins the persistence framing at the threshold with correct pluralization).
   - `includeTitle: false` + `dataSource: "simulated"` (confirms the simulation banner becomes the first non-empty line).
   - `includeTitle: false` + orphans + geography (pins block ordering: BREADTH → DEPTH → LANDING → orphans → geography).
   - Medium-mix aliasing (`sms` + `social` merge into a single "text" percentage that sums correctly).
   - Skipped the golden/snapshot test from Claude §5.7 — deferred as higher-maintenance.
   - Risk: **None.** Pin current behavior; no source change.

## 2. What was explicitly deferred (not low-hanging, per this review)

e. **International-only geography suppression** (Claude's §6.2) — real behavior change; will make the "crossed borders" clause appear on real production campaigns where `zipCount === 0`. Deferred as its own decision.

f. **Remove dead `propagationSpeed` / `speedOriginCity` / `speedDestCity` fields** (Claude's §6.1) — deletion is safe, but the real payoff (two fewer `url_events` queries per render) requires a coordinated change in `campaignStoryInputs.ts`. Deferred as a bundled follow-up when we're ready to touch the metric layer.

g. **Rename `broadcastOpens` → `broadcastInstances` / `chainViewers` → `chainShares`** (Claude's §6.5) — wide blast radius across 4+ caller files; the rendered text is already correct. Skipped.

h. **Refresh `docs/CAMPAIGN_STORY_COMPUTATION.md`** (Claude's §6.7) — doc drift from prior decisions, not this refactor. Deferred as its own doc-only ticket.

## 3. Files touched

- `supabase/functions/_shared/render/campaignStory.ts` — JSDoc fix (line 29); pluralization guard in the single-carrier branch (line ~218).
- `supabase/functions/_shared/render/campaignStoryInputs.ts` — JSDoc block rewrite for Lane A / Lane B labeling (lines 50–63).
- `src/shared/render/campaignStory.test.ts` — 5 new test cases appended.

## 4. Verification

`bunx vitest run src/shared/render/campaignStory.test.ts` → 17/17 tests pass (12 original + 5 new). No source code paths changed behavior; the pluralization guard is unreachable under the current producer invariant and is exercised only by the new decoupled-caller tests.
