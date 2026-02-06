

# Edge Function Health Check System

## Summary
Create a comprehensive health check page that tests all 10 edge functions and provides visual status for monitoring. This ensures you can quickly verify all backend functions are operational.

## What Was Just Completed

All 10 edge functions have been deployed:
- deploy-template-snapshots
- fetch-mobilize-event
- generate-campaign-pdf
- geoip
- get-mapbox-token
- import-google-slides
- import-powerpoint
- import-zip-codes
- render-stats-snapshot
- reverse-geocode

## Health Check Page Features

### Visual Status Dashboard
- Grid of cards showing each edge function
- Color-coded status indicators: green (healthy), red (failed), yellow (testing)
- Response time displayed for each function
- Last tested timestamp
- "Test All" button to run health checks on all functions
- Individual "Test" buttons for each function

### Test Methods by Function

| Function | Test Method | Expected Response |
|----------|-------------|-------------------|
| geoip | POST (empty body) | JSON with ip, latitude, longitude |
| reverse-geocode | POST with test coordinates | JSON with city, zip_code |
| get-mapbox-token | POST | JSON with token field |
| fetch-mobilize-event | POST with test event ID | JSON response |
| render-stats-snapshot | POST (basic test) | 200 status |
| deploy-template-snapshots | POST (basic test) | 200 status |
| generate-campaign-pdf | POST (basic test) | 200 status |
| import-zip-codes | POST (basic test) | 200 status |
| import-google-slides | POST (basic test) | 401 or 200 (JWT required) |
| import-powerpoint | POST (basic test) | 401 or 200 (JWT required) |

### Implementation Details

#### New File: `src/pages/EdgeFunctionHealth.tsx`
A dedicated health monitoring page that:
1. Lists all 10 edge functions with their configuration (JWT required or not)
2. Tests each function with a lightweight request
3. Shows pass/fail status, response time, and error details
4. Provides a "Deploy All" instruction reminder
5. Auto-refreshes status periodically (optional toggle)

#### Route Addition: `src/App.tsx`
Add route at `/edge-health` accessible to admins.

#### Integration with Sidebar
Add a "System Health" link under the admin section of the sidebar.

## Files to Create/Modify

1. **Create** `src/pages/EdgeFunctionHealth.tsx` - Health check dashboard
2. **Modify** `src/App.tsx` - Add route for `/edge-health`
3. **Modify** `src/components/AppSidebar.tsx` - Add navigation link

## UI Design

```text
+------------------------------------------+
|        Edge Function Health Check        |
|  Last checked: 2 minutes ago    [Test All]|
+------------------------------------------+
|                                          |
|  +--------+  +--------+  +--------+      |
|  | geoip  |  |reverse |  |mapbox  |      |
|  |   OK   |  |geocode |  | token  |      |
|  | 156ms  |  |   OK   |  |   OK   |      |
|  +--------+  | 234ms  |  |  89ms  |      |
|              +--------+  +--------+      |
|                                          |
|  +--------+  +--------+  +--------+      |
|  |mobilize|  |snapshot|  |deploy  |      |
|  | event  |  | render |  |snapshot|      |
|  |   OK   |  |   OK   |  |   OK   |      |
|  | 445ms  |  | 892ms  |  | 123ms  |      |
|  +--------+  +--------+  +--------+      |
|                                          |
|  +--------+  +--------+  +--------+      |
|  |campaign|  | import |  | import |      |
|  |  pdf   |  | slides |  |  pptx  |      |
|  |   OK   |  | AUTH   |  | AUTH   |      |
|  | 234ms  |  | (jwt)  |  | (jwt)  |      |
|  +--------+  +--------+  +--------+      |
|                                          |
|  +--------+                              |
|  | import |                              |
|  |zipcodes|                              |
|  |   OK   |                              |
|  | 567ms  |                              |
|  +--------+                              |
+------------------------------------------+
```

## Why Functions Become Inactive

For reference, edge functions can become inactive due to:
- Platform updates requiring redeployment
- Cold start timeouts on the hosting infrastructure
- Failed previous deployments due to syntax/import errors
- Manual deletion from the dashboard (if accessed externally)

The health check page provides early warning when functions stop responding.

