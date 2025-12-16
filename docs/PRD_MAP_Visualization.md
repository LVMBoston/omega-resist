## Project Context: Digital Samizdat and Visible Solidarity

This project exists to **visualize the viral spread of a modern form of Samizdat** in order to build morale, confidence, and shared purpose among small activist groups. Historically, *Samizdat* referred to the self-publishing networks used in the Soviet bloc, where ordinary people copied banned texts by hand or typewriter and passed them quietly from person to person. The power of Samizdat did not come from scale or polish. It came from proof. Each copy was evidence that others cared, others acted, and others were willing to carry the message forward despite risk or isolation.

This campaign adapts that logic to the present. QR codes on business cards, along with SMS and email links, allow messages to move through informal, trust-based networks. Mode 1 (Spark) exists to make those early signals **visible without personal attribution**. The maps and metrics are not designed to optimize behavior or compare people. They exist to answer a simple, motivating question for participants: *Did our quiet, collective actions register in the world?* Showing that they did is itself an act of organization.

# DECISION RECORD

## Mode 1 – Spark (Round 1)

**Date:** 2025-12-15  
**Campaign:** Samizdat Business Card Distribution (Round 1)  
**Scope:** Mode 1 analytics, mapping, and UI behavior

***

## 1. Context

This campaign simulates Samizdat-style distribution.  
Team members place business cards with QR codes in public spaces and send links via SMS or Email to known contacts.

Key constraints shaping this design:

-   Volunteer trust and morale are paramount
-   No competitive dynamics among volunteers
-   Minimal administrative burden
-   Anonymous discovery via QR is a core feature
-   The goal of Mode 1 is *early signal detection*, not performance evaluation

Round 1 is intentionally limited in scope to validate the basic mechanics of Spark.

***

## 2. Purpose of Mode 1 (Spark)

Mode 1 exists to answer:

-   Did anything light up after go-live?
-   When did the first sparks appear?
-   Through which channels?
-   In which general areas?

Mode 1 does **not** attempt to explain *why* something worked or *who* caused it.  
It is descriptive, not evaluative.

Mode 1 is successful if it provides visible evidence of early engagement that reinforces volunteer morale without introducing attribution, competition, or pressure to optimize.

The primary audience for Mode 1 is organizers and participants, not external analysts or funders.

***

## 3. Temporal Anchor

-   All Mode 1 views are anchored to the **Event or Action (EoA) start date/time**
-   “Go live” is defined as the EoA start
-   All filters and metrics are expressed as *time since go-live*

***

## 4. Tracking Dimensions (Round 1)

The following dimensions are explicitly in scope:

-   **Channel**
    -   QR
    -   SMS
    -   Email
-   **Time since go-live**
-   **Geography**
    -   ZIP-level
    -   Represented as ZIP centroids only
-   **Activation**
    -   Defined as the first successful deck open associated with an L00 token.
-   **Early velocity**
    -   Opens per short time window
-   **Token depth**
    -   Presence or absence of L01+ sharing (if it occurs)

***

## 5. Explicit Non-Goals (Round 1)

The following are intentionally **out of scope**:

-   No distributor attribution
-   No volunteer-level tracking
-   No placement category tracking
-   No per-message or handwritten-text tracking
-   No ranking, scoring, or comparison of people, places, or channels
-   No inference about “unopened” or unseen materials
-   No exposure or effectiveness measurement
-   No ZIP polygon or boundary inference
-   No fine-grained or address-level location data

Absence of these features is a **design choice**, not a limitation.

***

## 6. Mapping Decisions (Round 1)

Given available data and constraints:

-   Mapping uses **ZIP centroids as points. Each point represents aggregated activity within a ZIP code, not a specific person or location.**
-   Leaflet is the rendering engine
-   Core map features:
    -   Point markers per ZIP with activity
    -   Marker clustering for readability
    -   Channel-based layer toggles
    -   Time-since-go-live filtering
-   Optional but acceptable:
    -   Heat overlay based on centroids
-   Explicitly excluded:
    -   Choropleth maps
    -   ZIP polygon fills
    -   Any visual ranking or “top ZIP” views

Maps are intended to show *emergence and clustering*, not precision or attribution.

***

## 7. UI and Cultural Guardrails

Mode 1 UI must adhere to the following principles:

-   Aggregation over individuation
-   Filters over leaderboards
-   Exploration over judgment
-   Calm, non-alarmist visual language

The UI should not encourage competition, comparison, or optimization narratives in Round 1.

***

## 8. Revisit Triggers

These decisions may be revisited in future rounds if and only if:

-   Placement category metadata is added (Round 2)
-   ZIP polygon or ZCTA geometry is introduced
-   Campaign goals move from Spark (Mode 1) to Spread or Cascade analysis (Mode 2+)
-   Organizers explicitly approve additional measurement burden

Until then, this document is the authoritative reference for Mode 1 behavior.

***

## 9. Status

**Approved for Round 1 execution.**  
All Mode 1 UI and analytics work must conform to this document unless amended.

# CONSTRAINTS SUMMARY

## Mode 1 – Spark (Round 1)

### Read First (Implementation Process)

You are implementing Mode 1 (Spark) for an active campaign.

Implementation will proceed via a **series of small, sequential prompts**. Each prompt is intended to:

-   introduce one visible UI change at a time
-   avoid speculative features
-   allow review before moving to the next step

Do not jump ahead. Do not add features not explicitly requested. If a request conflicts with the constraints below, pause and ask.

This document is binding unless explicitly amended.

***

## Purpose

Mode 1 exists to detect **early ignition signals** after go-live. It is descriptive, not evaluative.

Mode 1 answers:

-   Did anything light up?
-   When did it light up?
-   Through which channels?
-   In which general areas?

Mode 1 does NOT measure performance, effectiveness, or people.

***

## Temporal Anchor

-   All Mode 1 views are anchored to **Event or Action (EoA) start date/time**
-   All metrics are expressed as **time since go-live**

***

## Allowed Dimensions (Round 1)

-   Channel
    -   QR
    -   SMS
    -   Email
-   Time since go-live
-   Geography
    -   ZIP level only
    -   Represented as centroids (lat/lon points)
-   Activation
    -   At least one deck open
-   Early velocity
-   Token depth (L00 → L01 only if present)

***

## Explicitly Forbidden (Round 1)

Do not introduce any of the following:

-   Distributor or volunteer attribution
-   Placement category
-   Message-level or handwritten-text tracking
-   Rankings, scores, or leaderboards
-   “Top”, “best”, or “worst” labels
-   Exposure or unopened-token inference
-   ZIP polygons, ZCTAs, or choropleth maps
-   Fine-grained or address-level location data

Absence of these features is intentional.

***

## Mapping Constraints

-   Mapping engine: Leaflet
-   Geometry: ZIP centroids only
-   Allowed map features:
    -   point markers
    -   marker clustering
    -   channel-based layer toggles
    -   time-since-go-live filtering
    -   optional heat overlay using centroids
-   Excluded:
    -   polygon fills
    -   boundary inference
    -   evaluative color scales

Maps should communicate emergence and clustering, not precision.

***

## UI Guardrails

-   Prefer filters over comparisons
-   Prefer aggregates over individual data
-   Calm, non-alarmist visual language
-   No UI that encourages competition or optimization narratives

***

## Change Control

Any expansion beyond this document requires explicit approval. If unsure, stop and ask before implementing.
