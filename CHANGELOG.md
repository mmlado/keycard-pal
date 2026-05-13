# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Fix Metro env script deleted by preceding `clean` task before the bundle task executes; move file write to `doFirst` so it runs at execution time

## [1.6.1] - 2026-05-12

### Changed

- Bump GitHub Actions: `checkout@v6`, `setup-node@v6`, `setup-java@v5`; use Node 22 in CI and release workflows

### Fixed

- Fix `createBundle*JsAndAssets` Metro env script not being generated when React Native Gradle plugin registers bundle tasks lazily; switch from `tasks.findByName` to `tasks.matching { }.configureEach`

## [1.6.0] - 2026-05-12

### Added

- Add opt-in PIN pad scramble toggle in Settings (default: fixed layout)
- Add opt-in ENS reverse resolution: toggle + custom RPC URL in Settings, ENS name display on address rows, "no ens" indicator for unregistered addresses
- Add iOS camera native module (`CameraView`) for QR code scanning
- Add `NFCError` overlay for iOS NFC error and cancellation states

### Changed

- Rename "Support development" section to "Buy me a coffee" with updated copy

### Fixed

- Fix system UI dark theme: navigation bar, status bar, and safe area background now match app background on all screens

## [1.5.0] - 2026-05-06

### Added

- Add pairing slot management screen: check remaining slots, unpair any slot
- Add SeedQR scan support for mnemonic import/verify
- Add special review renderers for EIP-712 Permit, PermitSingle, SafeTx, and Uniswap Universal Router calls
- Bundle offline token logo assets for the no-INTERNET Android flavor while keeping remote token logos for network-enabled builds

### Changed

- Enforce seed review on generate: 30s mandatory timer on word/share display, return to word list after 3 wrong verify answers (keycard-shell parity)
- Apply EIP-55 checksum formatting and shell-style address chunk coloring to displayed addresses
- Optimize PIN pad key rendering for better responsiveness on older phones

### Fixed

- Show friendly error when tapping a card with no master key instead of crashing with SW 0x6985
- Fix `crypto-hdkey` ETH export: use master key (`m`) fingerprint as `origin.sourceFingerprint` and set `parentFingerprint` on the HDKey (fixes Ambire and strict BIP32 wallets)
- Accept ERC-4527 EIP-2930 transactions encoded as `dataType=4` typed transaction QR requests

## [1.4.0] - 2026-05-02

### Changed

- Replace ML Kit barcode scanner with ZXing; offline flavor no longer declares INTERNET or storage permissions

## [1.3.0] - 2026-04-30

### Added

- Read Keycard names during NFC sessions and add a Keycard menu action to set or clear the on-card name
- Self-hosted F-Droid repository at fdroid.gapsign.tech; published automatically on each tagged release via GitHub Actions

## [1.2.0] - 2026-04-29

### Added

- Expanded Jest coverage for signing utilities and wallet workflow screens
- Bundled ABI selector metadata generated from an Etherscan-backed ABI snapshot; transaction review decodes known contract calls and flags NFT operator approvals
- Bundled ERC-20 token metadata (1441 tokens, Uniswap default list v20.0.0); ERC-20 review shows symbol, formatted amounts, and token logo (offline flavor skips logo fetch)
- Bundled chain metadata (2593 chains, chainid.network snapshot); transaction review shows chain name and native currency symbol instead of raw chain ID and hardcoded "ETH"

### Changed

- Revert F-Droid build server workarounds by restoring Gradle 9.3.1 and AsyncStorage 3.0.2

## [1.1.0] - 2026-04-28

### Added

- Codecov coverage upload in CI and a live README coverage badge
- Decode ERC-20 calldata (`transfer`, `transferFrom`, `approve`) in transaction review; show unlimited approval warning
- Detect and label pre-hashed EIP-712 payloads (`0x1901`) with domain separator and message hash
- `full` (`tech.gapsign`) and `offline` (`tech.gapsign.offline`) Android build flavors
- QR code fallback for external links so air-gapped users can scan URLs on another device

### Fixed

- EIP-712 JSON decode for minified or non-round-tripping UTF-8 payloads; prettify JSON display

## [1.0.3] - 2026-04-27

### Changed

- Publish signed universal APKs and SHA256 checksums in GitHub releases
- Reduce release APK size with minification, resource shrinking, and ARM-only release splits

## [1.0.2] - 2026-04-27

### Changed

- Downgrade @react-native-async-storage/async-storage to 1.24.0 to remove local maven repo incompatible with F-Droid build server

## [1.0.1] - 2026-04-27

