

# Save Timezone Plan to Decision Log (Not Implemented)

## What

Save the timezone passthrough plan from the conversation to `docs/decisions/snapshots/2026-03-06_timezone-passthrough-snapshots_feature-doc_lovable.md` with **Status: Approved — Not Implemented**.

## File

**`docs/decisions/snapshots/2026-03-06_timezone-passthrough-snapshots_feature-doc_lovable.md`** — new file containing the full plan content from the conversation, with header:

```
Status: Approved — Not Implemented
Date: 2026-03-06
```

## Content

The plan document covering:

1. Problem — edge function formats all timestamps in UTC
2. Solution sections (2a–2c) — accept `timezone` param, validate, pass to `calculateMetrics`, update client callers, batch default
3. Technical detail — signature change, validation helper, formatting calls
4. Files changed table (4 files)
5. Risk assessment

No code changes. One new markdown file only.

