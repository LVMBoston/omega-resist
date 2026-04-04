

# Deduplicate Map Markers + Enrich Event Story with Return Visit Stats

## Narrative Context

For Action-type EoAs, multiple views from the same token are "return visits" — the person held onto the message. On the map these create noise (overlapping markers at the same jittered location). After deduplication, clicking the single remaining marker should tell the user how many times this person came back and over what time span.

## What Changes

### 1. Map deduplication in `src/components/SamizdatMap.tsx`

1a. Add `type` to the EoA select (line 570):
```typescript
.select("id, title, utm_id, mobilize_code, type")
```

1b. Store EoA type in a lookup (after line 586):
```typescript
const eoaTypes: Record<string, string> = {};
eoas.forEach((eoa) => {
  // ...existing assignments...
  eoaTypes[eoa.id] = eoa.type || "Event";
});
```

1c. After combining events (line 665) and sorting them (line 756-758), deduplicate before building points. Sort ascending first, then keep only the earliest event per token for Action-type EoAs:
```typescript
const deduplicatedEvents = sortedEvents.filter((event) => {
  const td = tokenData[event.token];
  if (!td) return true;
  const eoaType = eoaTypes[td.eoaId];
  if (eoaType !== "Action") return true;
  if (!firstViewByToken[event.token]) {
    firstViewByToken[event.token] = true;
    return true;
  }
  return false;
});
```
Use `deduplicatedEvents` instead of `events`/`sortedEvents` for all downstream processing (zip lookup, engagement states, point building).

### 2. Return visit stats in `src/components/EventStoryPanel.tsx`

2a. After fetching the event and token, if the token belongs to an Action-type EoA and is L00, fetch **all** view events for that token to compute return visit count and time span:
```typescript
const { data: allViews } = await supabase
  .from("url_events")
  .select("id, occurred_at")
  .eq("token", token.token)
  .eq("event_type", "view")
  .eq("is_simulated", false)
  .order("occurred_at", { ascending: true });
```
Store `returnVisitCount` (total views - 1) and `returnVisitSpan` (time between first and last view).

2b. In `generateNarrative()`, for the `isInstanceL00` block (line 423-456), when `isFirstEventForToken` is true and the EoA type is "Action", append return visit info to the narrative:
- If `returnVisitCount > 0`: "The recipient opened this message {N+1} times over {span}, indicating they held onto it."
- If `returnVisitCount === 0`: no addition (single view, no return visits).

### 3. State additions in `EventStoryPanel.tsx`

3a. Add state variables:
```typescript
const [returnVisitCount, setReturnVisitCount] = useState<number>(0);
const [returnVisitSpan, setReturnVisitSpan] = useState<string | null>(null);
```

3b. Use `formatTimeDelta` (already imported from `dateUtils`) to format the span between first and last view.

### 4. Decision doc

4a. Save as `docs/decisions/deck-editor/2026-04-04_action-eoa-first-view-dedup_feature-doc_lovable.md` (new file, as referenced in the return-visit-narrative-reframe doc).

## Files Changed

- `src/components/SamizdatMap.tsx` — dedup logic
- `src/components/EventStoryPanel.tsx` — return visit count/span in narrative
- `docs/decisions/deck-editor/2026-04-04_action-eoa-first-view-dedup_feature-doc_lovable.md` — new decision doc

## What Does Not Change

- `EventStoryDialog.tsx` — no changes needed (shares same pattern but is used from a different context)
- Database schema — no migrations
- Event-type EoAs — every scan still generates a unique marker

