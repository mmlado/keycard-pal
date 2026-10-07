# 0003. Network-touching features are opt-in

Date: 2026-05-16

The app's promise is air-gapped operation, and the online build adds network
features for users who want them without switching flavor. Every such feature is
off by default and enabled by the user in Settings, so that nobody who installed
the online build for one feature gets unexpected requests from another, on a
metered connection or otherwise. Storage keys for opt-in features carry an
`_enabled` suffix so the unset state reads as `false`. One exception: a feature
needs no toggle when the gesture that activates it is itself an unambiguous
opt-in, explicit and targeted, with no network activity before the user confirms.
WalletConnect qualifies: the user scans a `wc:` code and then approves the session
proposal.

## Consequences

- Opt-in today: ENS reverse resolution, remote token images, Tenderly
  simulation. WalletConnect ships without a toggle; its client is created by
  `pair()` and by nothing else. Until #328 the provider created it at mount,
  which opened the relay connection at app start on builds with a built-in
  Project ID; `walletConnectClient.test.ts` and `WalletConnectProvider.test.tsx`
  hold the rule.
- A gesture-gated feature found making ambient calls before confirmation loses
  the exception.
