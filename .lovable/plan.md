

# Add Documentation for Re-point QR Tool and Clone Campaign Tool

## Overview

Two tool docs are missing from the `docs/` directory:
1. The **Re-point QR Tool** (already built at `/repoint-qr`)
2. The **Clone Campaign Tool** (about to be built)

Both will be created following the project's naming convention and document structure.

## Files to Create

### 1. `docs/decisions/qr-generation/2026-02-20_repoint-qr-tool_feature-doc_lovable.md`

Documents the Re-point QR Tool:
- Purpose: swap the destination URL of existing short codes without changing the printed QR code
- How it works: updates `shortened_urls.full_url` via Campaign + EoA selection with UTM overrides
- URL construction logic (mirrors `mint_l00`)
- Key design decisions: no new tokens minted, no EoA record modification, avoids `invalidate_tokens_on_critical_change` trigger
- References: `src/pages/RepointQrTool.tsx`, `src/components/AppSidebar.tsx`

### 2. `docs/decisions/campaigns/2026-02-20_clone-campaign-tool_feature-doc_lovable.md`

Documents the Clone Campaign Tool:
- Purpose: duplicate a campaign and all its EoAs with a new code and title
- Clone defaults: code = `{old}-clone`, title = `{old} clone`
- What gets copied: campaign row + all EoA rows (preserving utm_id, mobilize_code, assigned_deck_slug, etc.)
- What does NOT get copied: tokens, shortened URLs, click data
- No schema changes required
- References: `src/pages/CampaignManager.tsx`

## No Other Changes

These are standalone documentation files -- no code modifications needed.

