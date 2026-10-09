# 0016. The scanner stays CameraX and ZXing, and reports byte-mode payloads as bytes

Date: 2026-09-27

Supersedes: 0001

ADR-0001 kept the scanner an in-house CameraX and ZXing module rather than
VisionCamera, whose barcode scanner would merge network permissions into the
offline flavor; that reasoning is unchanged and restated here. What changed is the
payload: `ReadCodeEvent` carried one decoded string, which is enough for UR
requests and Standard SeedQR but not for CompactSeedQR, 16 or 32 bytes of raw
entropy in QR byte mode. ZXing guesses a charset for byte-mode segments, lossily,
and iOS returns a `nil` `stringValue` for anything that is not UTF-8, so such a
code produced no event at all. The scanner stays as it is, with no new dependency
or permission, and `ReadCodeEvent` gains exactly one optional field,
`codeBytesBase64`, set when the symbol has byte-mode segments. The bytes come from
ZXing's `BYTE_SEGMENTS`, already stripped of the mode and length header and of
padding, where the raw codeword stream would need header sniffing at every call
site as Sparrow's does; and on iOS, which exposes no segment API, from
`CIQRCodeDescriptor.errorCorrectedPayload` with the bitstream header parsed by
hand (mode indicator, version-dependent count field, ECI skipped). Base64, because
a string holding `U+0000` is not safe across the event bridge and an array costs
more on every decoded frame; optional, so a text QR is unchanged.

## Considered options

- **Vision's `VNDetectBarcodesRequest` on iOS.** A much larger change to reach
  the same bytes.

## Consequences

- CompactSeedQR and any future binary QR become readable, and iOS no longer
  drops a code it decoded but could not stringify.
- The iOS bitstream parser is ours, covered by a standalone C harness since the
  repository has no native test infrastructure. It stops at the first segment
  that is neither byte mode nor ECI, so a mixed-mode QR would reopen it.
- Two fields describe one payload. `MnemonicScreen` prefers the bytes when they
  are a plausible CompactSeedQR and falls back to the string; any future consumer
  copies that rule.
- VisionCamera is reconsidered on ADR-0001's terms only.
