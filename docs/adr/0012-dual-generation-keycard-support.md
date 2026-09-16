# 0012. Keycard generations are resolved per tap, never remembered

Date: 2026-09-16
Status: accepted
Supersedes: 0005

## Context

Keycard applet 4.0 (tagged 2026-09-14) replaces the pairing-based secure
channel with a pairing-less one, removes `PAIR`, `UNPAIR`, `MUTUALLY
AUTHENTICATE`, `IDENTIFY CARD` and the pairing-secret credential, and changes
the SELECT response: no instance UID, no secure-channel public key, no free
pairing slot count, plus a new status byte and a certificate.

The applet is immutable once a card is locked, so 3.x cards in the field stay
3.x forever. This is not a migration with an end date. Pal has to speak both
protocols for as long as both cards exist.

Two facts shape everything else. The applet version is readable from the first
SELECT of a tap, with no secure channel, no pairing and no PIN, so the decision
is available at the earliest possible moment and costs nothing. And Pal's menus
are chosen before a card is present: the user picks an action, then taps. Unlike
keycard-shell, which holds a card in a slot and can shape its menus around it,
Pal cannot know the generation at the moment the user chooses.

Pal had no version or capability gating at all. It selected, logged a version it
ignored, and issued 3.x-shaped APDUs regardless.

## Decision

**A generation is derived from `ApplicationInfo` on every tap and never
persisted.** One seam answers "which generation is this", every consumer goes
through it, and no screen compares a version number itself. A **generation** is
an ordered point at which the feature surface changes, expressed as a minimum
applet version: 3.1+ and 4.0+ today. A new applet release earns a generation only
when it changes what the app can do, so generations and releases are not the same
list. The secure channel version stays a separate attribute, because a later
applet could keep V2 while introducing a new generation.

**The command layer stays generation-blind.** Only what genuinely differs
branches: the channel, pairing, the genuineness check, and INIT. Signing, key
export, PIN and PUK changes, card name, factory reset and address enumeration are
written once. Pal already sends an explicit derivation path with every SIGN and
EXPORT and never relied on card-side "current key" state, so 4.0 removing it
costs nothing.

**Three mechanisms, kept separate on purpose:**

- A **floor** of applet 3.1 refuses older cards outright, as shell does. Below it
  there is no `IDENTIFY CARD`, so those cards would otherwise work in a degraded,
  never-verified way. What the app can drive at all is a safety property and is a
  constant, not a setting.
- A **Settings picker** lets the user declare a generation, which hides menu
  entries below it. It is cosmetic: it never refuses a card. A user set to 4.0+
  who taps a 3.x card gets a working card, just without the legacy entries.
- A **tap-time check** is the correctness backstop under both, because only the
  tap can know the truth.

The floor and the picker are not merged. They answer different questions, and a
merged control would let a user with two cards lock themselves out of one through
a preference they set months earlier and forgot.

**Operations a card's generation does not support are two-step.** The first tap
is SELECT only: it reads the generation and ends. The app then collects whatever
the operation needs, and a second tap executes. The NFC layer cannot hold a
session open while the app collects input, which is the constraint ADR-0005
recorded for the custom pairing password. That flow becomes one instance of this
general identify-then-operate pattern, which is why this ADR supersedes it rather
than sitting beside it.

Menu entries that are generation-bound are listed in **one table keyed by route**,
not tagged on each entry. Two of roughly thirty entries are bound (Manage pairing
slots, Change pairing secret), no screen imports the entry type so a per-entry
field would compile silently when forgotten, and the dashboard builds entries from
a second type that would need the field too.

## Consequences

- Adding a generation means adding a row to the ordered table and, if it changes
  the menu, a row to the route table. No screen changes.
- Only Change pairing secret pays a second tap, and only for users who have not
  narrowed the picker. Manage pairing slots stays one tap: it needs no PIN and
  already taps as part of its own screen.
- The instance UID is gone on 4.0, so trust-shaped state keys on the card key
  (see 0013) and key-shaped state keys on the key UID. The export resume cache
  moves to the key UID, which also fixes a latent 3.x bug: a factory reset with a
  new seed keeps the instance UID while every exported key changes.
- Filtering happens inside `EntryList`, before it computes anything else.
  testIDs are position-derived and `TileGrid` promotes the first entry to a hero
  tile on odd counts, so hiding an entry late would renumber ids and reshuffle the
  layout.
- A card info screen showing the applet version was wanted but is not part of
  this work: what it should show was not settled, so it is tracked separately
  in #305, along with deleting the unreachable `KeycardLogScreen`.
- The words "generation" and "secure channel" stay out of the UI, and the
  user's word for the trust verdict is "genuine", as in shell. Applet versions
  are shown, though, where shell shows none: as major.minor in the Settings
  picker and in the message refusing a card below the floor, because telling
  the user which card they hold is the point of those surfaces.

## Revisit if

- The NFC layer gains a way to keep a session alive across input, which would
  collapse identify-then-operate back to one tap and make ADR-0005's original
  revisit condition live again.
- An applet ships that changes the feature surface without changing the secure
  channel, or the reverse. The two axes are already modelled separately, but this
  would be the first time that separation is load-bearing.
- 3.x cards become rare enough that carrying the legacy path costs more than
  dropping it, at which point the floor moves rather than the design changing.
- A third generation arrives and the ordered-table assumption (generations are
  totally ordered by minimum version) stops holding.
