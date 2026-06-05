# 0004: Tenderly transaction simulation

Date: 2026-05-21

Status: Accepted

## Context

Users reviewing a transaction before signing can inspect calldata, fees, and digests, but cannot know whether the transaction will succeed or what assets will move without broadcasting it. A simulation step — sending the unsigned transaction to a third-party execution environment — lets users preview the outcome without committing to it.

Keycard Pal's offline build and air-gapped ethos prohibit ambient outbound calls. Any simulation feature must not weaken that promise for users who have not explicitly chosen it.

Simulation requires at minimum: `from` address, `to` address, `value`, calldata, and `chainId`. The private key and the signed payload are never needed.

## Decision

Transaction simulation is:

- **Online build only** — no simulation code, endpoint strings, or credentials are included in the offline APK.
- **Opt-in** via a Settings toggle, consistent with ADR 0003. Disabled by default.
- **User-credentialed** — users supply their own Tenderly account slug, project slug, and API key. No shared API key is embedded in the build.
- **Tenderly** as the simulation provider (REST API at `api.tenderly.co`).
- **Transaction-scoped** — simulation is offered only for ETH transactions (where `parseTx` produces a `to` address). Personal sign and EIP-712 typed-data requests do not support simulation.

Data sent to Tenderly per simulation:

| Field | Value |
|-------|-------|
| `from` | Signer's Ethereum address |
| `to` | Transaction recipient address |
| `input` | Transaction calldata |
| `value` | Transaction value in Wei |
| `gas` | Gas limit |
| `network_id` | Chain ID |

The signing key, mnemonic, and signed payload are never transmitted.

The `from` address is taken from the sign request when available. When absent, the user is prompted to tap their Keycard — an extended public key is exported at the derivation path and the address is derived locally before the simulation call is made.

## Rationale

- **Tenderly**: widely used, free tier available, mature simulation API, user-supplied credentials avoid vendor lock-in or shared-key risk.
- **User-supplied credentials**: the build contains no developer API key; each user controls their own Tenderly account and rate limits.
- **Online-only build boundary**: simulation code is isolated behind the same `.online` / `.offline` Metro boundary as ENS and WalletConnect — the offline APK cannot reach simulation endpoints even if somehow invoked.
- **Opt-in respects the air-gap ethos**: users who install the online build for its NFC and QR features should not have transaction data sent to a third-party service without deliberate setup.
- **Signing proceeds regardless**: a simulation failure, timeout, or revert does not block signing. The user retains final authority over whether to sign.

## Consequences

- Transaction data (addresses, value, calldata, chainId) is sent to Tenderly's servers when simulation is enabled and the user taps Simulate. Users are informed of this in the Settings section.
- Users without a Tenderly account must register at `dashboard.tenderly.co`; a direct link is provided in Settings.
- The Simulation tab appears in `TxDataPanel` only when Tenderly is enabled and all three credentials are set.

## Revisit if

- An alternative simulation provider offers self-hosted or on-device simulation that removes the third-party trust requirement.
- Tenderly changes its API in a breaking way or discontinues its free tier.
- User demand emerges for simulating EIP-712 typed-data (e.g., permit execution preview) — this would require a different simulation approach.
