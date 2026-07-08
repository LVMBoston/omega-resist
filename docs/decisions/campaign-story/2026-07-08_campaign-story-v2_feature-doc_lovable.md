# Campaign Story v2 — depth semantics, two-lane metrics, consolidated export

Status: Approved & Implemented
Date: 2026-07-08

## 1. What changed

a. **Depth-corrected `token_lineage` view.** Recursive CTE walks
`parent_token` from the roots. Per-scan L00 instance edges
(child token matches `^l00-.+:.+$`) contribute `0` to `true_depth`;
every other edge contributes `1`. Provenance is keyed on immutable
token shape written by the mint functions — never on `stored_level`
or `minted_via`, both of which can drift.

b. **Two-lane metric layer** (`computeCampaignStoryInputs`).
   - Lane A — **Broadcast opens** = tokens where `true_depth = 0`
     (base L00 templates + per-scan L00 instances). Inflated by
     design; labeled "opens", never "viewers".
   - Lane B — **Approximate unique viewers** = tokens where
     `true_depth ≥ 1`, orphans excluded.
   - Orphans (`parent_token IS NULL` AND not L00-shaped) are excluded
     from both lanes and surfaced separately as **Data anomalies**.
   - `perHopConversion` reports d→d+1 rates starting at **1→2**
     (0→1 is broadcast conversion, reported in the lanes above).
   - `anyHopCompletionRate` = chain tokens that produced any child
     divided by chain tokens (labeled as a blend).

c. **Consolidated XLSX export** (`exportCampaignXlsx`). One workbook,
three tabs — Reference (metric summary + anomalies), Events, Tokens.
Reference tab shows all metrics including zeros (evidence); the
narrative renderer continues to omit empty blocks. The dashboard
now surfaces a single "Export XLSX" button.

## 2. Coupling / naming invariant

Correctness depends on the token-shape invariant across these four
functions. If any changes the shape, update the CTE and this doc:

- `generate_token` — bare 8-hex ids.
- `mint_share` — preserves the parent's shape category.
- `instantiate_l00_token` / `maybe_reinstantiate_l00` — emit
  `<base>:<6-hex>` (this is the per-scan L00 instance shape).

## 3. Out of scope

Not touched in this change: `mint_l00`, `mint_share`,
`instantiate_l00_token`, `maybe_reinstantiate_l00`, the anon grant on
`get_campaign_map_events`, any RLS, and orphan resolution in
`fal-nkd` / `res-sis` / `res-sis-live` (flagged, not fixed).

## 4. Verification

- Migration applied; depth histogram confirmed 176 tokens moved from
  stored_level=1 to true_depth=0 (per-scan L00 instances).
- Existing sprout-count regression test still passes.
- New guardrail test `two-lane metrics` asserts: orphans excluded
  from both lanes; `perHopConversion` has no `0→1` entry and reports
  `1→2` correctly.
- Export path uses batched `range()` pagination (`fetchAll`) so
  campaigns larger than 1000 tokens/events export completely.

## Update — 2026-07-08 (evening)

Status: Approved & Implemented.

Follow-up build after the first v2 landing left `sproutCount` in place; this update completes the removal and adds two verifications the prior pass skipped.

### 1. Sprout removed end-to-end

Deleted from:
- `CampaignStoryInput` (shared formatter)
- `NarrativeData` (editor path)
- `campaignStoryInputs` result type/interface (kept the internal field on the return for map-marker parity, still populated but no consumer reads it in the story path)
- `render-stats-snapshot/index.ts` invocation
- `campaignStory.test.ts` (rewritten around three-facts test)
- `campaignStoryInputs.test.ts` sprout assertion retained (validates map-marker `sproutCount`, not story)

Closing-index rotation switched from `(seedCount + sproutCount) % 4` to `(seedCount + chainViewers) % 4` so the pool still rotates deterministically.

### 2. Three-facts story rewrite

Structure enforced by `formatCampaignStory` and asserted by `campaignStory.test.ts`:

- **📢 BREADTH** — Lane A broadcast opens + total view events (only if distinct from opens) + channel mix. Unique numbers: `broadcastOpens`, `viewCount`, medium %s.
- **🔗 DEPTH** — Lane B chain shares + `maxDepth`. Skipped entirely when `chainViewers = 0` rather than padded with "0 shares".
- **✅ LANDING** — any-hop completion `(numerator/denominator = pct%)`. Skipped when denominator is 0.

