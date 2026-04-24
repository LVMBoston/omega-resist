## 1. Finding

a. You are right: the simulator is currently generating `utm_medium = social` for L01/L02 and `utm_medium = p2p` for L03.

b. The real UI paths that are implemented mint these share mediums:
   - `sms` for SMS/Text.
   - `em` for Email.
   - `social` for the browser-native share/copy action.

c. The map shape logic only recognizes:
   - `qr` = circle.
   - `em` = square.
   - `sms` = triangle.
   - Anything else falls back to circle.

d. Database check confirms the mismatch: real event data has `qr`, `sms`, and `em`; simulated-only data has `social` and `p2p`. That means simulated markers can show fallback circle shapes that do not match the real-data channels you are trying to test.

## 2. Proposed simulator rule

a. Keep L00 as `qr` because real campaign seeds/initial scans are QR-like origins.

b. Change simulated L01/L02/L03 share minting to use only the real map-visible methods: `sms` and `em`.

c. Do not generate `social` or `p2p` in the simulator for now, because they are not represented as distinct real-data marker shapes in the Samizdat map.

d. Use a simple deterministic spread, not random-only, so a small test is predictable:
   - L01 alternates `sms`, `em`, `sms`, `em`.
   - L02 alternates opposite of its parent where possible.
   - L03 alternates `sms`, `em` as well.

## 3. UI clarification

a. Add a small note in the Campaign Dashboard simulator controls explaining that simulated shares use only currently map-visible real channels: Text/SMS and Email.

b. Optionally show the shape legend near the simulator settings:
   - Circle = QR seed/open.
   - Triangle = SMS/Text.
   - Square = Email.

c. Leave browser-native Social Share as a known “To be Fixed / To be Decided” item, because it exists as an action but does not yet have a dedicated map shape or real-channel taxonomy.

## 4. Files to change after approval

a. `src/components/SimulatorControls.tsx`: replace simulator `social` and `p2p` share minting with `sms`/`em` selection logic and add the explanatory note.

b. `src/pages/Simulator.tsx`: apply the same medium changes to the older standalone simulator path so it does not keep generating inconsistent data if someone uses it later.

c. `.lovable/plan.md`: log a new closed/active checklist item such as `SIM-3 — Align simulator transmittal methods with real map marker channels`.

d. `docs/decisions/simulator/2026-04-24_simulator-foreign-key-fix_feature-doc_lovable.md`: append an `Update — 2026-04-24` section documenting this follow-up, or create a new simulator decision document if you prefer it separated. This plan updates the existing simulator fix plan.

## 5. Verification after implementation

a. Run a small BUGTEST simulation with L01 enabled.

b. Confirm new simulated child tokens use only `sms` and `em` mediums.

c. Confirm the map shows triangles for SMS/Text and squares for Email, with no new simulated `social` or `p2p` markers.

d. Confirm the existing simulator foreign-key fix remains intact and no “Foreign key constraint violation” appears.