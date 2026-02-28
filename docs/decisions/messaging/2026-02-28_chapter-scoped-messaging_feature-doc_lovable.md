# Chapter-Scoped Messaging Templates

**Status:** Approved & Implemented
**Date:** 2026-02-28

---

Implements 3-tier message template resolution (Chapter → Campaign → Global) with a Campaign Creation Wizard, Chapter Creation Form, and Chapters tab. Adds `campaign_type` column as a cheap hook for future campaign types. See `.lovable/plan.md` for full plan details.

## Key Changes
- **DB**: `campaign_message_overrides` table, `resolve_message_template` function, `campaign_type` column on `campaigns`
- **UI**: `CampaignWizard.tsx`, `ChapterForm.tsx`, `CampaignChapters.tsx`, Chapters tab on CampaignDetail
- **Runtime**: `InteractiveSlideOverlay.tsx` uses scoped resolution with `{{city}}`, `{{state}}`, `{{site_name}}` placeholders
- **Clone**: Campaign clone now copies messaging overrides
