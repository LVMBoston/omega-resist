
## Restore the Update Scheduler (Settings Tab) — Filters Stay Persistent

### Confirmed: Filters Are Already Persistent
The filters bar in `CampaignDashboard.tsx` (lines 781–900) sits inside `<Tabs>` but **outside** any `<TabsContent>` block. This is intentional — it renders on every tab regardless of which is active. This behavior will not be changed.

---

### What This Plan Does
Adds a 5th **"Settings"** tab to the Campaign Dashboard that hosts `CampaignSnapshotSettings` — the update scheduler / server-side rendering panel that was orphaned when the Filter tab was removed.

---

### Single File Change: `src/pages/CampaignDashboard.tsx`

**Change 1 — Expand TabsList from 4 to 5 columns** (line 774):
```
grid-cols-4  →  grid-cols-5
```
Add a new trigger:
```tsx
<TabsTrigger value="settings">Settings</TabsTrigger>
```

**Change 2 — Add TabsContent for Settings** (before the closing `</Tabs>` tag, ~line 1219):
```tsx
<TabsContent value="settings" className="mt-6 animate-fade-in">
  {selectedCampaignId && selectedCampaign ? (
    <CampaignSnapshotSettings
      campaignId={selectedCampaignId}
      campaignCode={selectedCampaign}
    />
  ) : (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        Select a campaign to manage snapshot settings.
      </CardContent>
    </Card>
  )}
</TabsContent>
```

---

### Technical Notes
- `CampaignSnapshotSettings` is already imported at line 38 — no new import needed.
- `selectedCampaignId` and `selectedCampaign` (the campaign code) are already in scope at the render location.
- The filters bar remains untouched and will continue to appear on all 5 tabs.
- No database or schema changes needed.
- Only one file is edited.
