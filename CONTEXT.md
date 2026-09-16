# Keycard Pal

Keycard Pal is an air-gapped wallet companion with separate online and offline distribution boundaries. The domain language distinguishes signing source data from convenience metadata shown to help users recognize what they are approving.

## Language

**Online build**:
The distribution variant allowed to include network-backed convenience features.
_Avoid_: Online version when discussing build boundaries

**Offline build**:
The Android distribution variant that must not declare internet access or include network-backed feature code.
_Avoid_: Offline mode, air-gapped mode

**ENS name**:
A human-readable Ethereum name displayed as convenience metadata for an address.
_Avoid_: Account name, verified address

**Confirmed ENS name**:
An ENS name whose reverse record and forward address resolution agree for the address being displayed.
_Avoid_: Reverse name, claimed name

**Signing source of truth**:
The raw transaction, message, request, or address data that determines what the Keycard signs.
_Avoid_: Display label, resolved name

## Relationships

- An **ENS name** may describe an Ethereum address, but it is not the **Signing source of truth**.
- A **Confirmed ENS name** may be displayed before the raw address, but it must not replace the raw address on approval screens.
- The **Online build** may display network-backed convenience metadata.
- The **Offline build** must preserve raw-address-only behavior when metadata would require network access.
- Build boundaries for network-backed features are enforced at build time, not by runtime checks.

## Example dialogue

> **Dev:** "Can the approval screen show `alice.eth` instead of the address?"
> **Domain expert:** "It can show the **ENS name** in the **Online build**, but the raw address remains the **Signing source of truth**."

**PIN pad scramble**:
An opt-in setting that randomises the digit layout of the PIN pad on mount and on each new error. Disabled by default.
_Avoid_: Digit shuffle, randomised layout

**Fixed PIN layout**:
The default PIN pad digit order: 1–9 across three rows, 0 in the bottom centre. Used when PIN pad scramble is disabled.
_Avoid_: Unscrambled, standard layout

**Transaction simulation**:
A read-only preview of a transaction's outcome sent to Tenderly's API before signing. Shows success/revert status, asset movements, and a trace link. Never transmits the signing key or signed payload.
_Avoid_: Dry run, pre-flight check

**Simulation result**:
The outcome returned by Tenderly for a simulated transaction: success or revert status, optional revert reason, list of asset changes, and a Tenderly dashboard trace link.
_Avoid_: Simulation output, simulation response

**Pairing password**:
The user-entered string used to derive the pairing secret via PBKDF2-HMAC-SHA256. Only needed during initial pairing; never stored.
_Avoid_: PSK, pairing key, pairing secret (when referring to the user-visible input)

**Pairing secret**:
The 32-byte PBKDF2-derived key passed to `autoPair`. Derived from the pairing password; never shown to the user or stored directly.
_Avoid_: Pairing password (when referring to the derived bytes)

**Pairing**:
The `{pairingIndex, pairingKey}` result stored in AsyncStorage after a successful `autoPair`. Once stored, subsequent connections load this and bypass `autoPair` entirely — no pairing password needed.
_Avoid_: Pairing data, pairing record

**EIP-7730 descriptor**:
A JSON file from the Ledger clear-signing registry that maps a specific contract deployment (chainId + address) to human-readable display rules for its function calls and EIP-712 messages.
_Avoid_: Clear-signing file, display metadata file

**Descriptor index**:
The merged, keyed snapshot of all EIP-7730 descriptors used at runtime. Bundled as `src/data/eip7730.json`. Keys: `chainId:address:selector` for calldata, `chainId:address:primaryType` for EIP-712. When a user imports or downloads a newer Ledger registry zip, the processed result is persisted via RNFS and overrides the bundled index on the next startup.
_Avoid_: EIP-7730 registry, descriptor database

**Descriptor source**:
The active mode for descriptor index updates. Three states: bundled (implicit default — no user action), manual import (user uploads a Ledger registry zip via the file picker), auto-download (online build only — fetches the Ledger registry zip from a configurable URL on startup, with ETag-based conditional fetch and wifi-only option). Auto-download and manual import are mutually exclusive; switching to either replaces the bundled index.
_Avoid_: Descriptor mode, update mode

## EIP-7730 relationships

