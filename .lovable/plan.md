## Add `docs/CAMPAIGN_STORY_TERMS.md`

Create one new documentation file. Nothing else in the project is touched.

### 1. The file

a. Create `docs/CAMPAIGN_STORY_TERMS.md` titled `"Opens" and "Shares" — what these numbers mean`.
b. Wording is exactly as you supplied — no words added, removed, or changed.
c. Formatting: the wrapped lines are joined back into normal paragraphs so the page renders correctly (bullet lists stay intact, no gaps mid-sentence). Only line breaks change.

### 2. Structure

a. **Opens** — what it counts, the problem we had to solve (no logins, no device tracking), how we worked around it (ZIP-based dedup, off for large public events), and the honest edge effects (slight undercount by neighbors, slight overcount at events, no way to verify people, plus the known starting-count rough edge).
b. **Shares** — counted at link creation, not open; the separate unopened-shares line; the recipient-visibility limit we won't resolve.
c. **Why not just report "people reached"?** — the closing rationale.

### 3. What does not change

- No code, queries, or metric computation.
- No rendered narrative text.
- No other documentation file, including `docs/CAMPAIGN_STORY_COMPUTATION.md`.
- No decision-log entry — this is a standalone explainer, not an approved-plan implementation record.
