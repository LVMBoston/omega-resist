

## Public Landing Page — Samizdat Narrative

### Concept

Replace the current minimal `Index.tsx` (logo + "Admin Dashboard" button) with a compelling, scroll-based public landing page that tells the Omega story through the samizdat lens. The page will be dark-themed (consistent with the existing black background), use no jargon, and guide visitors through a narrative arc.

### Page Structure

```text
┌─────────────────────────────────────┐
│  HERO                               │
│  Logo + tagline + "Learn More" ↓    │
├─────────────────────────────────────┤
│  SECTION 1: The Problem             │
│  "They control the platforms..."     │
├─────────────────────────────────────┤
│  SECTION 2: The Samizdat Way         │
│  Physical cards → digital chains     │
├─────────────────────────────────────┤
│  SECTION 3: How It Works             │
│  3-step visual (Card → Scan → Share) │
├─────────────────────────────────────┤
│  SECTION 4: Built for Anonymity      │
│  No logins, no tracking, IP purged   │
├─────────────────────────────────────┤
│  SECTION 5: The Impact               │
│  Metrics language (reach, chains)    │
├─────────────────────────────────────┤
│  FOOTER / CTA                        │
│  "Get Involved" + Admin link         │
└─────────────────────────────────────┘
```

### Narrative Content (Draft)

1. **Hero**: "OMEGA — Underground infrastructure for campaigns of resistance"
2. **The Problem**: Information is controlled. Platforms silence. Surveillance chills organizing. Traditional digital outreach leaves footprints.
3. **The Samizdat Way**: In the Soviet Union, samizdat was hand-copied literature passed person to person. Omega brings this model into the digital age — physical cards and posters carry QR codes that unlock content and create invisible trust chains.
4. **How It Works**: (1) Someone finds a card. (2) They scan and see your message. (3) They share it forward — each share extends the chain anonymously.
5. **Built for Anonymity**: No accounts required. No personal data collected. IP addresses automatically purged. Content spreads through trust, not tracking.
6. **The Impact**: Organizers see how far their message travels — across cities, states, and borders — without ever knowing who carried it.

### Technical Approach

- **Single file change**: Rewrite `src/pages/Index.tsx` as a multi-section scroll page
- **No new dependencies**: Use existing Tailwind classes, Lucide icons, and the omega-logo asset
- **Route unchanged**: Stays at the `/` path but the current redirect to `/campaign-config` needs adjustment — add a new `/about` or `/landing` route for this page, OR keep it at `/` and move the redirect logic
- **Routing plan**: Add a `/landing` route (no sidebar, no auth) in `App.tsx` alongside the other public routes. Update the current Index to be the landing page. The existing `/` redirect to `/campaign-config` remains for authenticated users.
- **Responsive**: Full-width sections, max-w-3xl content, works on mobile
- **Admin access preserved**: Small "Organizer Login" link in footer

### Files Modified

1. **`src/pages/Index.tsx`** — Complete rewrite as the narrative landing page
2. **`src/App.tsx`** — Add `/landing` as a public route (no sidebar), link Index there