Additional lines carry independent facts and are kept:
- 🟠 intent (share links generated, no recipient open) — breadth-adjacent but distinct number
- ⚠️ orphan anomalies — only rendered when `orphanCount > 0`
- ⚡ speed — time-to-propagate
- 📍 geo — zips/states/countries

Deletion test enforced by unit test: each of breadth/depth/landing carries a number the other two don't.

### 3. Verification (raw outputs)

**Orphan predicate on real data** (differential check demanded by review):

```
utm_campaign    is_sim  orphans  lane_a_raw  lane_a_clean  lane_b
fal-nkd         f       64       66          2             9
fal-nkd         t       6        8           2             24
nk3-invitation  f       0        80          80            26
res-sis         f       15       20          5             8
res-sis-live    f       7        17          10            19
rs-good-1       f       0        196         196           78
rs-good-1       t       0        1           1             0
```

Predicate `parent_token IS NULL AND token NOT LIKE 'l00-%'` fires on production rows: 92 orphans across the flagged campaigns (fal-nkd, res-sis, res-sis-live), matching the earlier 93-orphan finding within noise. `nk3-invitation` and `rs-good-1` have zero orphans, so their story numbers are unaffected. The 93 remain flagged, not fixed.

**Pagination** — the earlier "structurally correct but untested" concern is now covered by `campaignStoryInputs.test.ts`'s new mocked-paginated stub: 2350 rows → three `range()` calls at (0,999), (1000,1999), (2000,2999) → all 2351 non-orphan rows counted. Production has no single campaign+is_simulated bucket over 1000 rows today, so real-data batching still cannot be observed to fire; the test proves the loop condition, not the DB behavior.

### 4. Rendered stories (both campaigns, real data, real numbers)

Rendered with `Date.now()` fixed to 2026-07-08 17:30 UTC for reproducibility.

**nk3-invitation ("No Kings #3")** — 80 seeds, 26 chain, depth 6:

```
Campaign: No Kings #3
Date of this report: Jul 8, 2026 17:30 UTC
Started March 25, 2026
Campaign active for 104 days 22 hours
Last share: Jun 12, 2026 7:05 PM UTC

📢 The seed was opened 80 times at the source (Lane A: base QR/link scans and per-scan instances, including repeats). All told, the content generated 110 view events across every level, including return visits.
📱 Channel mix: 80% qr, 15% text, 5% email.
🟠 7 seeds have generated a share link that no recipient has opened yet — intent recorded, delivery unconfirmed.

🔗 That broadcast produced 26 downstream shares (Lane B: mint_share descendants, orphans excluded), reaching a chain depth of 6 levels — someone opened it, shared it, and the person they shared with shared again.

✅ Of those 26 chain shares, 7 (27%) reached a recipient who opened it and passed it along again.

⚡ Fastest share: From the first open shared to the first Level 3 share took 1 day.

📍 The content reached 46 different zip codes across 15 states. It even crossed borders, reaching Bulgaria, Portugal.

No promotion. No platform boost. This spread the old-fashioned way — person to person, because it resonated.
```

**rs-good-1 ("ICE OUT FOR GOOD")** — 196 seeds, 78 chain, depth 4:

```
Campaign: ICE OUT FOR GOOD
Date of this report: Jul 8, 2026 17:30 UTC
Started January 16, 2026
Campaign active for 173 days 2 hours
Last share: Feb 20, 2026 3:32 PM UTC

📢 The seed was opened 196 times at the source (Lane A: base QR/link scans and per-scan instances, including repeats). All told, the content generated 354 view events across every level, including return visits.
📱 Channel mix: 81% qr, 16% text, 3% email.
🟠 11 seeds have generated a share link that no recipient has opened yet — intent recorded, delivery unconfirmed.

🔗 That broadcast produced 78 downstream shares (Lane B: mint_share descendants, orphans excluded), reaching a chain depth of 4 levels — someone opened it, shared it, and the person they shared with shared again.

✅ Of those 78 chain shares, 11 (14%) reached a recipient who opened it and passed it along again.

⚡ Fastest share: From the first open shared to the first Level 3 share took just 5 hours.

📍 The content reached 74 different zip codes across 17 states. It even crossed borders, reaching Australia, Ireland, Sweden, U.S. Virgin Islands, United Kingdom.

No promotion. No platform boost. This spread the old-fashioned way — person to person, because it resonated.
```

