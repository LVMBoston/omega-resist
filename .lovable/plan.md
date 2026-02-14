

# Campaign Card UI Polish: Global Stats Toggle + Status Badges

## Overview
Two visual improvements to the Campaign Orchestration page cards.

---

## Change 1: Global Stats Toggle

**Problem**: The per-card `showStats` checkbox creates unequal card heights in the grid when some cards show stats and others don't.

**Solution**: Replace the per-card checkbox with a single global toggle at the top of the page (near the existing toolbar/header area). All cards expand or collapse stats together, keeping the grid uniform.

### What changes
- **`src/pages/CampaignManager.tsx`**:
  - Replace `showStatsMap` (Map of per-card booleans) with a single `showStats` boolean state, defaulting to `true`
  - Remove the per-card `Checkbox` + tooltip from each `SortableCard` header (lines ~728-744)
  - Add a global `Switch` or `Checkbox` labeled "Show Stats" in the page toolbar area (near the search bar or sort controls)
  - When `showStats` is `false`, **hide the entire stats block** (lines 764-800) rather than showing `-nm-` placeholders -- since all cards collapse together, heights stay uniform
  - Simplify `SortableCardProps` by removing `showStats` and `onToggleStats` props; the component reads the single parent state instead

---

## Change 2: Color-Coded Status Badges

**Problem**: Deployment status is shown as plain text or disabled buttons, making it hard to scan visually.

**Solution**: Replace with styled `Badge` components using semantic colors.

### What changes
- **`src/pages/CampaignManager.tsx`** (lines ~848-899):
  - Import `Badge` from `@/components/ui/badge`
  - **Deployed**: Green badge with date  
    `className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0"`
  - **Ready to Deploy**: Keep as a clickable `Button` (it triggers deployment), but style it with an amber/green accent so it stands out as an actionable item
  - **Not Ready to Deploy**: Amber badge  
    `className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0"`  
    wrapped in the existing `Tooltip` so the readiness details are still accessible on hover

---

## Technical Details

### Files modified
- `src/pages/CampaignManager.tsx` only

### New imports
- `Badge` from `@/components/ui/badge` (already exists in project)
- `Switch` from `@/components/ui/switch` (already exists) -- for the global toggle

### Risk
Low. All changes are purely presentational. No data fetching, state logic, or deployment behavior is modified.

