# 0004. Tenderly transaction simulation

Date: 2026-05-21

A transaction review can show calldata, fees and digests, but not whether the
transaction will succeed or what will move, and only a simulation against a
third-party execution environment can. Simulation is therefore online build only,
opt-in under ADR-0003, and credentialed by the user with their own Tenderly
account slug, project slug and API key: no key is embedded in any build. It is
offered for Ethereum transactions only, since it needs a `to` address, and it
never blocks signing. Per simulation Tenderly receives `from`, `to`, `input`,
`value`, `gas` and `network_id`; the signing key and the signed payload never
leave the phone. When the request carries no address the user taps the card, an
extended public key is exported at the request's derivation path, and the
address is derived locally first.

## Consequences

- Transaction data goes to Tenderly's servers whenever the user taps Simulate
  with the feature enabled, and the Settings section says so.
- The Simulation tab appears only when all three credentials are set.
- Reconsider if on-device or self-hosted simulation removes the third-party
  trust, or if simulating EIP-712 typed data is wanted, which needs a different
  approach.
