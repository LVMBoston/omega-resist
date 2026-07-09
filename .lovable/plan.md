# Lane A = instances (81), Lane B = shares (26) + viewers (22) — revised

Status: Proposed (revision 2)
Related: `docs/decisions/campaign-xlsx-export/2026-07-09_current-export-spec_feature-doc_lovable.md`

Revision applies user feedback: **§3b bug fixed** (don't hide the 26-vs-22 gap by relabeling shares as viewers), and **§6 dropped** (wiring Lane-A view-events through the metric layer is not a one-line change, so we ship without it rather than half-do it).

## 1. What does NOT change

- 1a. `computeCampaignStoryInputs.broadcastOpens` still returns tokens at `true_depth = 0` (81). No math change.
- 1b. `computeCampaignStoryInputs.chainViewers` still returns tokens at `true_depth ≥ 1` (26). No math change — but it is **renamed for honesty** everywhere it surfaces (see §2 and §3). The internal identifier can stay `chainViewers` for now to keep the diff small; wrappers relabel it at every user-facing boundary.
- 1c. Lane classification (`classifyLane`) untouched.

## 2. Wording audit — Lane A ("instances," not "opens") + Lane B ("shares," not "viewers")

### 2A. Lane A (81) — the earlier audit, unchanged

- 2a. `supabase/functions/_shared/render/campaignStory.ts:192` — story sentence:
  → `📢 The seed reached ${broadcastOpens} distinct instance${...} at the source (Lane A: base QR/link scans and per-scan L00 instances — a conservative reach count that does not double-count repeat opens by the same device).`
- 2b. `campaignStory.ts:190` comment: "broadcast opens" → "distinct broadcast instances".
- 2c. `campaignStory.ts:7` header: "Lane A broadcast opens, total view events including repeats" → "Lane A distinct broadcast instances, total view events including repeats".
- 2d. `src/lib/exportCampaignXlsx.ts:201` summary label: `"Broadcast instances (Lane A) — distinct L00 instances, not opens and not people"`.
- 2e. `exportCampaignXlsx.ts:315` cross-check row label: `"Broadcast instances (Lane A tokens)"` — see §3.
- 2f. `exportCampaignXlsx.ts:95` Events dictionary `lane` description gets a sentence: "Lane A recomputes as **distinct tokens** with `true_depth = 0`; Lane A view-event count is a separate diagnostic, not the headline."
- 2g. Internal rename `broadcastOpensFromEvents` → `broadcastViewEventsFromEvents` (identifier only).
- 2h. `src/lib/campaignNarrative.ts:134` → `"${broadcastOpens} broadcast instances"`.

### 2B. Lane B (26 vs 22) — NEW: fix the same bug on the other side

The current story says "26 downstream shares" — that word is already honest (shares, not viewers), so the story sentence needs **no change**. The bug is only in the export and the field name. Every user-facing occurrence of "chain viewers" that is computed as chain **tokens** (i.e. minted shares) must be relabeled to "chain shares." A separate "chain viewers" number, if surfaced, is a different quantity (22) and must be computed from view events.

- 2i. `exportCampaignXlsx.ts` Reference tab summary row currently labeled `"Chain viewers"` (or similar) → **rename to `"Chain shares (Lane B) — minted L01+ tokens, whether opened by recipient or not"`** with value `chainViewers` (26).
- 2j. `exportCampaignXlsx.ts:95` Events dictionary — add: "Lane B **shares** recomputes as distinct tokens with `true_depth ≥ 1`; Lane B **viewers** is a smaller number — distinct chain tokens with at least one view event — surfaced separately in the completion-gap block."
- 2k. `supabase/functions/_shared/render/campaignStory.ts` — code comments referring to `chainViewers` say "chain shares (Lane B tokens)"; the user-facing story sentence at `:207–222` already reads "downstream shares" and stays as-is.
- 2l. `src/lib/campaignNarrative.ts` — any label like "chain viewers" pointing at `chainViewers` → "chain shares".

Occurrences that stay **as-is** (they really are about recipient-side opens):
`longestChainTerminalUnopened`, `anyHopCompletion*` sentence, intent-count sentence, `totalOpens` (internal).

## 3. Cross-check — compare like units per lane, on BOTH lanes

Replace the current two rows with three rows, each a same-unit comparison:

- 3a. **`Broadcast instances (Lane A tokens)`** — metric `broadcastOpens` **(81)** vs distinct tokens in Tokens tab where `true_depth = 0 AND is_orphan = false` **(81)** → **OK**.
- 3b. **`Chain shares (Lane B tokens)`** — metric `chainViewers` **(26)** vs distinct tokens in Tokens tab where `true_depth ≥ 1 AND is_orphan = false` **(26)** → **OK**. Note: this row is labeled "shares," not "viewers" — the number and the label finally match.
- 3c. **`Orphans`** — metric `orphanCount` vs distinct tokens where `is_orphan = true` → **OK**.

Rendered preview of the cross-check block on the Reference tab (columns: label / metric-layer / recomputed / status):

```
Broadcast instances (Lane A tokens)   81   81   OK
Chain shares       (Lane B tokens)    26   26   OK
Orphans                                N    N   OK
```

MISMATCH cannot appear in this block under normal operation. If it ever does, it is a real bug (orphan filter drift, classifier drift, pagination gap) — the meaning §5 preserves.

## 4. Completion-gap block — informational, NOT a cross-check

New Reference block, titled **"Chain completion gap (informational, not a cross-check)"**, immediately below the cross-check but visually separated:

- 4a. `Chain shares minted (Lane B tokens):` 26
- 4b. `Chain shares opened by recipient (chain tokens with ≥1 view event):` 22
- 4c. `Shares minted but not yet opened:` 4
- 4d. Note column: "This gap is expected — same signal the story's any-hop completion rate surfaces. Not a data anomaly. Row (b) is what a strict 'chain viewers' number would be."

Row (b) is the honest home for the number 22 if anyone wants a "viewers" count. It lives here, not in the cross-check, and not under the label "chain viewers = 26."

## 5. Reserve MISMATCH for real disagreements

Unchanged from prior revision: MISMATCH means a metric disagrees with itself when recomputed from raw of the same unit. Any future addition to the cross-check must obey same-unit-on-both-sides, or belongs in an informational block.

## 6. Dropped — the "81 instances opened 90 times" sentence

Deferring. Wiring a Lane-A view-event count into `computeCampaignStoryInputs` is **not** a one-line change — the metric layer currently has a bulk `viewCount` but no lane join for view events. Adding it means either an extra Supabase query joining `url_events` to the lineage token list, or restructuring the existing view-count query to carry token→lane. Either is medium-sized and would need its own tests. Per user rule: don't ship half a version. Drop §6; the export's existing `broadcastViewEventsFromEvents` diagnostic stays as an internal-only field, not surfaced in the story.

If we later decide the "9 repeat opens" fact is worth surfacing, it becomes its own tiny follow-up plan that lands the number in **both** the story sentence and a new Reference-tab row in the same PR.

## 7. Files touched

- `supabase/functions/_shared/render/campaignStory.ts` — wording only (§2A a–c, §2B k comments).
- `src/lib/exportCampaignXlsx.ts` — labels (§2A d–g, §2B i–j), cross-check rewrite (§3), completion-gap block (§4).
- `src/lib/campaignNarrative.ts` — wording (§2A h, §2B l).

No change to `computeCampaignStoryInputs`. No change to `render-stats-snapshot`.

Tests updated: `src/shared/render/campaignStory.test.ts`, `src/shared/render/campaignStoryInputs.test.ts` — adjust string assertions that pinned old phrasing.

## 8. Verification

- 8a. Update string assertions; `bunx vitest run`.
- 8b. Re-export `nk3-invitation` `.xlsx`; open Reference tab; confirm:
  - Cross-check block shows three OK rows (§3), zero MISMATCH.
  - Completion-gap block shows 26 / 22 / 4 (§4).
  - Word "viewers" no longer sits above the number 26 anywhere.
- 8c. Browser-verify the Campaign Story slide: sentence reads "reached 81 distinct instances," and Lane B sentence remains "26 downstream shares."
- 8d. Screenshots (xlsx cells + slide) attached in the implementation reply.

## 9. Decision-log follow-up

On implementation, append `## Update — 2026-07-09` to `docs/decisions/campaign-xlsx-export/2026-07-09_current-export-spec_feature-doc_lovable.md`: Lane A relabeled to instances, **Lane B relabeled to shares**, cross-check now unit-matched on both lanes, completion gap surfaced separately, §6 deferred. Rename filename date to today.
