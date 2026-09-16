# 0013. Certificate cards are trusted by CA, and an override is remembered

Date: 2026-09-16
Status: accepted

## Context

Before applet 4.0, Pal established that a card was genuine with `IDENTIFY CARD`:
a random challenge, a signature, and a certificate whose CA key had to match the
one hardcoded in `src/constants/keycard.ts`. A card that failed produced a
warning the user could accept, and the approval lived in memory for the session.
The check was skipped entirely whenever a pairing already existed, and pairings
persist, so in practice 3.x has always been trust-on-first-use keyed on the
instance UID.

Applet 4.0 removes `IDENTIFY CARD`. Instead the card returns a 98-byte
certificate in the clear in its SELECT response, and proves it holds the matching
private key by signing the secure channel handshake transcript. The instance UID
is gone, so the pairing record that used to carry the implicit trust decision does
not exist either.

The SDK enforces this inside `select()`: it recovers the CA key from the
certificate and throws when that key is neither trusted nor whitelisted. Its
default CA constant is byte-identical to the key Pal already ships, which is also
the key keycard-shell ships. There is one CA, and no separate development CA, so
a card running a custom applet is expected to fail the check.

## Decision

**On 4.0 cards, genuineness is the certificate plus the handshake.** No extra
round trip: the certificate arrives with SELECT and possession is proven by the
channel Pal opens anyway. On 3.x, `IDENTIFY CARD` stays exactly as it is.

**One verdict, two implementations.** "Does this certificate chain to the CA" is
split from "parse and challenge-verify an `IDENTIFY CARD` response", with a single
genuineness verdict above them. Shell arrived at this split as a bug fix, after
reusing its IDENTIFY parser on the raw SELECT certificate made the 4.0 check fail
on every card. The user-facing concept stays singular: a card is genuine or it may
not be.

**An override exists and is remembered.** Catching the unknown-CA failure, Pal
reads the card identity public key out of the certificate (which is fully parsed
before the throw), shows the existing warning, and on approval whitelists that key
and selects again. The approval is **persisted**, keyed on that 33-byte key.

Persisting is not a new stance so much as an honest one: 3.x already behaves this
way through the pairing record, and a per-session override would mean 4.0 nags
where 3.x does not. It is recorded in `CONTEXT.md` as the one deliberate exception
to the stateless-session rule.

**The approval is written only after the handshake proves possession.** The SDK
forces the trust verdict at `select()` time, before any possession proof, so the
approval is held in memory to get through the re-select and committed only once
`autoOpenSecureChannel` has verified the card's signature. Shell writes its
approval before opening the channel, which means a card presenting a certificate
it cannot back leaves a permanent trust entry behind. Pal does not.

**There is no revoke path yet.** Approvals cannot currently be seen or undone,
which matches shell. This is accepted as the simplest thing that works and is
recorded as a follow-up, not as a considered end state.

## Consequences

- `KEYCARD_CA_PUBLIC_KEY` becomes load-bearing for the secure channel itself on
  4.0, not just for a check Pal performs. It is passed explicitly at every
  `Commandset` construction rather than relying on the SDK default.
- Our own development cards, running a custom applet, fail the CA check by design
  and are waved through by the override. That is the normal path during this work,
  not an edge case.
- The check runs on every tap of a 4.0 card, because 4.0 is stateless and there is
  no pairing record to short-circuit it. That is stricter than 3.x and is kept
  deliberately rather than cached away.
- Detection is string-coupled: the SDK throws `APDUException` with a fixed message
  for the unknown-CA case, and the same class for handshake failures. Those
  literals join the closed inventory ADR-0006 keeps for tag loss, with the same
  rule that they belong to upstream and may not be paraphrased.
- Uninitialized 4.0 cards are checked too. The SDK gates on the secure-channel
  capability and the version, never on initialization status, so Pal verifies
  before writing a PIN, PUK or duress PIN. Shell skips the check in that case.
- A persisted approval survives reinstall only as far as the storage does, and is
  invisible to the user until the follow-up lands.

## Revisit if

- A second CA appears, or the CA is rotated. The single hardcoded key becomes a
  set, and the "unknown CA" message stops meaning "probably not a real Keycard".
- Approvals turn out to be common rather than rare, which would mean either the
  warning is firing when it should not, or users are clicking through it. Either
  reading makes the missing revoke path urgent.
- The SDK grows a dedicated error type for the unknown-CA case, which would let
  the string match go.
- A future applet proves possession before or during SELECT, which would remove
  the ordering problem this ADR works around.
