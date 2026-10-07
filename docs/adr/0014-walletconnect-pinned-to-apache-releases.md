# 0014. WalletConnect stays on its last Apache-2.0 releases

Date: 2026-09-19

From `@reown/walletkit` 1.2.11 and `@walletconnect/core` 2.21.9 on, Reown ships
the SDK under the WalletConnect Community License, which is not free software:
the grant is non-transferable, derivative works are assigned to Reown, every use
must connect to Reown's gateway, a commercial license is required above 500
monthly active users by Reown's own count, and distributors owe a notice the app
never shipped. The app had drifted past that line unnoticed, because a version
bump does not show a dependency's `license` field. Keycard Pal is MIT and meant to
be free all the way down, and f-droid.org admits only FLOSS dependencies (#316).
So the app pins the last Apache-2.0 releases with exact versions: walletkit
1.2.10, core 2.21.7 and `react-native-compat` 2.21.8.
`walletConnectLicense.test.ts` reads every installed `@reown/*` and
`@walletconnect/*` package and fails on anything but Apache-2.0 or MIT, so a bump
that turns it red is a license decision, not a version change. An `overrides`
entry points the nested `viem` at the app's copy, which removes a `ws` with two
open advisories.

## Considered options

- **Stay current under the Community License.** A non-free component in an MIT
  app, a commercial license at Reown's discretion, and no F-Droid.
- **Drop WalletConnect.** The only way to use the card with a dApp from the phone
  alone, thrown away while free releases still work.
- **A third flavor without it for F-Droid.** One more build to test and explain
  for the same code.
- **Fork the Apache-2.0 sources.** Worth it once there is something to fix; the
  pin keeps it open at no cost.

## Consequences

- The SDK is frozen at August 2025; upstream fixes, security fixes included, do
  not arrive. The app's use of it is small, which bounds the exposure.
- The relay is Reown's and can stop serving old clients, which would stop
  WalletConnect in the app until this is revisited; QR signing is unaffected.
- compat 2.21.8 has no WalletConnect Pay module, so the full flavor no longer
  links JNA or the Yttrium uniffi bindings; their markers in
  `check-offline-apk.js` stay as a tripwire.
- Reopen if Reown returns the SDK to a free license, the relay rejects 2.21.x,
  or a vulnerability in the pinned code affects the app: then a fork, another
  free implementation, or dropping the feature.
