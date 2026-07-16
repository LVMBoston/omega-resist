# Low-Hanging Fruit from Claude's Analysis

Analysis-only review of Claude's 7 refactor proposals. "Low-hanging" = small diff, no behavior change to correct output, no cross-runtime rename cascade.

## 1. What qualifies as low-hanging (recommended)

a. **Fix stale doc comment in `campaignStoryInputs.ts`** (Claude's §6.3)
   - Change: one comment block currently says "label as 'opens'… Approximate unique viewers" — the exact vocabulary we retired on 2026-07-09.
   - Diff size: ~4 lines, comment only.
   - Risk: **None.** No runtime effect. Prevents future contributor from reintroducing retired wording.

b. **Remove retired "Sprouted seeds" phrasing from `intentCount` JSDoc** (Claude's §2 residual finding, line 29 of `campaignStory.ts`)
   - Change: rewrite one JSDoc line to drop "Sprouted."
   - Diff size: 1 line.
   - Risk: **None.** Comment-only.

c. **Add pluralization guard for `singleCarrierTailHops === 1`** (Claude's §6.4)
   - Change: add `hops === 1 ? "hop" : "hops"` in the single-carrier branch. Keep the redundant `>= 3` guard (defense-in-depth against decoupled callers).
   - Diff size: ~2 lines inside one template literal.
   - Risk: **Very low.** Unreachable today given the producer's invariant; strictly a correctness improvement if that invariant is ever broken. Add one unit test pinning the boundary.

d. **Add the missed test cases** (Claude's §5.1, §5.3, §5.4, §5.5, §5.6)
   - Cases: 0% landing rate, single-carrier `hops===1`, `includeTitle:false` + simulated, `includeTitle:false` + orphans + geography, medium-mix aliasing sum.
   - Diff size: test file only.
   - Risk: **None.** Pins current behavior; no source change. Skip the golden-snapshot test (§5.7) for now — higher maintenance cost, easy to add later.

## 2. Where I disagree with Claude's "low-hanging" framing

e. **International-only geography suppression** (Claude's §6.2) — Claude ranks this "medium-low risk." I'd move it **out** of low-hanging.
   - Reason: it changes rendered output on real campaigns (per the v2.1 decision doc, real production data currently hits `zipCount === 0`). That means enabling this fix will make the "crossed borders" clause appear on campaigns where it currently doesn't — a visible narrative change users will notice on the deck slide, report page, fridge QR, and xlsx export simultaneously.
   - Recommend: keep as a separate, deliberate change with its own approval, not bundled into a hygiene pass. Add Claude's §5.2 test first (pinning current wrong behavior), then do the fix as its own decision doc.

f. **Remove dead `propagationSpeed` / `speedOriginCity` / `speedDestCity` fields** (Claude's §6.1) — Claude calls this "low risk." I agree the deletion itself is safe, but I'd **not** call it low-hanging.
   - Reason: it touches 4+ caller files (`campaignNarrative.ts`, `render-stats-snapshot/index.ts`, `exportCampaignXlsx.ts`, test fixtures) and the real payoff (dropping the two extra `url_events` queries per render) requires a coordinated change in `campaignStoryInputs.ts` that's explicitly out of scope. Doing only the type deletion is a half-move — it removes code without capturing the perf win.
   - Recommend: bundle both halves into a single follow-up plan when we're ready to touch the metric layer.

g. **Rename `broadcastOpens` → `broadcastInstances` / `chainViewers` → `chainShares`** (Claude's §6.5) — Claude correctly ranks this lowest. Agree: not low-hanging. Skip.

h. **Refresh `docs/CAMPAIGN_STORY_COMPUTATION.md`** (Claude's §6.7) — Genuinely small, but this is doc drift from prior decisions, not something surfaced by the current refactor request. Worth a separate follow-up ticket rather than bundling here.

## 3. Proposed scope for this pass

Do items **1a, 1b, 1c, 1d only.** Everything else is either a real behavior change (1e), a partial move (1f), or wider than the refactor request (1g, 1h).

## 4. Risk summary table

| Item | Diff scope | Runtime change | Cross-file blast | Risk |
| ---- | ---------- | -------------- | ---------------- | ---- |
| 1a | 1 comment block, `campaignStoryInputs.ts` | None | None | None |
| 1b | 1 line, `campaignStory.ts` | None | None | None |
| 1c | ~2 lines, `campaignStory.ts` | Only if invariant broken | None | Very low |
| 1d | `campaignStory.test.ts` only | None | None | None |

## 5. What I need from you

Confirm the scope in §3, or tell me which of 1a–1d to drop or which of 1e–1h to pull back in.
