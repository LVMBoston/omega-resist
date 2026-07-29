# "Opens" and "Shares" — what these numbers mean

Every Campaign Story reports two numbers: **Opens** and **Shares**. This page explains what they count, how we handle the tricky cases, and where we drew a hard line rather than collect more data about the people engaging with a campaign.

## Opens

**Opens counts how many times someone actually opened your link or scanned your QR code.** Not how many people you sent it to. Not how many times you posted it. If nobody has clicked yet, that's what the number says.

### The problem we had to solve

We don't ask people to log in, and we don't track devices across visits. That's deliberate — these campaigns are often shared by activists and organizers, and requiring an account or fingerprinting a phone is exactly the kind of tracking we don't want to build. But without *some* way to tell "the same person opened this twice" from "two different people opened it," every reload would count as a brand-new open, and the number would balloon into meaninglessness.

### How we worked around it

We use a light-touch, no-account signal instead: **rough location**.

- For most campaigns, if a second open comes from the same ZIP code shortly after the first, we treat it as the same person checking the link again and don't add to the count.
- For large public events (rallies, tabling, canvassing), we turn that dedup off — because at an event, dozens of different people scan the same QR code standing in the same ZIP code, seconds apart. Deduping by location there would undercount the room by a lot. Every scan counts.

### The honest edge effects — and why we're not fixing them

These trade-offs are the price of *not* tracking people, and they cut both ways:

- **Opens can be slightly undercounted.** Two different neighbors in the same ZIP code, opening the link separately, may register as one open. We accept this rather than ask for more precise location or a device ID to tell them apart.
- **Opens can be slightly overcounted at events.** If the same person scans the code twice at a rally (closes the tab, re-scans out of habit), each scan counts separately. We accept this rather than track individual devices at events, which is exactly where anonymity matters most.
- We have no way to verify these are different *people* rather than the same person on two devices, or vice versa. Getting a real head count would require logins or device fingerprinting. We're not going to build that.

One more thing worth naming plainly: a freshly-created link that nobody has opened yet can still show a small starting count from the link's own setup record, before any real visit. That one isn't a privacy trade-off — it's a known rough edge in how the number is assembled, and unlike the two above, it's fixable without touching anyone's privacy. It's on the list.

## Shares

**Shares counts how many times someone forwarded your campaign on to someone else** — every text, email, or social link generated from your content adds one.

### The honest limit here

A Share is counted the moment the link is *created* — when someone hits "send" — not when it's opened. Some of those shares are never opened by the person who received them. We don't hide that: campaigns also show a separate line for shares that went out but haven't been opened yet, so that gap stays visible rather than getting rolled into the total.

### The edge effect we can't resolve without compromising privacy

We don't know who receives a share, on purpose — no phone numbers or email addresses are attached to a click. That means:

- One share might reach one person, or it might reach a group text of twenty.
- A share might be screenshotted, printed, or forwarded again entirely outside our system, and we'll never see it.
- We can't distinguish any of these cases from each other.

The alternative — tracking recipients so we could tell a 1-person share from a 20-person share — would mean collecting exactly the kind of contact data we chose not to collect. So Shares counts *intent to pass it on*, not confirmed reach, and that's a permanent limit, not a bug to fix later.

## Why not just report "people reached"?

Because we'd have to start tracking people to say it honestly, and we won't. Opens and Shares are the most accurate numbers we can report *without* logins, device fingerprints, or stored contact info — which matters more than usual here, given who's often sharing these campaigns and why. They're not exact head counts. They're honest, privacy-respecting proxies for reach and spread, and every place they fall short is documented above rather than smoothed over.
