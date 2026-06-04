# AI Drafts — CORS Preflight Fix

Status: Approved & Implemented
Date: 2026-06-04

## Problem
Clicking "Generate" on BUGTEST campaign produced an instant red "Generation failed" toast (~280ms after click). Edge function logs showed only an OPTIONS preflight — the real POST never reached the server. Browser console reported a CORS policy block; Network tab showed no POST.

## Root cause
The `draft-campaign-message` edge function's `Access-Control-Allow-Headers` list was missing the newer headers that recent versions of `@supabase/supabase-js` send on every invocation: `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version` (plus `cache-control`, `pragma`). The browser rejected the preflight and never sent the POST.

Other edge functions in the project (e.g. `render-stats-snapshot`, `deploy-template-snapshots`) already include the full header allow-list — this one had drifted.

## Fix
1. Expanded `Access-Control-Allow-Headers` in `supabase/functions/draft-campaign-message/index.ts` to include the supabase client platform/runtime headers and cache-control/pragma. Added `Access-Control-Max-Age: 86400`.
2. Improved client error surfacing in `src/components/CampaignChapters.tsx` so future failures show the real reason (server message or "Request blocked before reaching server") instead of a generic retry message, and log to the console.

## Verification
- Direct POST to the deployed function returns 200 with a valid generated draft.
- Allow-Headers response now contains all required headers.

## Update to prior decision
This patches the bug introduced/exposed alongside the prominent AI drafting controls feature (`2026-06-04_ai-drafts-prominent-controls_feature-doc_lovable.md`). UX of that work is unchanged.
