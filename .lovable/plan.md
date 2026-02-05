
# Fix: Mobile Template Rendering Race Condition

## Problem Summary
The deployed Data Template slide shows broken layout on mobile because:
1. `campaignCode` is resolved asynchronously in a `useEffect`
2. On first render, `campaignCode` is empty, making `campaignSnapshotUrl` null
3. With no snapshot URL, mobile falls back to dynamic hotspot rendering
4. Dynamic rendering breaks on small screens (overlapping text, layout issues)

Additionally, `effectiveTemplateId` in `ViralSlideV2.tsx` has no fallback when the prop is missing.

## Technical Solution

### File 1: `src/components/ViralSlideV2.tsx`
**Change**: Add fallback for `effectiveTemplateId` using the template ID from the database query.

```text
Current (line 284):
const effectiveTemplateId = propTemplateId;

Fixed:
const effectiveTemplateId = propTemplateId || slideData?.template_id;
```

However, `slideData` is not in scope at line 284 (it's inside the `useEffect`). We need to store it in state:
- Add state: `const [resolvedTemplateId, setResolvedTemplateId] = useState<string | null>(null);`
- In `fetchConfig`, after querying `slideData`: `setResolvedTemplateId(slideData.template_id);`
- At line 284: `const effectiveTemplateId = propTemplateId || resolvedTemplateId;`

### File 2: `src/components/StatsPageSlide.tsx`
**Change**: Add a loading gate for mobile devices while campaign code is being resolved.

1. Add state to track resolution status:
   ```typescript
   const [campaignResolved, setCampaignResolved] = useState(false);
   ```

2. Update the `extractCampaignCode` effect to set this flag when done:
   ```typescript
   // At the end of extractCampaignCode async function:
   setCampaignResolved(true);
   ```

3. Add early return for mobile while resolving:
   ```typescript
   // Before the main render, after the shouldUseCachedSnapshot logic:
   if (isMobile && !campaignResolved) {
     return (
       <div className="relative w-full h-full bg-black flex items-center justify-center">
         <Loader2 className="w-8 h-8 animate-spin text-white" />
       </div>
     );
   }
   ```

## Expected Outcome
- Mobile devices will show a loading spinner while `campaignCode` resolves
- Once resolved, if a snapshot exists at `{templateId}/snapshot-{campaignCode}.png`, it displays
- If no snapshot exists, dynamic rendering occurs (less ideal but functional)
- The `templateId` prop will correctly fall back to the database value

## Files to Modify
1. `src/components/ViralSlideV2.tsx` - Add `resolvedTemplateId` state and fallback logic
2. `src/components/StatsPageSlide.tsx` - Add `campaignResolved` state and mobile loading gate
