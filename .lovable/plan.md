

# Treat Every Scan as a Unique Person for "Event" Type EoAs

## Problem
Currently, when multiple people scan the same QR poster (an "Event" type EoA), the system merges scanners from the same ZIP code into a single L00 instance. This underreports unique viewers at public events like rallies or canvassing sites.

## Solution
Use the existing `type` field on `events_actions` ("Event" vs "Action") to control instantiation behavior:
- **Event**: Every scan creates a new L00 instance (unique person assumed)
- **Action**: Current ZIP-based deduplication remains (same link shared person-to-person)

## Changes Required

### 1. Database: Update `instantiate_l00_token` function
- Look up the EoA `type` for the base token being instantiated
- Always create a new instance suffix (current behavior, no change needed here -- it already creates a new instance every time)

### 2. Database: Update `maybe_reinstantiate_l00` function
- Before checking ZIP codes, look up the EoA `type` via the token's `eoa_id`
- If `type = 'Event'`: always create a new instance token (skip ZIP comparison entirely)
- If `type = 'Action'`: keep existing ZIP-based deduplication logic

### 3. Frontend: No changes needed
- The `DeckViewer.tsx` already calls `maybeReinstantiateL00` for every scan
- The changed behavior is entirely server-side in the RPC function

## Technical Details

### Modified SQL Function: `maybe_reinstantiate_l00`

The function will be updated to add an EoA type lookup early in the logic:

```text
maybe_reinstantiate_l00(_instance_token, _current_zip_code)
  |
  v
Is L00 instance token? --No--> return unchanged
  |Yes
  v
Look up EoA type via token's eoa_id
  |
  v
Is type = 'Event'? --Yes--> Always create new instance (skip ZIP check)
  |No (Action)
  v
[Existing ZIP dedup logic unchanged]
```

The new branch fetches the `type` from `events_actions` by joining through the token's `eoa_id`, then unconditionally creates a new instance suffix when the type is "Event".

### Migration SQL Summary
- Single `CREATE OR REPLACE FUNCTION` statement for `maybe_reinstantiate_l00`
- Adds ~10 lines: a variable declaration, a query to fetch EoA type, and a conditional branch before the ZIP check
- No schema changes, no new columns, no new tables

