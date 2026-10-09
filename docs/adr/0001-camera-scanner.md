# 0001. Keep the QR scanner as a small native CameraX and ZXing module

Date: 2026-05-06

Status: Superseded by [0016](0016-scanner-reports-byte-mode-payloads.md)

> Superseded 2026-09-27. The decision below still holds: the scanner stays CameraX and
> ZXing, and VisionCamera is still rejected for the dependency chain recorded here.
> ADR-0016 changes one thing, the JavaScript surface this ADR fixes at a single decoded
> string. A byte-mode payload cannot be represented as a string, so `ReadCodeEvent` gained
> an optional `codeBytesBase64`.

Keycard Pal needs the camera for QR scanning only: inbound UR requests and SeedQR
import. `react-native-camera-kit` brought ML Kit into that path, and with it
`INTERNET` into the offline APK, so commit `76a1e13` replaced it with an in-house
native view backed by CameraX and ZXing. The scanner stays that module, kept
deliberately narrow: camera preview, QR-only frame analysis, and one event back to
JavaScript, with the JavaScript surface fixed at only the `Camera` component and
`ReadCodeEvent`. Decoding stays local and inspectable, and no network permission
can merge into the offline flavor through the scanner.

## Considered options

- **VisionCamera 5.0.9.** Well maintained and far more capable, but it adds the
  Nitro peer packages, and scanning needs the separate barcode-scanner package,
  whose Gradle dependency is `com.google.mlkit:barcode-scanning`. That reaches
  `play-services-mlkit-barcode-scanning` and Google datatransport, whose AARs
  declare `INTERNET` and `ACCESS_NETWORK_STATE` (verified in the published
  tarballs and the Google Maven manifests). Those would merge into the offline
  APK, which exists to declare no network permission.

## Consequences

- The Android camera bridge and its edge cases are ours, and iOS needs a matching
  native implementation.
- Reconsider VisionCamera only if the app needs camera behaviour beyond QR
  scanning, maintaining the native scanner becomes costly, or the Nitro
  dependency footprint enters the app for another accepted reason.
