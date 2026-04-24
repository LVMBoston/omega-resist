Status: Approved & Implemented
Date: 2026-04-24

# Simulator Foreign Key Fix

## 1. Issue

a. The simulator attempted to write location-bearing synthetic events directly into `url_events`.

b. The database rejected L00 event writes with a foreign key constraint violation because base L00 tokens are not valid event tokens under the L00 instance enforcement rule.

## 2. Decision

a. Simulated L00 events must use an instance-suffixed L00 token created through the existing server-side instantiation RPC.

b. Simulated event logging must use the canonical `log_event` RPC instead of direct `url_events` inserts.

c. Simulated instance tokens are marked `is_simulated = true` so cleanup remains scoped to simulator data.

## 3. Implementation

a. Added `instantiateSimulatedL00Token` in `src/lib/virality/simulator.ts`.

b. Updated `logEventWithLocation` in `src/lib/virality/simulator.ts` to call `log_event` with location fields and `location_source`.

c. Updated `src/components/SimulatorControls.tsx` and `src/pages/Simulator.tsx` so L00 event logging and L01 minting use the simulated L00 instance token.

## 4. Verification

a. `npm run build` completed successfully.

b. Browser smoke test on BUGTEST ran a tiny simulation with one selected EoA, L00 count 1, and L01/L02/L03 factors set to 0.

c. No browser console errors matched “foreign key” or “Error logging simulated event”.

d. The UI showed “Simulation complete”.

e. Database verification found a new simulated simulator event for campaign `qr` within the last 10 minutes.
