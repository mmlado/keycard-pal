# 0013. Certificate cards are trusted by CA, and an override is remembered

Date: 2026-09-16

On 3.x the app proved a card genuine with `IDENTIFY CARD`, skipped whenever a
pairing existed, so in practice trust was on first use, keyed on the instance
UID. Applet 4.0 removes `IDENTIFY CARD` and the instance UID; the card returns a
98-byte certificate in its SELECT response and proves possession by signing the
secure channel handshake, and the SDK throws inside `select()` when the
certificate's CA is neither trusted nor whitelisted. There is one CA, the same key
keycard-shell ships. So on 4.0 genuineness is the certificate plus the handshake,
with no extra round trip, and 3.x keeps `IDENTIFY CARD` as it is; one verdict
over two implementations, and the user's word for it stays "genuine". An override
exists: the app catches the unknown-CA failure, reads the card identity public
key out of the already-parsed certificate, shows the existing warning, and on
approval whitelists that key and selects again. The approval is persisted, keyed
on that 33-byte key, which is what 3.x already did through its pairing record,
and is written only after `autoOpenSecureChannel` has verified the card's
signature; shell writes before opening the channel, so a card presenting a
certificate it cannot back leaves a permanent entry there. There is no revoke
path yet, which is a follow-up and not a considered end state.

## Consequences

- The CA key is load-bearing for the channel itself and is passed at every
  `Commandset` construction, never left to the SDK default.
- Development cards on a custom applet fail the check by design and go through
  the override; that is the normal path during this work.
- The check runs on every tap of a 4.0 card, since there is no pairing record to
  short-circuit it. Uninitialized cards are checked too, before a PIN, PUK or
  duress PIN is written; shell skips that.
- Detection is string-coupled to the SDK's messages, under ADR-0006's rule.
- A second CA, a rotation, or approvals turning out to be common would reopen
  this: the first turns the key into a set, the last makes the revoke path
  urgent.
