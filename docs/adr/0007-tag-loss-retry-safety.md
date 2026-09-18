# 0007. Tag-loss retry safety: per-operation opt-in plus non-idempotent windows

Date: 2026-08-12
Status: accepted

## Context

Recovering from tag loss means re-running the operation from SELECT on the
next tap. That replay is not universally safe:

- `autoPair`: PAIR step 2 commits a pairing slot **on the card** before the
  response is read. A tag loss in that window followed by a silent replay
  burns another of the 10 slots, and Pal cannot enumerate occupied slots.
- `useInitCard`: the PUK is generated in JS and returned as the operation
  result. A loss after the card commits INIT destroys the PUK irrecoverably.
- Key generation produces a different key on each attempt.

Blanket auto-retry (what status-legacy effectively does) risks unrecoverable
card state; blanket no-retry keeps today's dead-end behaviour.

## Decision

Two independent gates, both of which must be permissive for a reconnect wait:

1. **Per-operation opt-in**: `retryOnTagLoss` (default `false`) on
   `UseNFCSessionOptions` / `ExecuteOptions`. Only read-only operations opt
   in: signing, key export, address enumeration, fingerprint verification,
   pairing-slot reads.
2. **Non-idempotent windows**: `retryUnsafeRef`, raised inside
   `doPairAndExecute` around `autoPair` **and around `verifyPIN`**,
   suppresses retry even for opted-in operations. The flag is cleared
   **only on success**, never in a `finally`: a `finally` runs while the
   exception unwinds, before the session's catch classifies it, so the
   window would never apply to the very throw it exists for. The session
   clears the flag on every `startNFC`/`reset` instead.

   The `verifyPIN` window exists because the card decrements its 3-attempt
   counter before the response is read: a tag loss there means the attempt
   may have been consumed invisibly. A device probe (2026-08-22) caught the
   pre-fix behaviour replaying a cached PIN 0.43 seconds after a reconnect
   with no prompt. A tag loss inside the window therefore also **discards
   the cached PIN**, so `retry()` re-prompts and every attempt against the
   counter is one the user explicitly authorised. A loss *after* a
   successful verify keeps the PIN and the reconnect wait: the PIN is
   proven correct for this session, so a replay cannot walk the counter.

When a gate blocks retry, the user sees an explicit ambiguity error
("Connection lost mid-operation. Check the card state before retrying."),
never a silent replay.

The wait itself is bounded (3 consecutive losses without a successful SELECT,
or a 6-second watchdog) because on iOS `phase === 'nfc'` renders no Pal UI, so
an unbounded wait on a dead session would be an invisible hang.

## Consequences

- Write flows keep today's fail-fast behaviour by design; the fix does
  nothing for them. `useSetCardName` and `useLoadKey` are textually
  idempotent and could opt in later; held back so the first release has the
  smallest replay surface.
- `useChangeSecret` must stay opted out: after the card commits a new PIN,
  the cached PIN is the old one, and a replay would burn a retry attempt.
- Failure mode of both gates is "show today's error", so a missed call site
  degrades to current behaviour, never to silent replay.

## Update, 2026-09-18: a loss before SELECT answers is always waited for

The opt-in above decides whether an operation may be **replayed**. Until SELECT
has answered there is nothing to replay: only SELECT has been sent, and SELECT
changes nothing on the card. So a card that leaves the field before then is
waited for whatever the operation is, a write included, inside the same bounds
(three consecutive losses, or the 6 s watchdog).

This came from a phone, not from theory. A card dropped 0.6 s after connecting,
before SELECT had answered, during initialization. Init is a write, so the
session called it "Connection lost mid-operation" and stopped, while the card
reconnected 150 ms later and then every few seconds underneath an error nobody
could leave: the bridge stops forwarding card events after `stopNFCWithError`,
so the sheet's "Tap your card to try again" had nothing behind it.

That second half is fixed separately. `useNFCOperation` now returns `retry`, so
every hook built on it (init, factory reset) gives the sheet a real "Try again".
Running such an operation again after a lost connection is safe because each
checks the card's state when it connects: init refuses a card that is already
set up, and factory reset refuses one that is already empty.

Once SELECT has answered, nothing here changes. A loss in a write is still the
ambiguity error, never a silent replay.

## Revisit

Per-operation opt-in for the held-back idempotent writes, once the reconnect
path has device mileage.
