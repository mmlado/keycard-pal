# 0003: Network-touching features are opt-in

Date: 2026-05-16

Status: Accepted

## Context

GapSign's core promise is air-gapped operation. The online build adds network-backed features (ENS resolution, remote token images) to serve users who want those enhancements without switching to the offline flavor. However, enabling these features by default contradicts the air-gapped ethos and makes outbound requests on behalf of users who may not expect them.

ENS resolution was already opt-in at launch. Token image fetching was opt-out (remote URLs were fetched by default in the online build), which is inconsistent.

## Decision

Every network-touching feature in the online build must be **opt-in**: disabled by default, enabled explicitly by the user in Settings. Preferences are persisted via `preferencesStorage`. Storage keys for opt-in features use an `_enabled` suffix so that the unset state (no stored value) maps to `false` via the existing `loadBoolean` helper, which defaults to `false`.

**Exception — gesture-gated features:** A feature does not require a Settings toggle when the user's deliberate gesture to activate it is itself an unambiguous opt-in. The activation must be explicit, targeted (not ambient), and require active user confirmation before any network connection is made. WalletConnect v2 qualifies: the user must scan a `wc:` QR code and then approve the session proposal — no network activity occurs until those steps complete. No Settings toggle is required for such features.

Features covered by this decision:

- ENS reverse resolution — opt-in toggle in Settings (already compliant)
- Remote token image downloads — opt-in toggle in Settings (added in 1.7.0)
- WalletConnect v2 — exempt; `wc:` QR scan + session approval is the opt-in gesture

Any future network-touching feature added to the online build must follow the same pattern or qualify under the gesture-gated exception.

## Rationale

- **Consistency with the air-gapped promise**: users who install the online build for its RPC features should not have unrelated network requests made without their knowledge.
- **Metered connections**: cosmetic network requests (token logos) are a poor tradeoff on metered or slow connections.
- **Storage key convention**: the `_enabled` suffix lets all opt-in preferences share the same `loadBoolean` / `saveBoolean` helpers; unset keys return `false` (disabled), which is the correct default for opt-in features.

## Consequences

- New network-touching features require a Settings toggle before shipping, unless they qualify under the gesture-gated exception.
- Token images are disabled by default; users must opt in via Settings.
- The `preferencesStorage` module grows one load/save pair per opt-in feature.
- WalletConnect v2 ships without a Settings toggle; the `wc:` QR scan + session approval gates all network activity.

## Revisit if

- A gesture-gated feature is found to make ambient network calls before user confirmation (would remove the exception for that feature).
- The gesture-gated exception is abused for features whose activation is not clearly deliberate and targeted.
