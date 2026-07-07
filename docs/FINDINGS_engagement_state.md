# Findings — Share Engagement State (Read-Only Investigation)

Date: 2026-07-07
Status: Investigation only. No code changed.

## TL;DR

Share engagement state (`none` / `intent` / `completed`) is **not stored anywhere in the database**. It is **derived at read time** in the browser (SamizdatMap) and in the SSR snapshot path, by joining `tokens` to itself via `parent_token` and then joining child tokens to `url_events` where `event_type = 'view'`.

- No boolean column on `tokens` for "intent" or "completed".
- No flag on `url_events` marking a row as a completion.
- The unit of engagement classification is the **parent token** (one L00 marker), not the child.

---

## 1. Is "share intent" stored or derived?

**Derived.** There is no `intent`/`engagement_state` column on `tokens`, `url_events`, or elsewhere (confirmed via `rg -n "engagement|intent" src/integrations/supabase/types.ts` — zero hits).

Intent is inferred from the existence of a child row in `tokens` whose `parent_token` points at the parent. In `src/components/SamizdatMap.tsx` lines 740–752:

```ts
// Get all child tokens (tokens whose parent_token is in our set)
const { data: childTokens } = await supabase
  .from("tokens")
  .select("token, parent_token, l00_instance")
  .in("parent_token", allTokenStrings)
  .is("deleted_at", null);

if (childTokens && childTokens.length > 0) {
  // Mark all parents as "intent" (they have at least one child)
  const parentTokensWithChildren = new Set(
    childTokens.map(t => t.parent_token).filter(Boolean)
  );
  parentTokensWithChildren.forEach(pt => {
    engagementStates[pt!] = "intent";
  });
```

The write that *creates* the child token row (and therefore the moment "intent" becomes visible) happens in the `mint_share` path — see `src/lib/virality/mint.ts` — fired when the user taps a Share button. There is no additional intent flag written at that time; the row's existence is the signal.

## 2. Is "share completion" stored or derived?

**Derived.** Same file, lines 754–768:

```ts
// Check which child tokens have view events (completion)
const childTokenStrings = childTokens.map(t => t.token);
const { data: childViewEvents } = await supabase
  .from("url_events")
  .select("token")
  .in("token", childTokenStrings)
  .eq("event_type", "view");

const childrenWithViews = new Set(childViewEvents?.map(e => e.token) || []);

// For each child with a view, mark its parent as "completed"
childTokens.forEach(child => {
  if (childrenWithViews.has(child.token) && child.parent_token) {
    engagementStates[child.parent_token] = "completed";
  }
  ...
});
```

Completion is determined solely by the presence of a `url_events` row with `event_type = 'view'` whose `token` matches the child token. No column on `url_events` is ever set to mark that event as "a completion of parent X".

The SSR path uses the same derivation — see `supabase/functions/_shared/render/campaignStoryInputs.ts` (the `sproutsRes` + subsequent `url_events` view lookup block that computes `intentCount = parentTokens.size - parentsWithViewedChild.size`).

## 3. What does the map check to color a marker amber vs cyan?

The classification is applied per parent token when building the point list. From `SamizdatMap.tsx` line 913 and lines 749–767 above:

```ts
const tokenEngagement: EngagementState = event.token in engagementStates
  ? engagementStates[event.token]
  : "none";
```

Rules encoded in the `engagementStates` build:

- Default: `none` (white border) — token appears in the map because someone opened it, but no child token exists.
- `intent` (amber, `#f59e0b`) — set the moment any row in `tokens` exists with `parent_token = <this token>` and `deleted_at IS NULL`.
- `completed` (cyan, `#06b6d4`) — overrides `intent` when at least one such child token has a matching `url_events` row with `event_type = 'view'`.

Border color mapping (lines 67–71):

```ts
const ENGAGEMENT_BORDER_COLORS: Record<EngagementState, string> = {
  none: "#ffffff",
  intent: "#f59e0b",
  completed: "#06b6d4",
};
```

`completed` is written last in the loop, so a parent with several children — some viewed, some not — ends up `completed`. `intent` never "downgrades" a `completed` classification and vice-versa within a single fetch.

## 4. One parent, several children — one intent or several?

**One.** The unit is the **parent token**. `engagementStates` is keyed by parent token (`engagementStates[pt!] = "intent"`), and the parent is either amber or cyan regardless of how many child tokens it has. The `spawnCount` shown in the tooltip is a separate count and does not multiply the intent classification.

Consequence for any export: "share intents" counted this way = distinct parent tokens with ≥1 child, not the number of child tokens minted. This matches the sprout definition in `supabase/functions/_shared/render/campaignStoryInputs.ts` ("A 'sprout' is a distinct L00 parent token that has produced at least one L01+ child. NOT the total number of L01+ tokens").

## 5. Is completion ever denormalized onto an event row?

**No.** Nothing writes a "this view completed parent X" marker onto a `url_events` row. `url_events` has no `is_completion`, `completes_parent`, or similar column (grep of `types.ts` returns nothing). Completion is always computed at read time by joining the child token back to its parent via `tokens.parent_token`.

Practical implication for the planned export: every "completion" number has to be produced by the same two-step join (child tokens for a campaign → url_events view rows on those child tokens → group by `parent_token`). There is no shortcut column to select.

---

## Files inspected

- `src/components/SamizdatMap.tsx` (lines 60–78, 199–215, 720–774, 908–940, 1180–1280)
- `src/integrations/supabase/types.ts` (grep for `engagement`, `intent` — no matches)
- `supabase/functions/_shared/render/campaignStoryInputs.ts` (sprout + intentCount block)
- `docs/PRD_Share_Flow_Visualization.md` (design spec that the code implements)
