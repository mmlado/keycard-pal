# 0002: Build-time isolate online-only features

Date: 2026-05-06

Status: Accepted

## Context

GapSign has an offline Android flavor whose promise is stronger than "network code is not used": online-only features may exist in the repository, but they must be absent from the offline APK and its JavaScript bundle. This matters for network-backed features such as ENS resolution and WalletConnect because they introduce RPC clients, endpoint strings, settings screens, and sometimes optional packages that are inappropriate for the offline distribution.

The existing `BuildConfig.INTERNET_ENABLED` flag is useful for small behavior differences in already-shared code. It is not sufficient for features whose code, dependencies, or endpoints should not be packaged into the offline artifact at all.

Shared screens still need a stable way to render online enhancements in the online build while keeping the offline build raw-address-only or disconnected from online providers.

## Decision

Online-only features must be isolated at build time with explicit online/offline module boundaries. Shared code imports the online boundary module; offline builds resolve that import to an offline stub during Metro resolution.

Online implementation files may live in the repository. The offline APK and JavaScript bundle must not include online feature modules, default RPC/project endpoint strings, settings routes for online-only features, or online-only dependencies.

Runtime `INTERNET_ENABLED` checks remain acceptable for small choices inside code that is already shared by both builds, but they are not the boundary for network-backed features.

## Rationale

Build-time isolation keeps the offline flavor auditable. A reviewer should be able to inspect the offline artifact and see that ENS lookup code, WalletConnect clients, RPC endpoints, and related settings are not present.

Runtime gating is easier to implement, but it still ships the online code and strings in the offline bundle. That weakens the offline flavor's packaging story and makes accidental reachability harder to reason about.

The `.online` / `.offline` boundary pattern keeps shared screens from depending directly on online implementations. It also gives tests and CI a concrete artifact to verify: build the offline bundle and scan it for forbidden online-only markers.

## Consequences

Positive:

- Offline APKs remain easier to audit for network-backed feature absence.
- Online feature code can still live in the repo and be tested without maintaining a separate source tree.
- Shared UI can call stable boundary modules while offline stubs preserve offline behavior.
- CI can verify bundle reachability instead of relying on source grep.

Negative:

- Each online feature needs extra boundary modules and offline stubs.
- Metro resolution and Gradle bundling need explicit build-mode wiring.
- Bundle guard scripts must be maintained as online features add new symbols or endpoint strings.

## Revisit

Reconsider this pattern if GapSign stops shipping an offline Android flavor, if React Native/Metro offers a cleaner first-class flavor mechanism, or if online features move to a separate package that can be excluded from offline installs and bundles more directly.