- A **descriptor index** entry takes full priority over existing `ContractCallSection` and `SpecialEip712Section` rendering when a match is found.
- When no **EIP-7730 descriptor** matches, the app falls back to existing ABI-based decoding and special renderers unchanged.
- EIP-712 messages with no `verifyingContract` in the domain are excluded from **descriptor index** lookup and fall back to existing rendering.
- The `calldata` EIP-7730 format type is not supported in v1; fields with that format are rendered as `raw`.
- **Descriptor source** auto-download is opt-in per ADR-0003 — the default descriptor source is bundled.

**Ethereum payload classification**:
The single interpretation of an Ethereum sign request's `(signData, dataType)` into one payload kind (legacy/2930/1559 transaction, personal message, EIP-712 JSON, EIP-712 pre-hashed, raw digest, or invalid). Implemented by `classifyEthPayload` in `src/utils/ethPayload.ts`; deterministic, so review and signing call it independently and always agree.
_Avoid_: payload detection, type sniffing

**Signing digest**:
The 32-byte hash the Keycard actually signs for a classified Ethereum payload. Produced by `signingDigest`; the review Digests tab renders the same value, so the digest shown is by construction the digest signed.
_Avoid_: sign hash, prepared hash

## Ethereum payload relationships

- The **Signing digest** is derived from the **Signing source of truth** through the **Ethereum payload classification** — never from display metadata.
- A payload classified `invalid` is never signable: the review explains why and no Sign button is offered.
- Signature `v` derives from the payload kind, never from re-inspecting raw bytes.

**Stateless session**:
The current design stance: each NFC tap session is self-contained. Settings, pairings, approved non-genuine cards, and the descriptor index still persist, but the app keeps no remembered per-card identity store and no remembered wallet/address list across sessions. Trust decisions are the one deliberate exception: a card the user approved despite a failed genuineness check is remembered, because re-asking on every tap trains the user to dismiss the warning.
_Avoid_: No storage, no persistence

**Card identity**:
A deferred concept: remembering a card's id and extended public key so an incoming transaction's requested address can be derived locally and matched to a specific card. Parked until the Status app ships its version and its behavior can be observed (tracked by #127).
_Avoid_: Card profile, saved wallet

## Card identity relationships

- The app is a **Stateless session** today; **Card identity** is explicitly out of scope for now.
- Address-match and default-name features (fingerprint default) must work **session-local** — derived during the active tap, not read from a persisted store.

**Applet version**:
The raw version number reported by the Keycard in its SELECT response, such as `0x0400`. A fact about the card, readable before any secure channel, pairing or PIN. Never shown to the user.
_Avoid_: Card version, firmware version

**Generation**:
An ordered, named point at which the feature surface Pal cares about changes, expressed as a minimum **Applet version**. Two exist today: 3.1+ and 4.0+. A new applet release earns a generation only when it changes what the app can or cannot do, so releases and generations are not the same list.
_Avoid_: Card version, applet family, feature boundary

**Secure channel version**:
Which channel protocol a card speaks, V1 or V2. Derived from the **Applet version** today, but a separate attribute on purpose: a later applet could keep V2 while introducing a new **Generation**.
_Avoid_: Protocol version, card generation

**Card key**:
Whatever identifies the tapped card for the duration of one session: the instance UID before 4.0, the card identity public key from the certificate from 4.0 onward.
_Avoid_: Card identity, instance UID, session card id

**Card identity public key**:
The 33-byte compressed key inside the certificate a 4.0 card returns in its SELECT response. The card proves it holds the matching private key during the secure channel handshake.
_Avoid_: Card public key, device key

## Generation relationships

- A **Generation** is the unit the minimum-version floor, the Settings picker, and the version-bound menu entries are all expressed in. None of them are expressed in **Applet version** directly.
- The floor refuses a card below the lowest **Generation**; the Settings picker only hides menu entries and never refuses a card.
- **Card key** is used for trust decisions. The key UID, not the **Card key**, identifies the key material on a card, so anything about derived keys is keyed on the key UID.
- A card's **Generation** is knowable from the first SELECT of a tap, before any PIN, which is what lets an operation a card does not support fail before asking for anything.

## Flagged ambiguities

- "online version" means **Online build** when discussing implementation and packaging boundaries.
- "stateless" does not mean zero storage — see **Stateless session**. Settings and pairings persist; per-card identity does not.
