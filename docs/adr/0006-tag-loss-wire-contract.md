# 0006. Tag loss is a rejection carrying upstream's message literals

Date: 2026-08-12

When the card leaves the field mid-APDU, the bridge has to tell the app that
this was a recoverable tag loss and not a card error. The signal is a promise
rejection whose message holds upstream's own literals, `"Tag was lost."` from
Android's `TagLostException` and `"NFCError:<code>"` from the iOS bridge, matched
in the app by `isTagLostError`. Nothing paraphrases those literals on either
side. Only the message survives every hop from native reject through the
TurboModule error, the bridge's channel wrapper and keycard-sdk's `CardIOError`,
which stringifies the cause and discards its `code`; and the bridge's `lib/` is
built at install time, so a stale copy is a live hazard that a changed response
shape would turn into a crash. The same rule covers every other upstream
message the app reads, the unknown-CA refusal and the handshake failures
included: each is held equal to the installed SDK's source by a test, and a
missed match degrades to the raw message, never to a wrong classification.

## Considered options

- **A third `state` value in the resolved response.** Breaks under a stale
  `lib/`: the old channel code only tests `state === 'error'` and builds the
  response outside its try, so tag loss becomes an unrelated crash.
- **A dedicated reject code.** Dead on arrival: `CardIOError` keeps the message
  and drops the code.

## Consequences

- The literal list is closed: a false positive traps the user in a reconnect
  wait, so a new string needs evidence from its emitter.
- A rename upstream would silently disable classification; the bridge and SDK
  contract tests turn that into a red build.
- The `code` and `name` arms of the predicate are forward compatibility only;
  nothing may assume they fire.