### 5. Honest flags on the rendered output

Places where the wording is doing more work than the data:

- **Speed vs depth mismatch.** Both stories say "chain depth of N levels" (from `true_depth`) but the speed line says "first Level 3 share" — that's because `propagationSpeed` still reads `tokens.level` which is clamped at 3 by `mint_share`. In nk3 the true chain reaches level 6; the story only reports the speed to level 3 because that's the last level `tokens.level` records. This is not padding — it's a real coupling: fixing it requires either walking `propagationSpeed` off `true_depth` too, or accepting that the speed narrative is capped at 3 by design. I did not change this in this pass; flagging it explicitly.
- **The "someone opened it, shared it, and the person they shared with shared again" clause in the depth paragraph implies 3 hops but is appended when `maxDepth >= 3`.** For a depth-6 chain this understates the walk. Left as-is because the alternative — parameterizing the human-language walk to the actual depth — reads as counting rather than describing.
- **rs-good-1's `📢` line reads "80% qr, 15% text, 5% email" for nk3 and "81% qr, 16% text, 3% email" for rs-good-1.** The `qr` medium here is the base scan itself; the story does not distinguish QR scans (which are broadcast opens, not shares) from downstream share mediums. This is a labeling clarity issue in the data model, not the story. Flagged for a future pass.
- **No padding introduced.** The space the sprout sentence occupied is not filled by a substitute sentence; the breadth paragraph is one honest sentence about opens plus (optional) view events, and the medium/intent lines are separate short lines that carry facts of their own. If breadth were deleted, no other paragraph carries `broadcastOpens` or `viewCount` or the channel mix — deletion test passes on both campaigns.

### 6. nk3 depth-6 chain analysis (separate deliverable)

Walked from every `true_depth = 6` leaf up to root:

```
depth  token                  parent                 medium  minted_at        location                       views
0      l00-900742-nk3         (base)                 qr      Mar 27 02:43     —                              0
0      l00-900742-nk3:72d7a6  l00-900742-nk3         qr      Mar 27 06:51     Falmouth, MA                   1
1      d764bc34               l00-900742-nk3:72d7a6  sms     Mar 27 06:53     Falmouth, MA                   2
2      5c89eb7b               d764bc34               sms     Mar 27 06:56     Falmouth, MA                   1
3      5d22be15               5c89eb7b               sms     Mar 27 06:57     Falmouth, MA                   1
4      f969ba21               5d22be15               sms     Mar 27 08:34     Falmouth + W. Yarmouth, MA     6
5      6c5db044               f969ba21               sms     Mar 27 15:55     Falmouth, MA                   1
6      4828a814               6c5db044               em      Mar 27 15:57     — (never opened)               0
```

Four proxies against this chain:

- **Branching factor: 1 at every hop.** This is a straight line, not a cascade. The v2 story reports "26 downstream shares" for the whole campaign; this specific chain accounts for 6 of them. Every other one of the 20 chains contributes shorter walks.
- **Geography: static.** Six of seven downstream hops are Falmouth, MA. The one deviation (West Yarmouth on depth 4) is a second location observed for that token, not a hand-off. This is not a viral geographic spread; it is a single carrier passing the message forward six times in one town.
- **Timing: bimodal.** Depths 1–3 happen within 6 minutes of the first scan (06:51 → 06:57). Then depths 4, 5, 6 space out across the same day (08:34, 15:55, 15:57). The first burst reads like the recipient of the QR scan immediately texting three people in sequence; the second half reads like the chain being picked up hours later.
- **Medium: sms all the way down until the terminal hop, which is email — and the email leaf has 0 views.** The chain that produced the campaign's max-depth number ends at a share that was never opened. Depth 6 is a fact; landing at depth 6 is not.

**What this means for how to describe nk3 in evidence.** "6 levels deep" is true and reproducible from `token_lineage`. But it describes one motivated Falmouth carrier and a terminal share that didn't land, not a wide viral cascade. If the goal is "one message walked six links," the chain supports the claim; the depth-4 hop (`f969ba21`, 6 views, two locations) is the actual landing high-water mark and would be the more defensible cite. I would not walk into evidence leading with "6 levels deep" without either the caveat that depth 6 didn't open, or a switch to depth 4 as the last-observed-view depth.

