# Plan: L00 Seed Instance Normalization Across All Organizer Channels

## 1. Goal and corrected model

1a. Treat every organizer-created Level 0 token as a **seed token**, regardless of channel: QR, email, SMS, Facebook, LinkedIn, Bluesky, or other social distribution.

1b. A seed token has no viewer identity until a human recipient opens the deck. On first open, the app creates a unique `l00_instance` token and logs the origin `view` event against that instance.

1c. Track viral flow from the instance, not from the bare seed. All L01+ tokens inherit the original `l00_instance`, so downstream shares remain tied to the first human opener.

1d. Continue treating later `view` events for the same `l00_instance` as **return visits / retention**, not new origin markers.

1e. This plan does **not** redefine return visits. It only makes the map and guardrails consistently recognize the earliest `view` per `l00_instance` as the origin marker across all L00 channels.

## 2. Channel and visual encoding rules

2a. Keep marker **color** as viral depth:

```text
L00 = dark slate
L01 = green
L02 = purple
L03+ = red
```

2b. Keep marker **shape** as distribution/share medium. QR remains circle, email remains square, SMS/text remains triangle.

2c. Extend medium handling for organizer social channels instead of collapsing everything to QR. Existing social medium values such as `fb` and `bs`, and future values such as `li`, `x`, or `social`, will be explicitly classified rather than falling through to the QR/circle default.

2d. Update the map legend/labels so users can distinguish organizer social-origin L00 markers from QR markers where the existing shape vocabulary permits. If we need to keep only the existing three shapes, social channels will use a documented fallback shape/label rather than silently appearing as QR.

2e. Enforce the invariant that a QR-shaped marker means `utm_medium = 'qr'`; L01+ QR markers should not be produced by share minting logic.

## 3. Instantiation and event lifecycle

3a. Preserve the current deck-open lifecycle: `DeckViewer.tsx` detects a bare `l00-*` seed token, calls `instantiateL00Token(...)`, replaces the URL with the instance token, then logs the `view` event.

3b. Generalize comments and naming from QR-specific language to channel-neutral “L00 seed” language, because QR, email, SMS, and social all follow the same seed-to-instance lifecycle.

3c. Keep the current rule that an already-instanced L00 URL may be re-instantiated for a different real recipient when appropriate. This remains the system’s protection against forwarded organizer links causing multiple people to share one instance.

3d. Add crawler/bot protection to L00 instantiation/logging so social preview bots do not create human viewer instances. This is especially important for Facebook, LinkedIn, X, and messaging app previews. The guard should detect common crawler user agents before calling `instantiateL00Token(...)` or `logEvent(...)`.

## 4. Map data normalization

4a. Update `SamizdatMap.tsx` so map origin markers are deduplicated by `l00_instance` for L00 tokens across all mediums, not only by token and not only for Action-type EoAs.

4b. For each `l00_instance`, keep the earliest qualifying `view` event as the map marker. Later `view` events for that same instance are excluded from marker rendering and remain available conceptually as return visits.

4c. Preserve L01+ markers as actual downstream viral events. Their grouping remains based on their own token/event, while their lineage remains queryable via inherited `l00_instance`.

4d. Preserve existing geographic handling: ZIP-based coordinates for US events, rounded lat/lon for international events, and current simulated/real data filtering.

4e. Preserve existing engagement border logic: white for opened, amber for share intent, cyan for completed share.

## 5. Share minting guardrails

5a. Update `mintShare` validation and/or call sites so user-generated L01+ shares cannot use `utm_medium = 'qr'`.

5b. Keep QR available for organizer-minted L00 seed tokens only.

5c. Ensure share mediums use explicit allowed values. Current code allows `qr`, `em`, `sms`, `social`, and `p2p`; the implementation will separate allowed **seed mediums** from allowed **share mediums** so Level 0 campaign starts and viral shares cannot accidentally use the wrong channel semantics.

5d. Ensure L01+ tokens continue inheriting `l00_instance` from their parent.

## 6. Reporting and metrics impact

6a. Do not fabricate or backfill metrics. Existing data will be displayed only as returned by the database.

6b. Do not change how raw `url_events` are stored. Multiple `view` events for the same token/instance remain valid database facts.

6c. Update only the map-origin interpretation layer unless a database guard is necessary for share medium constraints.

6d. Keep return-visit logic separate from origin-marker rendering. A repeated open of the same instance is not a duplicate QR/email/SMS/social event; it is a return visit.

## 7. Technical implementation targets

7a. `src/pages/DeckViewer.tsx`: update L00 seed/instance comments and add crawler-safe behavior before instantiation/logging.

7b. `src/lib/virality/mint.ts`: split seed-medium and share-medium validation, prevent `qr` from being used for L01+ share minting, and update QR-specific comments to channel-neutral language.

7c. `src/components/SamizdatMap.tsx`: normalize event deduplication around earliest `view` per `l00_instance`; update medium-to-shape/label handling for social mediums; add guardrails against invalid level/medium combinations.

7d. Database migration, only if needed: add a server-side guard to prevent `mint_share` from accepting `qr` as a share medium. This is safer than relying only on client-side validation.

7e. Tests/verification: add or update unit-level checks where available for medium classification and L00 instance deduplication; run the project’s relevant tests/build checks after implementation.

## 8. Decision documentation

8a. After approval and implementation, archive this approved plan as a decision document.

8b. This will be a new plan named **L00 Seed Instance Normalization Across All Organizer Channels** unless an existing decision document for this exact topic is found during implementation.

8c. The decision document will be saved under:

```text
docs/decisions/virality/<YYYY-MM-DD>_l00-seed-instance-normalization_feature-doc_lovable.md
```

8d. The document will include `Status: Approved & Implemented`, the implementation date, and the final approved plan content.