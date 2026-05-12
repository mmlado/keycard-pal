# GapSign

<p align="center">
  <img src="fastlane/metadata/android/en-US/images/icon.png" width="96" alt="GapSign icon" />
</p>

<p align="center">
  <a href="https://github.com/mmlado/GapSign/actions/workflows/ci.yml"><img src="https://github.com/mmlado/GapSign/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/mmlado/GapSign/actions/workflows/android-release.yml"><img src="https://github.com/mmlado/GapSign/actions/workflows/android-release.yml/badge.svg" alt="Build & Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://codecov.io/gh/mmlado/GapSign"><img src="https://codecov.io/gh/mmlado/GapSign/branch/main/graph/badge.svg" alt="Test coverage" /></a>
  <a href="https://developer.android.com"><img src="https://img.shields.io/badge/platform-Android-green.svg" alt="Platform" /></a>
  <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/React%20Native-0.83-blue.svg" alt="React Native" /></a>
  <a href="https://github.com/mmlado/GapSign/releases/latest"><img src="https://img.shields.io/github/v/release/mmlado/GapSign" alt="GitHub release" /></a>
  <img src="https://img.shields.io/github/last-commit/mmlado/GapSign.svg" alt="Last commit" />
  <img src="https://img.shields.io/github/stars/mmlado/GapSign.svg?style=social" alt="Stars" />
</p>

GapSign is an air-gapped Android companion app for [Status Keycard](https://keycard.tech). It lets you sign Ethereum and Bitcoin transactions over NFC, so your private keys never touch an internet-connected device.

All communication with your watch-only wallet happens through animated QR codes using the [Blockchain Commons UR](https://github.com/BlockchainCommons/bc-ur) standard. No telemetry.

GapSign comes in two variants:

| Variant | Package ID | Internet |
|---------|-----------|----------|
| **GapSign** | `tech.gapsign` | Optional — for future opt-in security features (ENS, simulation) |
| **GapSign Offline** | `tech.gapsign.offline` | Never — `INTERNET` permission is absent from the manifest |

Both variants are fully functional for signing and key management. GapSign Offline is the right choice if you want a hard, manifest-level guarantee of no network access.

## Screenshots

<p align="center">
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/01_dashboard.png" width="30%" alt="Dashboard" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/02_connect_software_wallet.png" width="30%" alt="Connect software wallet" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/03_nfc_scan.png" width="30%" alt="NFC scan" />
</p>
<p align="center">
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/04_show_qr_code.png" width="30%" alt="Show QR code" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/05_scan_qr_code.png" width="30%" alt="Scan QR code" />
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/06_transaction.png" width="30%" alt="Transaction review" />
</p>
<p align="center">
  <img src="fastlane/metadata/android/en-US/images/phoneScreenshots/07_keypair.png" width="30%" alt="Key pair" />
</p>

## Features

- Sign Ethereum transactions: legacy, EIP-1559, and EIP-2930
- Sign EIP-712 typed data with a decoded preview before you approve
- Sign personal messages (EIP-191 / SIWE)
- Sign Bitcoin transactions via PSBT
- Sign Bitcoin messages (BIP-322)
- Export wallet keys to MetaMask, Rabby, Ledger Live, Sparrow, BlueWallet, and Bitget
- Generate and load key pairs directly onto the Keycard
- Import a recovery phrase (BIP-39, 12 or 24 words, with optional passphrase)
- Import SLIP-39 Shamir Secret Sharing shares
- Genuine Keycard verification before first pairing
- Two variants: GapSign Offline (no internet, manifest-level guarantee) and GapSign (optional internet for future security features)

## Requirements

- Android 7.0+ (API 24)
- A [Status Keycard](https://get.keycard.tech/vuxxnf) NFC smart card (use code **ShellSummer9746** for a discount on orders over $25)

## Getting the app

Download the latest APK from [Releases](../../releases) and sideload it onto your device.

<p>
  <a href="https://github.com/mmlado/GapSign/releases/latest">
    <img src="assets/badges/badge_github.png" alt="Get it on GitHub" height="70" />
  </a>
  <a href="https://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/mmlado/GapSign">
    <img src="assets/badges/badge_obtainium.png" alt="Get it on Obtainium" height="70" />
  </a>
  <a href="https://fdroid.gapsign.tech/repo?fingerprint=24EB891A8A617F8BF20892CB0CF9267709BA94056E64242AD9EDF638C2FED3D2">
    <img src="https://fdroid.gitlab.io/artwork/badge/get-it-on.png" alt="Get it on F-Droid" height="70" />
  </a>
</p>

For most users, install the universal APK. ABI-specific split APKs are also attached to releases for smaller downloads on known device architectures.

### Verification info

- Package ID: `tech.gapsign` (GapSign) / `tech.gapsign.offline` (GapSign Offline)
- SHA-256 hash of signing certificate: `A8:3C:11:4B:1F:42:01:DA:FB:D0:3E:22:1F:1C:29:28:EC:B5:2B:78:BD:A5:E9:3F:29:6F:ED:F2:29:8E:54:6B`
- `SHA256SUMS.txt` is attached to each GitHub Release to verify APK file hashes.

### Install with Obtainium

1. Install [Obtainium](https://github.com/ImranR98/Obtainium).
2. Add `https://github.com/mmlado/GapSign` as a GitHub app source.
3. Use GitHub Releases as the update source.
4. Select the universal APK from the latest release.

### Install via F-Droid

**Repository URL:**
```
https://fdroid.gapsign.tech/repo/
```

**Fingerprint:**
```
24EB891A8A617F8BF20892CB0CF9267709BA94056E64242AD9EDF638C2FED3D2
```

> The APK is built automatically by GitHub Actions on every version tag.

## Building from source

### Prerequisites

- Node.js 20+
- JDK 17
- Android SDK with NDK 27.1.12297006

### Setup

```sh
npm install
```

### Run (development)

```sh
npm start        # Terminal 1: Metro bundler
npm run android  # Terminal 2: build and install
```

### Release build

```sh
cd android && ./gradlew assembleFullRelease      # GapSign (tech.gapsign)
cd android && ./gradlew assembleOfflineRelease   # GapSign Offline (tech.gapsign.offline)
```

## Development

```sh
npm test      # Jest test suite
npm run lint  # ESLint
```

## Buy me a coffee

If GapSign keeps your funds safe, you can send a coffee my way.

- Ethereum: `0xF665E3D58DABa87d741A347674DCc4C4b794cAc9`
- Bitcoin: `bc1qpncfjnresszndse506zmvjya05xcs6493cm8xf`

## Security

- Pairing data is stored in encrypted storage backed by the Android Keystore
- Private keys never leave the Keycard; only the signature result is returned to the app
- QR codes use [Blockchain Commons UR](https://github.com/BlockchainCommons/bc-ur) for structured binary encoding
- GapSign Offline (`tech.gapsign.offline`) has no `INTERNET` permission at the manifest level — no runtime flag can enable networking

## License

MIT
