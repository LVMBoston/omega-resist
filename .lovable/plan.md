

## Plan: Export full project chat history to Markdown

### 1. What I'll build

A single Markdown file containing every user + AI message in this project's chat history, in chronological order, saved to `/mnt/documents/` and delivered as a downloadable artifact.

### 2. How it works

a. Use `trajectory_observability--get_trajectory_events` to pull events for this project, filtered to `event_types` covering user messages and AI assistant messages only (no tool calls, no file edits, no builds).
b. Paginate backwards using `before_event_id` until the full history is retrieved (the API returns most recent first; I'll page until exhausted).
c. Sort the collected events chronologically (oldest → newest).
d. Render each turn as a Markdown section:
   - Heading with turn number + timestamp + role (User / Assistant)
   - Message body in a blockquote or fenced block to preserve formatting
e. Write the result to `/mnt/documents/chat-history.md`.
f. Emit a `<lov-artifact>` tag so you can preview / download it.

### 3. Output structure

```text
# Project Chat History
Exported: <date>
Total turns: <N>

---

## Turn 1 — 2026-XX-XX HH:MM — User
<message>

## Turn 2 — 2026-XX-XX HH:MM — Assistant
<message>

...
```

### 4. Caveats

a. "Everything available" means everything the trajectory store has retained for this project — very old turns may have been pruned by the platform; I can't recover what isn't there.
b. Tool calls, file diffs, and system-injected context blocks are excluded per your "User + AI messages only" choice.
c. If the file gets very large (multi-MB), I'll still deliver one file — let me know afterward if you'd prefer it split by date.

### 5. Decision log

This is a new one-off export task, not a feature change — no entry needed under `docs/decisions/`.