### Fixed

- Downgrade Gradle wrapper to 8.14.2 for F-Droid build server compatibility

## [1.0.0] - 2026-04-27

### Added

- Scramble PIN pad digit layout on mount and on each new error to prevent shoulder-surfing
- F-Droid release metadata, store listing text, and unsigned Android release artifact workflow
- About screen with app description, Keycard link, donation addresses, contributors, and license list
- Keycard menu and NFC action indicators so every visible NFC-triggering action shows the `Icons.nfcActivate` marker
- Dismissible dashboard Keycard purchase notice

### Changed

- Migrate Jest screen and hook tests to React Native Testing Library

### Fixed

- Update vulnerable transitive npm packages and require patched Active Support versions
- Fix QRResult screen showing "Show signature to the wallet" title during wallet key export flow

## [0.9.0] - 2026-04-09

### Added

- Add Ledger Live and Ledger Legacy export via `crypto-hdkey` with EIP-4527 `source` and `children` fields
- Add mnemonic verification flow: enter recovery phrase, tap Keycard, confirm fingerprint match
- Add SLIP39 Shamir share generation, import, and verification flows

### Changed

- Centralize all colors in `theme.ts`; replace hardcoded hex strings throughout components and screens with theme tokens
- Use `keycard-sdk` BIP32 helpers for exported key TLV parsing and public key compression
- Replace deprecated dependencies: ESLint v8→v9 flat config, vector-icons→MDI per-family package, RecoverableSignature for eth signature TLV parsing

### Fixed

- Reject unsupported `btc-sign-request` data types instead of treating them as legacy Bitcoin messages

## [0.8.0] - 2026-04-06

### Added

- Add Bitcoin PSBT signing support
- Add Bitcoin message signing support via BIP-322, including crypto-psbt detection and btc-sign-request / btc-signature QR flows
- Add Bitget multi-account export via crypto-multi-accounts UR
- Add EIP-2930 (type 0x01) transaction signing support
- Add decoded EIP-712 domain and message display before signing

### Fixed

- Fix Ethereum `crypto-hdkey` exports to include source fingerprints for Rabby compatibility
- Fix SIWE / personal_sign (`dataType=3`) failing with Invalid MAC by applying EIP-191 prefix hash before signing
- Fix QRScannerScreen camera staying active when navigating away by gating render on `useIsFocused`
- Fix malformed `eth-sign-request` payloads silently passing through by validating transaction sign data on UR parse
- Fix PIN pad bottom key obscured by Android gesture navigation bar

## [0.7.0] - 2026-03-23

### Added

- Add Change Secrets flow

## [0.6.0] - 2026-03-21

### Added

- Genuine Keycard verification before first pairing
- Import recovery phrase (12/24 words + optional passphrase)
- Wrong PIN feedback: remaining attempts shown under PIN field, card locked message when no attempts remain
- BIP39 passphrase support for key generation (12 and 24 word variants)
- Mid-operation NFC disconnect shows nudge instead of error

### Fixed

- Address menu: removed duplicate top padding that caused a gap below the navigation header
- Address list FlatList performance fix (memoized renderItem/keyExtractor)

## [0.5.0] - 2026-03-16

### Added

- Address list

### Changed

- Unified UI design across all screens

## [0.4.0] - 2026-03-12

### Added

- Generate keypair flow

## [0.3.0] - 2026-03-11

### Added

- Initialize Keycard flow
- Factory reset flow

## [0.2.0] - 2026-03-04

### Added

- Connect software wallet flow (export extended public key via QR)

## [0.1.0] - 2025-02-22

### Added

- Scanning QR code from compatible Ethereum wallets
- Signing transaction with Keycard
- Scan back result QR code into the compatible Ethereum wallet

[Unreleased]: https://github.com/mmlado/GapSign/compare/v1.6.1...HEAD
[1.6.1]: https://github.com/mmlado/GapSign/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/mmlado/GapSign/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/mmlado/GapSign/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/mmlado/GapSign/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/mmlado/GapSign/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/mmlado/GapSign/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mmlado/GapSign/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/mmlado/GapSign/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/mmlado/GapSign/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mmlado/GapSign/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mmlado/GapSign/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/mmlado/GapSign/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/mmlado/GapSign/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/mmlado/GapSign/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/mmlado/GapSign/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/mmlado/GapSign/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/mmlado/GapSign/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mmlado/GapSign/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mmlado/GapSign/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mmlado/GapSign/compare/294c1212cfd8d1738b5eb90bbb33aa02adee139c...v0.1.0
