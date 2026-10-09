# 0007. Tag-loss retry safety: per-operation opt-in plus non-idempotent windows

Date: 2026-08-12

Recovering from a tag loss means replaying the operation from SELECT on the next
tap, and that is not universally safe: PAIR step 2 commits a pairing slot on the
card before its response is read, INIT commits a PIN and PUK, and key generation
produces a different key each time. So replay sits behind two gates that must
both open. Each operation opts in with `retryOnTagLoss`, and only read-only ones
do (signing, key export, address enumeration, fingerprint verification,
pairing-slot reads). And `retryUnsafeRef` is raised around `autoPair` and around
`verifyPIN`, cleared only on success and never in a `finally`, which would run
during unwinding before the loss is classified. A loss inside the `verifyPIN`
window also discards the cached PIN, because the card decrements its counter
before answering: a device probe on 2026-08-22 caught the earlier code replaying
a cached PIN 0.43 s after a reconnect with no prompt. A blocked replay shows the
ambiguity error, never a silent retry, and the wait is bounded (three losses
without a successful SELECT, or 6 s), because iOS draws no app UI during a tap.

Before SELECT has answered there is nothing to replay, so every operation waits
there, writes included. On a phone a card dropped 0.6 s after connecting during
initialization and reconnected 150 ms later under an error nobody could leave,
because the bridge stops forwarding card events after an error stop. For the
same reason `useNFCOperation` returns `retry`, so init and factory reset get a
real Try again; running them again is safe because each checks the card's state
on connect. A card with a certificate has no `autoPair` window, and its retry is
a fresh handshake with new session keys.

## Consequences

- Write flows fail fast by design. `useSetCardName` and `useLoadKey` are
  idempotent and could opt in once the reconnect path has device mileage.
- `useChangeSecret` must stay opted out: after the card commits a new PIN the
  cached one is the old one.
- A missed call site degrades to today's error, never to a silent replay.
