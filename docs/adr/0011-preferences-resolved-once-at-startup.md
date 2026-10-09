# 0011. Stored preferences are resolved once at startup

Date: 2026-09-14

Five UI preferences live in AsyncStorage, and each consumer used to read its own
after mounting, so screens either flickered from a default to the stored value or
carried their own `loaded` gate, and the gates had started to duplicate (#289).
`PreferencesProvider` now reads every preference in one `getMany` before anything
below it mounts, holds `LoadingScreen` over the first screen until the read lands
and fades it out, and hands the values down through context; `usePreferences()`
returns them synchronously. `setPreference` shows the new value at once, writes
it, and rolls back on failure under two rules: only the most recent write to a key
may roll back, and it rolls back to the last value storage is known to hold, not
the one it replaced on screen, which after a second failed write was itself never
stored. Writes to one key run one at a time, because AsyncStorage's IO jobs can
settle out of order. The storage module exposes only `loadPreferences` and
`savePreference`, so the single resolve is enforced by the API. The read is local
and never waits on the network; airplane mode is the app's normal state.

## Consequences

- Adding a preference touches `preferencesStorage` only: a field, a default, a
  key and a decode line. This replaces the per-feature load/save pair ADR-0003
  describes; its `_enabled` key suffix stands.
- The per-consumer hooks and their `loaded` gates are gone.
  `useTokenImagesEnabled` stays as a build boundary.
- The Welcome-or-Dashboard choice is read once when the navigator mounts.
- A preference needed before the provider mounts, or written by another process,
  would need a path this design does not have.
