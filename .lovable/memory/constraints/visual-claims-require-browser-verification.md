---
name: Visual claims require browser verification
description: Any assertion about visible UI state (labels, numbering, ordering, visibility) must be confirmed via browser screenshot before being stated
type: constraint
---

Before asserting that a UI change produces a specific visible result — labels, slide/row numbering, ordering, badges, visibility toggles, "X now shows Y", "the orphan disappears", etc. — I MUST:

1. Open the preview with browser--view_preview on the exact route where the change is visible.
2. Take a screenshot (or use observe/extract) to confirm the claim.
3. Only then state the outcome. If verification fails or is impossible, say so explicitly instead of asserting.

Forbidden without a screenshot: "should now show", "becomes", "disappears", "is now labeled", or any equivalent visual claim presented as fact.

**Why:** The user has repeatedly caught incorrect visual assertions (e.g. claiming SSR/Slide 2 would re-label to SSR/Slide 3 when the actual UI still showed Slide 2 and Slide 4 with the orphan gap unchanged). Code-level reasoning is not a substitute for looking at the rendered result.

**How to apply:** This overrides brevity. Even for "small" fixes, run the browser check before the closing sentence. Mention in the reply that verification was done ("Verified in preview: …").
