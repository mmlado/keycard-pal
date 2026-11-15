# 0018. Install lock uses a key the card derives

Date: 2026-11-15

A Developer card's card manager accepts a published key, the Keycard development
key or the GlobalPlatform default, so anyone holding the card for a minute can
delete the Keycard package, install an applet of their own and provision a fresh
identity; the phone then shows the unverified-card warning that the owner of such a
card has learned to approve. Keycard locks its own cards by writing random card
manager keys and moving the card to SECURED, and its guide notes that a lock is
reversible only for whoever stored those keys. Keycard Pal stores nothing per card,
so the Install lock takes its card manager key from the card itself: EXPORT BIP85
at `m/83696968'/128169'/16'/1196444747'` (BIP85 HEX, 16 bytes, the index spelling
"GPLK" in ASCII), used as ENC, MAC and DEK alike, behind the main PIN. Lock writes
that key and, on the first lock, moves the card to SECURED; unlock writes back the
published key the user picks. Every tap reads the card's state from one INITIALIZE
UPDATE whose cryptogram the phone checks against each candidate key, so no tap ever
authenticates with a guessed key.

## Considered options

- **A random key the app stores.** Keycard's own procedure, but the app would hold
  a per-card secret, and losing the phone would lock the card manager for good.
- **48 bytes split into ENC, MAC and DEK.** Three keys from the same PIN-gated
  export add no real separation, and no stock tool knows the split.
- **A key derived from the recovery phrase on the phone.** It would make every lock
  and unlock ask for the phrase.
- **A low index, such as 0.** Index 0 is every BIP85 tool's default, and someone
  counting up indexes for passwords would reach a small one.

## Consequences

- The path, and the index in it, can never change: a card locked under one index
  unlocks only under the same index. A new derivation would need its own ADR and
  would have to keep recognising this one.
- SECURED is permanent. A key holder can still delete, load and install there, so
  updates keep working, but unlocking never returns the card to OP_READY.
- With the card reset or its PIN and PUK blocked, the recovery phrase in any BIP85
  tool is the only way back to the card manager. A card in LEE mode derives a key no
  stock tool reproduces, so it is refused; a lock made under the duress PIN opens
  only under the duress PIN.
- An update deletes the whole Keycard package, the identity with it, so the card
  comes back with a new card key and the approval from ADR-0013 no longer matches.
- Selecting the card manager by its AID, SET STATUS, and one INITIALIZE UPDATE
  checked against several keys are missing from keycard-sdk, so they come from the
  SDK fork pinned by commit, with the same change offered upstream (ADR-0008).
- iOS waits on a device test: Core NFC may refuse a SELECT of the card manager.
- Revisit if Keycard ships a way to keep a card's identity across an update, or if
  the read-only checks on a spare card show that PUT KEY adds a keyset beside the
  published one instead of replacing it.
