# 0003: Network-touching features are opt-in

Date: 2026-05-16

Status: Accepted

## Context

GapSign's core promise is air-gapped operation. The online build adds network-backed features (ENS resolution, remote token images) to serve users who want those enhancements without switching to the offline flavor. However, enabling these features by default contradicts the air-gapped ethos and makes outbound requests on behalf of users who may not expect them.

ENS resolution was already opt-in at launch. Token image fetching was opt-out (remote URLs were fetched by default in the online build), which is inconsistent.

## Decision

Every network-touching feature in the online build must be **opt-in**: disabled by default, enabled explicitly by the user in Settings. Preferences are persisted via `preferencesStorage`. Storage keys for opt-in features use an `_enabled` suffix so that the unset state (no stored value) maps to `false` via the existing `loadBoolean` helper, which defaults to `false`.

Features covered by this decision:

- ENS reverse resolution — opt-in toggle in Settings (already compliant)
- Remote token image downloads — opt-in toggle in Settings (added in 1.7.0)

Any future network-touching feature added to the online build must follow the same pattern.

## Rationale

- **Consistency with the air-gapped promise**: users who install the online build for its RPC features should not have unrelated network requests made without their knowledge.
- **Metered connections**: cosmetic network requests (token logos) are a poor tradeoff on metered or slow connections.
- **Storage key convention**: the `_enabled` suffix lets all opt-in preferences share the same `loadBoolean` / `saveBoolean` helpers; unset keys return `false` (disabled), which is the correct default for opt-in features.

## Consequences

- New network-touching features require a Settings toggle before shipping.
- Token images are disabled by default; users must opt in via Settings.
- The `preferencesStorage` module grows one load/save pair per opt-in feature.

## Revisit if

- A feature is so fundamental to the online build that opt-out is a better UX (e.g., a future WalletConnect integration that is the reason a user installs the online build at all).
