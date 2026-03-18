# Universal SMS L00 Opener — Option 3

**Status:** Approved & Implemented  
**Date:** 2026-03-18

## Context

The global SMS L00 template needed a universal opener that works for both "Action-type" EoAs (QR codes left in the wild) and "Event-type" EoAs (QR codes distributed at rallies). The previous draft used "someone left behind," which only fit Actions.

## Decision

Adopted Option 3: "I came across a QR code." as a neutral, universal opener.

## Final Template

> I came across a QR code. What I found was eye-opening and motivating — and it reminded me of samizdat, the underground literature dissidents used to share when speaking the truth could put them in jail. Think Solzhenitsyn's "The Gulag Archipelago." Mass surveillance, attacks on the press, protesters tagged as domestic terrorists — sound familiar? I'm sending this to those I trust. I hope you'll do the same. {{link}}

## Implementation

- **Data update only**: Updated `settings` row `369b35b4-8615-4f00-9097-d65f9badb756` (category `sms`, key `l00_template`) — set `value->'body'` to the message above.
- No code or schema changes. The app resolves this dynamically via `resolve_message_template` and `useSettings`.

## Future Work

- Event-type campaigns can override the opener via `campaign_message_overrides` (e.g., "I scanned a QR code at an event").
- Campaign-specific SMS L00 overrides for targeted messaging (e.g., ICE accountability themes).
