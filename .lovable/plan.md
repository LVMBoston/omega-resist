

# Decision: Bug-Fix Timing During Test Plan Execution

## Options

### Option A — Fix bugs as found (inline)
- a. At each step, if a bug is observed, pause testing, fix it, re-verify that step, then continue.
- b. Pro: Each subsequent step runs against corrected code, so later tests aren't polluted by earlier failures.
- c. Con: Longer wall-clock time per round; context-switching between testing and coding.

### Option B — Full pass first, then batch fix
- a. Run all 5 locations, screenshot and log every issue, then fix everything in one batch.
- b. Pro: Faster initial pass; full picture of all issues before touching code.
- c. Con: Bugs may cascade — a missing thumbnail in Step 2 could cause false failures in Steps 3–4 if they share the same data path.

## Recommendation: Option A — Fix inline

For this codebase, most thumbnail bugs share resolution logic (`thumbnail_url → cached_snapshot_path → content_url`). A bug in one location usually means the same bug exists everywhere, so fixing it early prevents redundant screenshots of the same failure repeated 4 more times.

## Updated Workflow Protocol

At each numbered step:

1. I ask you to navigate to the required route and say "OK."
2. I run browser tools (screenshot, observe, console logs).
3. **If a bug is found:** I fix it immediately, ask you to confirm the preview has reloaded, then re-verify that step before moving on.
4. If clean, I report findings and move to the next step.

This keeps each step self-contained and verified before proceeding.

