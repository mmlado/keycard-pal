# 0011. Stored preferences are resolved once at startup

Date: 2026-09-14
Status: accepted

## Context

Five non-sensitive UI preferences live in AsyncStorage: the menu layout, PIN
pad scramble, the token-image opt-in, the welcome-seen flag and the dismissed
xpub notice. Until now each consumer read its own value after mounting: the
root component held the navigator back until the welcome flag was in, the
layout hook carried a `loaded` flag that `EntryList` used to hold its space,
and `PinPad` and `ExportKeyScreen` painted a default and then flipped to the
stored value once the read landed (#289).

The reads take milliseconds, so this was never about speed. It was about
first paints: every consumer that reads late either flickers or needs its own
gate, and the gates had already started to duplicate.

## Decision

`PreferencesProvider` reads every preference in one `AsyncStorage.getMany`
call before anything below it mounts, shows `LoadingScreen` in the meantime
(the Keycard, the app name and the version), and hands the result down
through `PreferencesContext`. The loading screen is an overlay: once the
read resolves the first screen mounts underneath it and it fades out, so the
hand-over is a crossfade rather than a pop. Consumers call
`usePreferences()` and get the values synchronously; `setPreference(key,
value)` shows the new value at once in every consumer, writes it, and rolls
back if the write fails.

Two rules keep a rollback honest. Only the most recent write to a key may
roll back, so a slow failure cannot undo a later choice. And it rolls back to
the last value storage is known to hold, not to the value the failed write
replaced on screen: after two failed writes to one key the replaced value is
itself an optimistic one that never reached storage, so restoring it would
leave the app showing something the user never chose and the phone never
stored.

`preferencesStorage` exposes only `loadPreferences()` and
`savePreference(key, value)`, typed on the `Preferences` keys. There is no
way to read a single preference after startup, so the single resolve is
enforced by the API rather than by convention.

The startup read is local only. It never waits on the network, or startup
would stall offline and in airplane mode, which is the app's normal state.
Nothing Keycard-related is preloaded; the card is not present until the user
taps.

## Consequences

- Adding a preference means adding a field to `Preferences`, its default, its
  storage key and its decode line in `loadPreferences`. The provider and the
  hook do not change. This replaces the one load/save pair per preference
  that ADR-0003 describes; the `_enabled` key suffix for opt-in network
  features stands.
- The per-consumer hooks (`useDashboardLayout`, `usePinPadScramble`) and
  their `loaded` gates are gone. `useTokenImagesEnabled` stays as a build
  boundary: its offline stub returns `false` without touching context.
- The Welcome-or-Dashboard choice is read once when the navigator mounts.
  Get started flipping the flag afterwards changes nothing until the next
  launch, which is the intended behaviour.
- A screen test that needs a preference either mocks `usePreferences` (a
  pinned value) or renders under the real provider with `loadPreferences`
  mocked (when it exercises a write and the rollback).

## Revisit if

- A preference is needed before the provider mounts (it would have to move
  above it or be read separately).
- The preference set grows large enough that one startup read is measurable,
  or a preference becomes something written by more than one client at once.
- A preference needs to change while a consumer is mounted from outside the
  app (another process, a backup restore); the provider would then need a
  re-read path.
