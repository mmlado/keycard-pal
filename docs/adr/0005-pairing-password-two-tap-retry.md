# ADR 0005: Two-tap retry for custom pairing password

**Date:** 2026-06-07
**Status:** Accepted

## Context

When `autoPair` is called with the default pairing secret and the card was paired with a custom pairing password, the SDK throws `APDUException("Error: Invalid card cryptogram")` mid-session. The user needs to supply their custom pairing password and retry.

The alternative — retrying `autoPair` in the same NFC session immediately after the error — is not viable: the error propagates up through `handleCardConnected`, which ends the NFC session via `useNFCSession`. There is no "keep session alive for more input" path in the React Native NFC layer.

## Decision

Custom pairing password entry follows the same two-tap pattern as `genuine_warning`:

1. First tap: detect the cryptogram mismatch, return `null` from `handleCardConnected`, set `phase = 'pairing_password'`.
2. Show a full-screen `PairingPasswordEntry` modal — same structure as PIN entry.
3. User submits password → stored in a ref → `startNFC()` called.
4. Second tap: `autoPair` called with the custom password string (SDK derives the pairing secret via PBKDF2-HMAC-SHA256 internally).
5. On success: pairing saved to AsyncStorage as normal; custom password ref cleared.
6. On failure: `pairingPasswordError` set, stay in `pairing_password` phase, user can retry.

Detection: `e instanceof APDUException && e.message.includes('Invalid card cryptogram')`. The SW code is not usable here — the cryptogram mismatch is verified client-side by the SDK before step 2, so the exception has `sw === 0`.

## Rationale

- Mirrors the `genuine_warning` pattern already in the codebase — same state machine shape, same NFC restart.
- Custom pairing password is only needed once. After successful `autoPair`, the pairing is stored in AsyncStorage; future sessions load it and bypass `autoPair` entirely. The password is never persisted.
- The two-tap UX is acceptable: the first tap informs the user their card uses a custom password; the second tap completes pairing.

## Consequences

- `Phase` gains a `'pairing_password'` value.
- `UseKeycardOperation` gains `pairingPasswordError: string | null` and `submitPairingPassword: (password: string) => void`.
- `NFCBottomSheet` gains a `PairingPasswordEntry` component rendered inside the existing bottom sheet Modal (same pattern as `genuine_warning`, not `pin_entry`). On iOS, `showSheet` is always false — only the bottom sheet Modal is used for post-tap interrupts, so `pairing_password` must follow `genuine_warning`'s modal path to work on both platforms.
- "Pairing slots full" error (`autoPair` step 2 failure) is caught separately and surfaced as a human-readable message rather than a raw APDU error string.

## Revisit if

- The React Native NFC layer gains support for keeping a session alive across async UI interactions — at that point in-session retry becomes viable and eliminates the second tap.
