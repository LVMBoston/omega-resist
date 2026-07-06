# Campaign Story — Technical Description

Status: Reference doc
Date: 2026-07-06

The "Campaign Story" is the narrative shown on the Campaign Story report
page and inside the Data Template hotspot on deck slides. It is rendered
in two runtimes (React editor + Supabase edge SSR) from the **same** pure
functions to guarantee identical numbers and wording.

---

## 1. Architecture — one source of truth, two runtimes

Both runtimes share the same computation and formatting modules living
under `supabase/functions/_shared/render/`. The client re-exports them
via `src/shared/render/` so Vite can resolve `@/shared/render/...`.

1. **Editor (browser, Vite/React)**
   `src/lib/campaignNarrative.ts` → `computeCampaignStoryInputs` →
   `formatCampaignStory`.
2. **SSR snapshot (Deno edge function)**
   `supabase/functions/render-stats-snapshot/index.ts` calls the same two
   functions directly.

Drift between the two used to happen (e.g. the "16 vs 31 sprouts"
mismatch). It is prevented structurally by keeping the two files
side-by-side under `_shared/render/` and by Vitest coverage in
`campaignStory.test.ts` and `campaignStoryInputs.test.ts`.

---

## 2. Data source — `dataSource: "real" | "simulated"`

Every query is filtered by `is_simulated = <bool>` corresponding to the
selector on the report page. Real and simulated data never mix.

The story is anchored in time by the campaign's
`official_start_at` if set, else `created_at`. That anchor becomes the
`since` cutoff applied to every token / event query via
`.gte("minted_at", since)` or `.gte("occurred_at", since)`.

---

## 3. `computeCampaignStoryInputs` — the metric layer

File: `supabase/functions/_shared/render/campaignStoryInputs.ts`

Runs 9 queries in parallel (`Promise.all`), then reduces the rows in
memory:

a. **Level counts** — `tokens.level` bucketed 0..3 (L3+ collapsed into
   L3, matching the stored clamp). `seedCount = level 0`.
b. **Sprouts** — DISTINCT `parent_token` values across all L01+ tokens.
   A sprout is a **parent seed that produced any child**, not the total
   number of children. This is the historically-drifted definition and
   is asserted by `campaignStoryInputs.test.ts`.
c. **Zip count** — DISTINCT `url_events.zip_code` joined to tokens in
   this campaign.
d. **US states** — DISTINCT `url_events.region` where `country = "United States"`.
e. **International countries** — DISTINCT `url_events.country` where
   country is set and ≠ United States.
f. **View count** — `head: true` count of `url_events` where
   `event_type = "view"`.
g. **Propagation speed** — first (`minted_at ASC`) token per level,
   joined via `events_actions.campaign_id` so only tokens actually
   attached to this campaign's action count.
h. **Share mediums** — group view events by parent token's `utm_medium`,
   descending by count.
i. **Last share** — most recent `minted_at` where `level > 0`.

After the parallel batch, one optional follow-up query pair looks up
the **origin city** (first `url_events.city` of the earliest L1 token)
and the **destination city** (first city of the earliest max-level
token that shares the same `l00_instance` as the origin). This is
best-effort — failures are swallowed and the speed narrative simply
omits the city clause.

The result is a `CampaignStoryInputResult` object — plain data, no
Supabase types, no DOM, no Deno APIs. That purity is what lets the
same file run in the browser and in Deno.

---

## 4. `formatCampaignStory` — the narrative layer

File: `supabase/functions/_shared/render/campaignStory.ts`

Pure string builder. Inputs in, one multi-line string out. It composes
the story block by block; each block is skipped entirely when its data
is empty (per the project-wide "no fabricated metrics" rule).

Blocks, in order:

1. **Title marker** — `__TITLE__Campaign: <title>__TITLE__`, followed
   by a blank line. The two-column split renderer uses these markers to
   pin the title to the left column. Suppressed when `includeTitle:
   false` (used when the slide has a separate header hotspot).
2. **Simulation banner** — one line if `dataSource === "simulated"`.
3. **Header** — date of report, campaign start date, active duration
   in `X days Y hours`, and last share timestamp if any.
4. **Seed / sprout sentence** — `While N seeds were planted, M became
   sprouts, beginning a viral chain.` Adds sprout-rate clause only when
   both counts > 0. `📱 Opens by medium: 62% text, 38% email.` appears
   only when there is at least one view. Aliases like `sms`/`social`
   collapse to the same display label ("text") before percentages are
   computed.
5. **Chain depth** — `🔗 Longest chain: N levels deep.` with a depth-
   specific tail sentence (1 → seeds turned into shares; 2 → one hop;
   ≥3 → chained further).
6. **Speed** — `⚡ Fastest share: From the first open shared to the
   first Level N share took <time>.` Time buckets: `under an hour`,
   `just X hours`, or `X day(s)`. If both origin and destination cities
   are known, appends `; <origin> to <dest>.`.
7. **Views** — `👀 The content was viewed X times — including return
   visits from people who held onto the message.`
8. **Geography** — `📍 The content reached X different zip codes across
   Y states.` Adds an "It even crossed borders, reaching …" clause
   for international countries.
9. **Closing** — one of four rotating "no ad budget" closings, selected
   deterministically by `(seedCount + sproutCount) % 4` so re-renders of
   the same campaign at the same instant produce identical output.

The **headline tier** (`generateHeadlineOnly` in
`src/lib/campaignNarrative.ts`) is a separate compact formatter used at
the top of the report page — same inputs, shorter output tuned for one
iPhone screen at 30pt.

---

## 5. Where each field comes from — quick reference

| Story field              | Source                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `campaignTitle`          | `campaigns.title`                                             |
| `campaignActiveAnchor`   | `campaigns.official_start_at` ?? `campaigns.created_at`       |
| `seedCount`              | `tokens.level = 0`                                            |
| `sproutCount`            | DISTINCT `parent_token` over `tokens.level > 0`               |
| `levelCounts` / `maxDepth` | Histogram of `tokens.level`, clamped at 3                   |
| `viewCount`              | `url_events` count where `event_type = 'view'`                |
| `zipCount`               | DISTINCT `url_events.zip_code`                                |
| `usStates`               | DISTINCT `url_events.region` (`country = United States`)      |
| `internationalCountries` | DISTINCT `url_events.country` (≠ United States)               |
| `propagationSpeed`       | First `tokens.minted_at` per `level`, scoped by `events_actions.campaign_id` |
| `shareMediums`           | View events grouped by parent token's `utm_medium`            |
| `lastShareAt`            | Most recent `tokens.minted_at` where `level > 0`              |
| `speedOriginCity` / `speedDestCity` | `url_events.city/region` for the earliest L1 and matching max-level tokens |

---

## 6. Invariants and guardrails

a. **No fabricated metrics.** Empty categories are dropped from the
   output, never rendered as `0%` or placeholders.
b. **Editor ↔ SSR parity.** Both callers import the same two functions.
   Any fix belongs in `_shared/render/`, not in a caller.
c. **Sprouts are parents, not children.** Enforced by Vitest.
d. **Real vs simulated never mix.** Every query is scoped by
   `is_simulated`.
e. **Time anchoring is consistent.** All queries share the same
   `since` cutoff derived from `official_start_at` (or `created_at`).
f. **Determinism.** The rotating closing line is selected by a
   modulo on `seedCount + sproutCount` so the story text is stable
   between renders of the same underlying data.
