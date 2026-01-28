

## Event Manager Performance Fix

The Event Manager (`CampaignEoaManager.tsx`) has several performance issues causing slow or failed loading across all campaigns. This plan consolidates and optimizes the data fetching logic.

### Problem Summary

The Event Manager makes multiple redundant database calls and has race conditions:

1. **Token fetching is unscoped** - Fetches ALL L00 tokens globally instead of just those for the current campaign
2. **Stale state reads** - `fetchDeckSlides` reads from `eoas` state before it's been populated
3. **Duplicate slide fetching** - Slides are fetched twice (once in parallel, once after EoAs load)
4. **Redundant EoA queries** - `fetchFirstViewTimes` re-queries EoAs that were just fetched

### Solution

Refactor `fetchData` to use a **sequential, dependency-aware pattern**:

```text
┌──────────────────────────────────────────────────┐
│ 1. Parallel Initial Fetch                        │
│    - fetchCampaign()                             │
│    - fetchEoas() → returns EoAs directly         │
│    - fetchExistingTokens(campaignId) [SCOPED]    │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼ eoas available
┌──────────────────────────────────────────────────┐
│ 2. Dependent Fetches (parallel, using eoas)     │
│    - fetchDeckSlides(eoaData)                   │
│    - fetchFirstViewTimes(eoaData)               │
└──────────────────────────────────────────────────┘
```

### Implementation Details

#### 1. Scope Token Fetching to Campaign

Modify `fetchExistingTokens` to only fetch tokens for EoAs belonging to the current campaign:

```typescript
const fetchExistingTokens = async () => {
  // First get EoA IDs for this campaign
  const eoaIds = eoas.map(e => e.id);
  if (eoaIds.length === 0) {
    setL00Tokens({});
    return;
  }
  
  // Fetch only L00 tokens for these EoAs
  const { data, error } = await supabase
    .from("tokens")
    .select("eoa_id, token, full_url")
    .eq("level", 0)
    .is("parent_token", null)
    .in("eoa_id", eoaIds); // <-- NEW: Scope to campaign
  // ... rest of function
};
```

#### 2. Refactor fetchData for Proper Sequencing

```typescript
const fetchData = async () => {
  setLoading(true);
  
  // Phase 1: Fetch campaign and EoAs (these have no dependencies)
  const [campaignResult, eoasResult] = await Promise.all([
    fetchCampaign(),
    fetchEoas(), // Returns data instead of just setting state
  ]);
  
  // Phase 2: Fetch dependent data using the EoAs
  if (eoasResult && eoasResult.length > 0) {
    await Promise.all([
      fetchExistingTokens(eoasResult),  // Pass EoAs directly
      fetchDeckSlides(eoasResult),      // Pass EoAs directly  
      fetchFirstViewTimes(eoasResult),  // Pass EoAs directly
    ]);
  }
  
  setLoading(false);
};
```

#### 3. Remove Duplicate Slide Fetching

Remove the inline slide fetching from `fetchEoas` since it will be handled in the second phase.

#### 4. Eliminate Redundant EoA Query in fetchFirstViewTimes

Modify `fetchFirstViewTimes` to accept EoA data as a parameter instead of re-querying:

```typescript
const fetchFirstViewTimes = async (eoaData?: EventAction[]) => {
  const eoasToUse = eoaData || eoas;
  if (!eoasToUse.length) return;
  
  const eoaIds = eoasToUse.map(e => e.id);
  // ... rest uses eoaData directly
};
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CampaignEoaManager.tsx` | Refactor `fetchData`, `fetchExistingTokens`, `fetchDeckSlides`, `fetchFirstViewTimes`, and `fetchEoas` |

### Expected Improvements

- **Fewer database calls**: 7 queries → 5 queries per page load
- **No race conditions**: Dependent data fetched after EoAs are available
- **Scoped data**: Only fetch tokens relevant to current campaign
- **Faster perceived load**: Campaign info and EoAs appear first

### Testing

After implementation, verify:
1. Event Manager loads for campaigns with many EoAs (e.g., "No Kings")
2. First View times display correctly
3. L00 tokens and short URLs load properly
4. Deck slide previews render

