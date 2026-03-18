

## Update Global SMS L00 Default — Option 3 (Universal Opener)

### Final template

> I came across a QR code. What I found was eye-opening and motivating — and it reminded me of samizdat, the underground literature dissidents used to share when speaking the truth could put them in jail. Think Solzhenitsyn's "The Gulag Archipelago." Mass surveillance, attacks on the press, protesters tagged as domestic terrorists — sound familiar? I'm sending this to those I trust. I hope you'll do the same. {{link}}

### Implementation

- **Single data update** on `settings` row `369b35b4-8615-4f00-9097-d65f9badb756` (category `sms`, key `l00_template`): set `value->'body'` to the message above.
- No code or schema changes — the app resolves this dynamically via `resolve_message_template` and `useSettings`.

