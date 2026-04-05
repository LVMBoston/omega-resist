

## Plan: Add Breadcrumb Trails to Detail Pages

### Goal
Replace back-arrow buttons with breadcrumb trails on two additional detail pages, matching the pattern already established on `CampaignDetail`.

### Pages to Update

**1. DeckEditor (`src/pages/DeckEditor.tsx`)**
- a. Import `Breadcrumb*` components and `Link` from react-router-dom
- b. Replace the back-arrow `Button` + `<h1>Editing Deck: {slug}</h1>` block (lines 1340-1348) with a breadcrumb: **Deck Management > {slug}**
- c. "Deck Management" links to `/deck-management`; the current deck slug is the terminal `BreadcrumbPage`

**2. TemplateEditorPage (`src/pages/TemplateEditorPage.tsx`)**
- a. Import `Breadcrumb*` components and `Link`
- b. Replace the back-arrow `Button` + `<h1>` in the header (lines 132-141) with a breadcrumb: **Template Repository > {template name or "New Template"}**
- c. "Template Repository" links to `/interactive-templates`; the template name (or "New Template" for create mode) is the terminal `BreadcrumbPage`

### What Does Not Change
- All other header elements (unsaved-changes indicator, Save/Cancel/Save-As buttons on DeckEditor; the editor body on TemplateEditorPage)
- No route changes, no sidebar changes

### Documentation
3. Update existing decision doc `docs/decisions/campaigns/2026-04-05_campaign-detail-new-tab_feature-doc_lovable.md` with a new `## Update — 2026-04-05` section noting breadcrumbs were extended to DeckEditor and TemplateEditorPage.

