# 0016. The scanner stays CameraX and ZXing, and reports byte-mode payloads as bytes

Date: 2026-09-27

Status: accepted

Supersedes: 0001

## Context

ADR-0001 kept the QR scanner as a small in-house native module, CameraX plus ZXing on
Android, rather than adopting VisionCamera, because VisionCamera's barcode scanner reaches
ML Kit and Google datatransport, whose AARs declare `INTERNET` and `ACCESS_NETWORK_STATE`
and would merge those permissions into the offline flavor. That reasoning is unchanged and
is restated as part of this decision.

What has changed is the payload. ADR-0001 fixed the JavaScript surface at "only the
`Camera` component and `ReadCodeEvent`" and "one event back to JavaScript", and
`ReadCodeEvent` carried exactly one field, a decoded string. That is enough for every QR
the app read at the time, because UR requests and Standard SeedQR are text.

CompactSeedQR is not text. It is 16 or 32 bytes of raw BIP-39 entropy in QR byte mode,
and a decoded string cannot represent it:

- On Android no `DecodeHintType.CHARACTER_SET` is set, so ZXing guesses a charset for
  byte-mode segments (ISO-8859-1, Shift_JIS or UTF-8) and the guess is lossy and not
  reproducible for arbitrary bytes.
- On iOS `AVMetadataMachineReadableCodeObject.stringValue` is `nil` for a payload that is
  not valid UTF-8, and the delegate skipped it, so such a QR produced no event at all.

Entropy routinely contains `0x00`, `\n` and `\r`. The SeedQR specification publishes test
vectors specifically for those bytes because they are what break readers.

## Decision

Keep the scanner as the in-house CameraX and ZXing module. Do not adopt VisionCamera.
Nothing here adds a dependency, a Gradle artifact or an Android permission.

Widen `ReadCodeEvent` by exactly one optional field, `codeBytesBase64`, set when the symbol
contains byte-mode segments and absent otherwise. It is still one event per decode, still
QR only.

The bytes come from `ResultMetadataType.BYTE_SEGMENTS` on Android and from
`CIQRCodeDescriptor.errorCorrectedPayload` on iOS.

## Rationale

`BYTE_SEGMENTS` is preferred over `Result.rawBytes` because it is the segment content
already stripped of the mode and length header and of padding. The raw codeword stream is
not: a 12-word CompactSeedQR starts `41 0` and ends `0 ec`, which the specification calls
out by name, and consuming it would force header sniffing at the call site the way
Sparrow's implementation has to.

iOS has no equivalent, because `AVCaptureMetadataOutput` exposes no segment API.
`errorCorrectedPayload` is the codeword stream, so the bitstream header is parsed there by
hand: a 4-bit mode indicator, then a character-count field whose width depends on the
symbol version, skipping any ECI designator and collecting byte-mode segments. Moving to
Vision's `VNDetectBarcodesRequest` was the alternative and was rejected as a much larger
change to reach the same bytes.

The field is base64 rather than a string or an array. A string is what the problem is: a
payload containing `U+0000` is not safe to carry across the event bridge. An array of
numbers would work but costs more per frame, and the scanner dispatches on every decoded
frame.

The field is optional rather than always present so that the common case, a text QR, is
unchanged and consumers that do not care are unaffected.

## Consequences

Positive:

- CompactSeedQR becomes readable, and so does any future binary QR payload.
- iOS no longer silently drops a QR it decoded but could not stringify.
- The two platforms agree on what a scan yields, which they did not before.
- Still no new dependency and no new permission, so the offline flavor is untouched.

Negative:

- The iOS bitstream parser is ours to maintain, including the version-dependent count
  field. It is covered by a standalone C harness rather than by an on-device test, because
  the repository has no native test infrastructure.
- Two fields now describe one payload, so a consumer has to decide which to trust.
  `MnemonicScreen` prefers the bytes when they are a plausible CompactSeedQR and falls back
  to the string, which is the rule any future consumer should copy.

## Revisit

Reconsider VisionCamera on the same terms ADR-0001 set: if the app needs camera behaviour
beyond QR scanning, if maintaining the native scanner becomes costly, or if the Nitro
dependency footprint enters the app for another accepted reason. Revisit the hand-rolled
iOS bitstream parsing if Apple exposes segment-level access, or if a mixed-mode QR ever
needs reading, since the parser stops at the first non-byte, non-ECI segment.
