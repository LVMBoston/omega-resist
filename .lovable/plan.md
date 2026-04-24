## 1. Goal

a. When a simulation runs, anchor that selected EoA’s timeline at **10 days before the current time**.

b. Make each simulated spawn occur **12 hours after the prior generation step**, so map animation/timeline playback has a realistic spread instead of every event happening at `now()`.

c. No questions from me: this is clear enough to implement.

## 2. Implementation plan

a. Update `src/lib/virality/simulator.ts` so `logEventWithLocation` can accept an optional simulated timestamp.

b. Add a new backend migration that updates the canonical `log_event` RPC with an optional `_occurred_at` parameter that defaults to `now()`. Existing real scanner paths will keep working unchanged because they will not pass the new parameter.

c. In `src/components/SimulatorControls.tsx`, compute a simulation base time per selected EoA:
   - `baseTime = now - 10 days`.
   - L00 scan/view events occur at the base time.
   - L01 events occur at base time + 12 hours.
   - L02 events occur at base time + 24 hours.
   - L03 events occur at base time + 36 hours.

 d. If multiple events are generated within the same level, add a small deterministic offset so they do not all stack at the exact same millisecond while still preserving the 12-hour generation cadence.

 e. Update the older standalone `src/pages/Simulator.tsx` path with the same timing behavior so it does not drift from the Campaign Dashboard simulator.

f. Update the simulator UI note to explain the timeline behavior: simulation starts 10 days ago and each share generation advances by 12 hours.

## 3. EoA start time handling

a. On each simulation run, update the selected `events_actions.start_date` to **10 days before the present**.

b. This update will apply only to the selected EoAs being simulated.

c. I will not modify `end_date` unless you later ask for that; the requested behavior only mentions start time.

## 4. Checklist and decision log

a. Add a new checklist item in `.lovable/plan.md`, for example: `SIM-4 — Realistic simulator timing for animation playback`.

b. Mark it implemented after the code/database changes are complete.

c. Append an `Update — 2026-04-24` section to the existing simulator decision document: `docs/decisions/simulator/2026-04-24_simulator-foreign-key-fix_feature-doc_lovable.md`.

 d. This approved plan updates the existing simulator decision log, not a new standalone plan.

## 5. Verification after implementation

a. Run a small BUGTEST simulation.

b. Query the generated simulated events and confirm their `occurred_at` values start about 10 days ago and progress in 12-hour generation steps.

c. Confirm selected EoA `start_date` was updated to about 10 days ago.

d. Confirm the simulator still uses only real marker channels: QR circles, SMS triangles, and Email squares.

e. Confirm no foreign key constraint violation returns.

## 6. Implementation status

a. Status: Approved & Implemented.

b. `SIM-4 — Realistic simulator timing for animation playback` is closed in code and backend function behavior.

c. Selected EoAs are updated to start 10 days before the simulation run.

d. Simulated event timestamps now begin at the EoA start time and advance by 12 hours per spawn generation, with small deterministic spacing between events in the same generation.

e. This updates the existing simulator fix plan rather than creating a new plan.