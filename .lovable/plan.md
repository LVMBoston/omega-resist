

# Rename "Show No Spawns" Label

## Change

Update the checkbox label text from **"Show No Spawns"** to **"Show events having no spawns"** in the Campaign Dashboard's map filter controls.

## File Changed

| File | Line | Change |
|------|------|--------|
| `src/pages/CampaignDashboard.tsx` | 857 | Change `Show No Spawns` to `Show events having no spawns` |

## Technical Detail

Single text change on line 857 of `src/pages/CampaignDashboard.tsx`:

```
- Show No Spawns
+ Show events having no spawns
```

No logic or behavior changes -- label only.

