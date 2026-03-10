

## Feature Summary Sections for Landing Page

### Proposed Categories (5)

Consolidating all end-user and organizer features into audience-neutral groups:

1. **Reach Without Risk** — Zero-friction QR access, no apps/accounts, anonymity by design, IP purging, trust-based spreading
2. **Rich Interactive Content** — Multimedia decks (video, GIF, images), interactive hotspots (download files, send SMS, compose email, open links), content updatable after QR codes are printed; *forthcoming: anonymous feedback forms, calendar reminders*
3. **Campaign Architecture** — Campaigns organized by chapters (Mobilize codes or zip codes), chapters initiate actions via QR/email/SMS, customizable messaging per chapter (subject lines, email & text body)
4. **Intelligence & Reporting** — Geographic reach on live maps, viral coefficient & chain depth analytics, AI-generated narrative reports for stakeholders, shareable public dashboards
5. **Safe Testing & Deployment** — Simulate campaigns without polluting the database, one-click QR generation, short URLs for easy distribution

### Campaign Structure Graphic

An inline SVG/CSS diagram showing the hierarchy:

```text
┌─────────────────────────────────────┐
│            CAMPAIGN                 │
│  ┌───────────┐  ┌───────────┐      │
│  │ Chapter A │  │ Chapter B │ ...  │
│  │ (zip/code)│  │ (zip/code)│      │
│  └─────┬─────┘  └─────┬─────┘      │
│    ┌───┴───┐      ┌───┴───┐        │
│    │Action │      │Action │        │
│    │QR/SMS │      │QR/SMS │        │
│    │Email  │      │Email  │        │
│    └───────┘      └───────┘        │
└─────────────────────────────────────┘
         ▼ Custom messaging per chapter
         ▼ Test mode (no data pollution)
         ▼ AI progress narratives
```

Built as nested `div` elements with Tailwind borders/colors — no external dependency. Styled to match the dark theme with amber/emerald accents.

### Page Placement

Insert two new sections between "Built for Anonymity" and "The Impact":

1. **"What You Can Do"** — The 5-category feature grid, each with a Lucide icon, title, and 2-line description
2. **"How Campaigns Are Organized"** — The campaign structure diagram with brief annotations

### Files Modified

1. **`src/pages/LandingPage.tsx`** — Add the two new sections, import additional Lucide icons (e.g. `RefreshCw`, `MessageSquare`, `BarChart3`, `FlaskConical`, `Layers`)

