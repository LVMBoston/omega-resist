

# Save Architectural Decision Documents

## What Will Be Created

A single decision document capturing both the Unified Slide Architecture plan and the GitHub Branching Strategy, saved to:

```
docs/decisions/architecture/2026-02-25_unified-slide-model_feature-doc_lovable.md
```

## Document Contents

The file will include:

1. **Header** with `Status: Planned` (not yet implemented), date, and author
2. **Part A -- Unified Slide Architecture**
   - Problem statement (hard-forked `image` vs `spread-word` types)
   - Proposed image-first, auto-detect model
   - Auto-demotion logic (removing all hotspots demotes back to `image` and cleans up the empty `viral_slide_configs` row)
   - Deletion handling across all three code paths (DeckEditor, DeckViewer, DeckManagement)
   - Risk assessment and files affected vs untouched
   - Three implementation phases
3. **Part B -- GitHub Branch Workflow**
   - Setup steps (Labs toggle, branch creation, Lovable branch switch)
   - Day-to-day switching workflow
   - Merge via Pull Request
   - Backend caveat (migrations/edge functions are branch-agnostic)

## Technical Details

- Single new file creation, no code changes
- Content is a consolidation of the discussion from this conversation thread
- Future updates will be appended as `## Update -- YYYY-MM-DD` sections per the project's decision-log convention

