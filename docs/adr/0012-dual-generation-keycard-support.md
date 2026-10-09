# 0012. Keycard generations are resolved per tap, never remembered

Date: 2026-09-16

Supersedes: 0005

Keycard applet 4.0 replaces the pairing-based secure channel with a pairing-less
one, drops `PAIR`, `UNPAIR`, `MUTUALLY AUTHENTICATE` and `IDENTIFY CARD`, and
changes the SELECT response. A locked card's applet is immutable, so 3.x cards
stay 3.x for good and the app speaks both protocols for as long as both exist.
The version is readable from the first SELECT of a tap, before any channel or
PIN, while the app's menus are chosen before a card is present. So a card's
generation is derived from `ApplicationInfo` on every tap and never persisted,
through one seam no screen bypasses. A generation is an ordered point at which
the feature surface changes, 3.1+ and 4.0+ today, kept separate from the secure
channel version because a later applet could keep V2 while starting a new
generation. The command layer stays generation-blind except where the cards
genuinely differ: the channel, pairing, the genuineness check and INIT.

Three mechanisms stay apart. A floor of applet 3.1 refuses older cards, which
lack `IDENTIFY CARD`; what the app can drive is a constant, not a setting. A
Settings selection of the generations in use, all ticked by default, leaves out
menu entries no ticked generation has and identify taps every ticked generation
can skip, and never refuses a card. The tap-time check is the backstop under
both. The selection is a set rather than a minimum, so a user can say "3.x only"
and skip the identify tap. It corrects itself from a tap, never from an update: a
tap of an unticked generation leaves a dashboard reminder that can tick it, held
in memory only, and a new generation arrives unticked for anyone with a saved
selection. An operation a card's generation lacks is identify-then-operate, a
SELECT-only first tap and then the operation, because the NFC layer cannot hold a
session open across input; ADR-0005's pairing-password flow becomes one instance
of that pattern. Generation-bound menu entries live in one table keyed by route,
since a per-entry field would compile silently when forgotten.

## Consequences

- Adding a generation is a row in the ordered table and, if it changes the menu,
  a row in the route table.
- Only Change pairing secret pays a second tap, and only when a generation
  without a pairing secret is ticked. The operating tap re-checks, so a wrong
  selection costs a typed PIN and an explanation, never a refused command.
- With the instance UID gone on 4.0, trust-shaped state keys on the card key
  (ADR-0013) and key-shaped state on the key UID, which also fixes a 3.x bug: a
  factory reset kept the instance UID while every exported key changed.
- `EntryList` filters before computing anything else, because testIDs are
  position-derived and the hero tile depends on the count.
- "Generation" and "secure channel" stay out of the UI; the user sees
  hand-written labels ("Applet 3.x") and the word "genuine".
- A NFC layer that keeps a session alive across input would collapse
  identify-then-operate to one tap. A third generation would test the
  totally-ordered-table assumption.
