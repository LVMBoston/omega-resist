## 1. What the error means

a. The simulator successfully creates or finds the L00 token, but then tries to write simulated scan/view rows directly into `url_events`.

b. The database rejects that event write with “Foreign key constraint violation” because the event row references a token value that the database does not currently accept as present/valid at insert time.

c. In plain terms: the simulator is trying to record an event for a token before using the same safe server-side event path used by real deck interactions.

## 2. Root cause

a. `src/components/SimulatorControls.tsx` calls `mintL00(...)`, then calls `logEventWithLocation(...)`.

b. `src/lib/virality/simulator.ts` implements `logEventWithLocation(...)` as a direct `.from("url_events").insert(...)`.

c. That direct insert bypasses the existing `log_event` database function, which already validates token existence, applies rate limiting, and is the canonical event-writing path.

d. The direct insert is fragile in the current schema/RLS/trigger state and is what is producing the foreign key failure in your screen.

## 3. Minimal fix to unblock Bugtest simulation UI

a. Change `logEventWithLocation(...)` so it calls `supabase.rpc("log_event", ...)` instead of inserting directly into `url_events`.

b. Pass the same simulated location data into the RPC: latitude, longitude, city, region, country, country_code, zip_code, location_source, user_agent.

c. After the RPC creates the row, mark that newly created event as simulated if needed, or adjust the logging path so simulated events remain isolated as `is_simulated = true`.

d. Keep the simulator’s existing “clear simulated data only” behavior in `SimulatorControls.tsx`; do not touch real events.

## 4. Verification after implementation

a. Use the browser preview on the current Bugtest campaign route.

b. Run a tiny simulation: one ready EoA, `L00 Scan/View Events = 1`, and share factors set to `0`.

c. Confirm no “Foreign key constraint violation” toast appears.

d. Confirm the Events Listing or map shows the simulated rows when the data source filter is set to `Simulated` or `Both`.

e. Confirm the database has new `url_events` rows for the simulated token with `is_simulated = true`.

## 5. Checklist updates

a. Record this as a new “To be Fixed” item in `.lovable/plan.md`: `SIM-2 — Simulator direct url_events insert causes foreign key violation`.

b. Mark `SIM-2` as fixed only after the browser test and database check pass.

c. Leave the known jitter-related items as “To be Fixed” or open, not blockers for the Bugtest UI simulation smoke test: `P0.x`, `P1.0a`, `P1.0b`, `P1.0c`, `OQ-1`, `OQ-2`, `OQ-3`, `OQ-12`, and `OQ-13`.

## 6. Decision record

a. After implementation, archive the approved plan as a new decision document: `docs/decisions/simulator/<YYYY-MM-DD>_simulator-foreign-key-fix_feature-doc_lovable.md`.

b. The decision document will include `Status: Approved & Implemented`, the implementation date, the cause, the fix, and verification notes.