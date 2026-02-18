
## Two Fixes: Title Sentinel Stripping + Days Active Reformatting

### Problem 1 — `__TITLE__` markers appear raw in Copy output
The `handleCopy` function in `CampaignNarrativeDialog.tsx` writes `narrative` verbatim to the clipboard. Since the narrative string contains `__TITLE__ICE OUT FOR GOOD__TITLE__`, that raw text gets pasted. The fix mirrors what the download handler already does: strip the sentinels before writing to clipboard.

### Problem 2 — "days active" line wording
Line 173 in `campaignNarrative.ts` reads:
```
Campaign Story · 32 days active
```
The user wants it reformatted to:
```
Campaign active for 32 days
```

---

### Changes Required

**File 1: `src/components/CampaignNarrativeDialog.tsx`**

Update `handleCopy` to strip `__TITLE__` sentinels (replacing them with just the plain title text) before writing to clipboard:

```typescript
const handleCopy = async () => {
  const plain = narrative
    .split("\n")
    .map((line) => {
      if (line.startsWith("__TITLE__") && line.endsWith("__TITLE__")) {
        return line.replace(/__TITLE__/g, "");
      }
      return line;
    })
    .join("\n");
  await navigator.clipboard.writeText(plain);
  toast({ title: "Copied!", description: "Narrative copied to clipboard." });
};
```

**File 2: `src/lib/campaignNarrative.ts`**

Change line 173 from:
```typescript
lines.push(`Campaign Story · ${daysActive} days active`);
```
to:
```typescript
lines.push(`Campaign active for ${daysActive} days`);
```

---

### Technical Notes
- No database or schema changes needed.
- The `__TITLE__` sentinel system (used for bold rendering in the dialog) is preserved — only the clipboard and display text is cleaned up.
- The download `.md` file already correctly converts `__TITLE__` to `# Heading` — no change needed there.
- Both files are small, targeted one-line or small-block edits.
