# 0001: Keep the QR scanner as a small native CameraX and ZXing module

Date: 2026-05-06

Status: Accepted

## Context

Keycard Pal needs camera access only for QR scanning: inbound UR requests and SeedQR import. The scanner must fit the app's air-gapped posture, offline Android flavor, and small audit surface.

The app previously used `react-native-camera-kit`, which brought ML Kit barcode scanning into the QR path. The main problem was the dependency chain: it added permissions such as `INTERNET` to the Android APK, which conflicts with the offline flavor's no-network packaging goal even if Keycard Pal itself does not make network calls. Commit `76a1e13` replaced that stack with an internal React Native native view backed by Android CameraX and ZXing. That change removed `react-native-camera-kit` from `package.json`, declared CameraX explicitly in `android/app/build.gradle`, and added `com.google.zxing:core:3.5.3`. The changelog entry for v1.4.0 records the intended result: the offline flavor no longer declares `INTERNET` or storage permissions for scanning.

VisionCamera is the main third-party alternative. As of VisionCamera 5.0.9, `react-native-vision-camera` has peer dependencies on `react`, `react-native`, `react-native-nitro-modules`, and `react-native-nitro-image`. Its Android manifest does not declare Android permissions directly; it declares optional camera and microphone hardware features. The Nitro peer packages' Android manifests are empty.

Barcode scanning is split into a separate `react-native-vision-camera-barcode-scanner` 5.0.9 package with peer dependencies on `react`, `react-native`, `react-native-nitro-modules`, and `react-native-vision-camera`. Its own Android manifest declares only an optional camera hardware feature, but its Android Gradle dependency is `com.google.mlkit:barcode-scanning:17.3.0`. That ML Kit artifact depends on `com.google.android.gms:play-services-mlkit-barcode-scanning:18.3.1`, which depends on Google datatransport. The transitive `com.google.android.datatransport:transport-backend-cct:2.3.3` AAR declares `android.permission.INTERNET` and `android.permission.ACCESS_NETWORK_STATE`; `transport-runtime:2.2.6` declares `ACCESS_NETWORK_STATE`. Those permissions would be candidates for manifest merging if Keycard Pal adopted VisionCamera's barcode scanner.

Primary references:

- VisionCamera releases: https://github.com/mrousavy/react-native-vision-camera/releases
- VisionCamera getting started: https://visioncamera.margelo.com/docs
- VisionCamera barcode scanner docs: https://visioncamera.margelo.com/docs/barcode-scanner
- npm registry metadata checked with `npm view react-native-vision-camera react-native-vision-camera-barcode-scanner`
- Published npm tarballs inspected with `npm pack react-native-vision-camera@5.0.9 react-native-vision-camera-barcode-scanner@5.0.9 react-native-nitro-modules react-native-nitro-image`
- Google Maven AAR manifests inspected for `com.google.mlkit:barcode-scanning:17.3.0`, `com.google.android.gms:play-services-mlkit-barcode-scanning:18.3.1`, and their datatransport dependencies

## Decision

Keep Keycard Pal's scanner as a small native CameraX + ZXing module instead of adopting VisionCamera for now.

The React Native API remains `src/components/Camera/index.tsx`, exposing only the `Camera` component and `ReadCodeEvent`. The shared UI wrapper remains `src/components/CameraView.tsx`.

## Rationale

The current scanner is intentionally narrow: camera preview, QR-only frame analysis, and one event back to JavaScript. That matches Keycard Pal's QR workflows without adding photo, video, frame processor, object detection, or barcode-format surface area.

VisionCamera is well maintained and more feature-complete, but adopting it would add Nitro peer dependencies and, for scanning, a separate barcode scanner package. The scanner package still reaches ML Kit and Google datatransport dependencies that declare network-related permissions. That is a reasonable tradeoff for apps that need a general camera platform or ML Kit scanning, but Keycard Pal currently needs only deterministic QR scanning in an offline wallet companion.

ZXing keeps decoding local and inspectable. CameraX is already the Android camera layer we need. Avoiding the ML Kit camera/scanner dependency chain prevents unwanted Android permissions from being merged into the APK and keeps the offline flavor simpler to explain.

## Consequences

Positive:

- Smaller JavaScript dependency graph for QR scanning.
- Fewer native packages to track during React Native upgrades.
- QR scanning remains local, narrow, and easy to audit.
- Offline Android packaging stays easier to reason about.

Negative:

- We own the Android native camera bridge and its edge cases.
- iOS still needs a matching native implementation.
- VisionCamera's broader device handling and active maintenance are not available to us through a dependency.

## Revisit

Reconsider VisionCamera if Keycard Pal needs cross-platform camera behavior beyond QR scanning, if maintaining the native scanner becomes costly, or if VisionCamera's Nitro dependency footprint becomes part of the app for another accepted reason.
