# 0014. WalletConnect stays on its last Apache-2.0 releases

Date: 2026-09-19
Status: accepted

## Context

WalletConnect support (#97) was built on `@reown/walletkit` and the
`@walletconnect/*` packages while they were Apache-2.0. In September 2025 Reown
relicensed them. From `@reown/walletkit` 1.2.11 and `@walletconnect/core` 2.21.9
on, every release ships under the "WalletConnect Community License Agreement"
(release date 20 August 2025). The app had moved past that line without anyone
noticing, to 1.5.5 and 2.23.9, because the `license` field of a dependency is
not something a version bump shows.

The Community License is not a free software license:

- the grant is non-transferable and non-sublicensable (1a);
- modifications and derivative works are assigned to Reown (1c);
- every use "must connect to the proprietary Reown gateway infrastructure" (2b);
- a commercial license is required above 500 monthly active users or 2,500,000
  RPC calls a month, thresholds Reown may change and measures "in our sole
  discretion" (3);
- distributors must ship a Reown copyright notice and a copy of the license (2a),
  which the app never did.

Keycard Pal is MIT and is meant to be free software all the way down. The
license also keeps the full flavor out of f-droid.org, where every bundled
dependency has to be FLOSS (#316).

## Decision

The app uses the last Apache-2.0 releases and stays on them:
`@reown/walletkit` 1.2.10, `@walletconnect/core` 2.21.7 (the version walletkit
1.2.10 pins) and `@walletconnect/react-native-compat` 2.21.8. All three are
declared with exact versions, no caret.

`__tests__/walletConnectLicense.test.ts` reads the installed `package.json` of
every `@reown/*` and `@walletconnect/*` package in the lockfile and fails unless
it declares Apache-2.0 or MIT. A bump that turns it red is a license change, not
a version change, and needs a new decision here.

`@walletconnect/utils` 2.21.7 nests its own `viem` 2.31.0, which drags in a `ws`
with two open advisories. An `overrides` entry points it at the app's `viem`, so
there is one copy and the advisories are gone.

## Considered options

- **Stay current and comply with the Community License.** Ships a non-free
  component in an MIT app, hands Reown the right to demand a commercial license
  at 500 users by their own count, and closes F-Droid to the full flavor.
- **Drop WalletConnect.** It is the only way to use the card with a dApp from
  the phone alone. Removing it over a license, while free releases still work,
  throws the feature away too early.
- **A full flavor without WalletConnect for F-Droid only.** A third flavor to
  build, test and explain, for the same code.
- **Fork the Apache-2.0 sources.** Only worth it once there is something to fix.
  The pin keeps that option open at no cost.

## Consequences

- Every WalletConnect dependency is Apache-2.0 or MIT again, and the About
  screen lists the online-only packages through `src/data/onlineLicenses.online.ts`
  (the offline twin is empty, so the offline build claims nothing it does not
  bundle).
- `@walletconnect/react-native-compat` 2.21.8 has no WalletConnect Pay module, so
  the full flavor no longer links JNA or the Yttrium uniffi bindings from
  jitpack. The hand-linking from ADR-0009 is unchanged: same package class, same
  codegen spec name. The JNA and uniffi markers in `scripts/check-offline-apk.js`
  stay as a tripwire.
- The SDK is frozen at August 2025. Upstream fixes, security fixes included, do
  not arrive. The app's use of it is small (`WalletKit.init`, session and
  request listeners, in-memory storage), which bounds the exposure.
- The relay is Reown's and they can stop serving old clients. If that happens
  WalletConnect stops working in the app until this decision is revisited; QR
  signing is unaffected.

## Revisit when

- Reown returns the SDK to a free license.
- The relay rejects 2.21.x clients, or a vulnerability in the pinned code
  affects the app. Then the choice is between a fork of the Apache-2.0 sources,
  another free implementation of the protocol, and dropping the feature.
