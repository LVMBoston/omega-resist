# Clear Simulation Data Controls

Status: Approved & Implemented
Date: 2026-04-24

## Approved Plan

## 1. Goal

1a. Add a dashboard option that lets authorized users clear simulation data without touching real campaign data.

1b. Support two cleanup scopes: the currently selected campaign and all campaigns.

## 2. Data safety rules

2a. Delete only records explicitly marked as simulated.

2b. Delete simulated events before simulated tokens so token cleanup does not leave event rows behind.

2c. Keep real tokens and real events unchanged.

## 3. Access rules

3a. Run cleanup through a protected backend function instead of direct client-side table deletion.

3b. Allow only admins and managers to clear simulation data.

## 4. Dashboard behavior

4a. Add a “Clear Simulation Data” control to the Campaign Dashboard filter bar.

4b. Let the user choose either “Current campaign only” or “All campaigns.”

4c. Require a confirmation dialog before deletion.

4d. Refresh dashboard queries, map data, and aggregate metrics after cleanup.

## 5. Implementation notes

5a. Added the `clear_simulation_data` backend function.

5b. Added the dashboard menu and confirmation flow.

5c. The approved plan is documented as a new plan named **Clear Simulation Data Controls**.