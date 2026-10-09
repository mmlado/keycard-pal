# 0005. Two-tap retry for a custom pairing password

Date: 2026-06-07

Status: Superseded by [0012](0012-dual-generation-keycard-support.md)

> Superseded 2026-09-16. The two-tap flow below still describes what happens on a
> Secure Channel V1 card, and the constraint it records (the NFC layer cannot keep
> a session alive across input) still holds. ADR-0012 generalises it: pairing does
> not exist on applet 4.0, and "identify on the first tap, operate on the second"
> became the pattern for every operation a card's generation does not support,
> rather than a one-off for the pairing password.

A card paired with a custom pairing password makes `autoPair` throw
`APDUException("Error: Invalid card cryptogram")` mid-session, and the React
Native NFC layer has no way to hold the session open while the user types the
password. So the flow is two taps, like `genuine_warning`: the first tap detects
the mismatch, sets phase `pairing_password` and ends by throwing; the password is
entered in the bottom sheet's Modal; the second tap pairs with it, and the stored
pairing bypasses `autoPair` from then on. Detection is by message, because the
SDK verifies the cryptogram client-side and the exception carries `sw === 0`.

## Consequences

- The prompt takes the Modal path, not the PIN overlay: on iOS the app draws no
  sheet during a tap, so only the Modal reaches both platforms after an
  interrupted tap.
- Pairing slots full is caught separately and shown in plain words.
